
import httpx
from sqlalchemy.dialects.postgresql import insert

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

    valid_records = []

    for item in records:
        start_time = item.get("startTime")
        settlement_date = item.get("settlementDate")
        settlement_period = item.get("settlementPeriod")
        generation = item.get("generation")

        if (
            not start_time
            or not settlement_date
            or settlement_period is None
            or generation is None
        ):
            continue

        valid_records.append({
            "settlement_date": settlement_date,
            "settlement_period": settlement_period,
            "start_time": start_time,
            "fuel_type": item.get("fuelType", "WIND"),
            "generation": generation,
        })

    if not valid_records:
        print("No valid outturn records to save.")
        return

    db = SessionLocal()

    try:
        for record in valid_records:
            stmt = insert(HistoricalOutturn).values(**record)

            stmt = stmt.on_conflict_do_update(
                index_elements=[
                    "settlement_date",
                    "settlement_period",
                    "fuel_type",
                ],
                set_={
                    "start_time": stmt.excluded.start_time,
                    "generation": stmt.excluded.generation,
                },
            )

            db.execute(stmt)

        db.commit()
        print(
            f"Successfully saved or updated "
            f"{len(valid_records)} wind outturn records."
        )

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()
