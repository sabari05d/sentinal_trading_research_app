from sqlalchemy import Column, BigInteger, String, Boolean, DateTime, UniqueConstraint, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.database import Base


class WatchlistStock(Base):
    __tablename__ = "watchlist"

    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    ticker = Column(String(10), nullable=False, index=True)
    company_name = Column(String(100), nullable=True)
    added_at = Column(DateTime(timezone=True),
                      server_default=func.now(), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    last_price = Column(Numeric(12, 2), default=0.00, nullable=True)
    last_scanned_at = Column(DateTime(timezone=True), nullable=True)

    # Re-enforce the unique constraint within the ORM layer
    __table_args__ = (
        UniqueConstraint('user_id', 'ticker', name='unique_user_ticker'),
    )
