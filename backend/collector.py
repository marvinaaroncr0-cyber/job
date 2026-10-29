
import httpx
from sqlalchemy.dialects.sqlite import insert

from database import SessionLocal
from models import HistoricalOutturn

OUTTURN_URL = (
    "https://data.elexon.co.uk/bmrs/api/v1/"
    "datasets/FUELHH/stream"
)


async def collect_outturn():
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(
            OUTTURN_URL,
            params={"fuelType": "WIND"},
        )
        response.raise_for_status()
        records = response.json()

    if not isinstance(records, list):
        raise ValueError("Unexpected Elexon response format")

    db = SessionLocal()

    try:
        for item in records:
            start_time = item.get("startTime")
            settlement_date = item.get("settlementDate")
            settlement_period = item.get("settlementPeriod")

            if (
                not start_time
                or not settlement_date
                or settlement_period is None
                or item.get("generation") is None
            ):
                continue

            statement = insert(HistoricalOutturn).values(
                settlement_date=settlement_date[:10],
                settlement_period=settlement_period,
                start_time=start_time,
                fuel_type="WIND",
                generation=item["generation"],
            )

            statement = statement.on_conflict_do_update(
                index_elements=[
                    "settlement_date",
                    "settlement_period",
                    "fuel_type",
                ],
                set_={
                    "start_time": start_time,
                    "generation": item["generation"],
                },
            )

            db.execute(statement)

        db.commit()

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
