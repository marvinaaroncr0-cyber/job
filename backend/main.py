import time
import httpx
from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from database import Base, engine, SessionLocal
from models import EnergyCache, HistoricalOutturn
from datetime import date
from contextlib import asynccontextmanager
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from collector import collect_outturn


Base.metadata.create_all(bind=engine)

scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start collecting immediately on the first startup.
    try:
        await collect_outturn()
    except Exception as exc:
        print(f"Initial outturn collection failed: {exc}")

    # Collect again every 30 minutes.
    scheduler.add_job(
        collect_outturn,
        trigger="interval",
        minutes=30,
        id="collect_wind_outturn",
        replace_existing=True,
        max_instances=1,
    )
    scheduler.start()

    yield

    scheduler.shutdown(wait=False)


app = FastAPI(
    title="WE outturn and forecast API",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


# Cache durations in seconds
OUTTURN_TTL = 30 * 60       # 30 minutes
FORECAST_TTL = 15 * 60      # 15 minutes


def get_cached_data(db: Session, key: str):
    return db.query(EnergyCache).filter(
        EnergyCache.cache_key == key
    ).first()


def save_cached_data(db: Session, key: str, data: list):
    cached = get_cached_data(db, key)

    if cached:
        cached.data = data
        cached.fetched_at = time.time()
    else:
        cached = EnergyCache(
            cache_key=key,
            data=data,
            fetched_at=time.time(),
        )
        db.add(cached)

    db.commit()


async def fetch_energy_data(
    key: str,
    url: str,
    ttl: int,
    params: dict | None = None,
    transform=None,
):
    db = SessionLocal()

    try:
        cached = get_cached_data(db, key)

        # Return fresh cached data without calling Elexon
        if cached and time.time() - cached.fetched_at < ttl:
            return cached.data

        # Cache is missing or expired: fetch fresh data
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                response = await client.get(url, params=params)
                response.raise_for_status()
                external_data = response.json()

            if not isinstance(external_data, list):
                raise ValueError("Unexpected external API response")

            selected_data = (
                transform(external_data)
                if transform
                else external_data
            )

            save_cached_data(db, key, selected_data)

            return selected_data

        except (
            httpx.HTTPError,
            ValueError,
            KeyError,
            TypeError,
        ) as exc:
            # If Elexon fails, use existing cached data if available
            if cached:
                return cached.data

            raise HTTPException(
                status_code=502,
                detail="External service failed and no cached data is available",
            ) from exc

    finally:
        db.close()


def transform_outturn(data: list):
    return [
        {
            "generation": item.get("generation"),
            "settlementperiod": item.get("settlementPeriod"),
            "startTime": (
                item["startTime"][11:19]
                if item.get("startTime")
                else None
            ),
            "settlementDate": item.get("settlementDate"),
        }
        for item in data
    ]




def transform_forecast(data: list):
    return [
        {
            "generation": item.get("generation"),
            "startTime": (
                item["startTime"][11:19]
                if item.get("startTime")
                else None
            ),
            "startdate": (
                item["startTime"][0:10]
                if item.get("startTime")
                else None
            ),
            "publishTime": (
                item["publishTime"][11:19]
                if item.get("publishTime")
                else None
            ),
            "publishdate": (
                item["publishTime"][0:10]
                if item.get("publishTime")
                else None
            ),
        }
        for item in data
    ]

@app.get("/outturn")
@app.get("/api/outturn")
async def get_outturn():
    return await fetch_energy_data(
        key="outturn",
        url=(
            "https://data.elexon.co.uk/bmrs/api/v1/"
            "datasets/FUELHH/stream"
        ),
        params={"fuelType": "WIND"},
        ttl=OUTTURN_TTL,
        transform=transform_outturn,
    )

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
@app.get("/outturn/history")
@app.get("/api/outturn/history")
def get_outturn_history(
    start_date: date,
    end_date: date,
    db: Session = Depends(get_db),
):
    if start_date > end_date:
        raise HTTPException(
            status_code=400,
            detail="start_date must be before or equal to end_date",
        )

    records = (
        db.query(HistoricalOutturn)
        .filter(
            HistoricalOutturn.settlement_date >= start_date.isoformat(),
            HistoricalOutturn.settlement_date <= end_date.isoformat(),
            HistoricalOutturn.fuel_type == "WIND",
        )
        .order_by(
            HistoricalOutturn.settlement_date,
            HistoricalOutturn.settlement_period,
        )
        .all()
    )

    return [
        {
            "generation": row.generation,
            "startTime": row.start_time[11:19],
            "startdate": row.start_time[0:10],
            "settlementperiod": row.settlement_period,
            "settlementDate": row.settlement_date,
            
        }
        for row in records
    ]



@app.get("/forecast")
@app.get("/api/forecast")
async def get_forecast():
    return await fetch_energy_data(
        key="forecast",
        url=(
            "https://data.elexon.co.uk/bmrs/api/v1/"
            "datasets/WINDFOR/stream"
        ),
        ttl=FORECAST_TTL,
        transform=transform_forecast,
    )
