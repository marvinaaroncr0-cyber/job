
from sqlalchemy import Column, Integer, String, Float, UniqueConstraint, Index, JSON
from database import Base


class EnergyCache(Base):
    __tablename__ = "energy_cache"

    cache_key = Column(String, primary_key=True)
    data = Column(JSON, nullable=False)
    fetched_at = Column(Float, nullable=False)



class HistoricalOutturn(Base):
    __tablename__ = "historical_outturn"

    id = Column(Integer, primary_key=True, index=True)
    settlement_date = Column(String, nullable=False)
    settlement_period = Column(Integer, nullable=False)
    start_time = Column(String, nullable=False)
    fuel_type = Column(String, nullable=False, default="WIND")
    generation = Column(Float, nullable=True)

    __table_args__ = (
        UniqueConstraint(
            "settlement_date",
            "settlement_period",
            "fuel_type",
            name="uq_outturn_period_fuel",
        ),
        Index("ix_outturn_date", "settlement_date"),
    )
