from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional
from pydantic import UUID4

# What the frontend needs to send to add a stock


class WatchlistCreate(BaseModel):
    ticker: str
    company_name: Optional[str] = None

    # Automatically transform input tickers to uppercase (e.g., AAPL, RELIANCE)
    @property
    def clean_ticker(self) -> str:
        return self.ticker.strip().upper()

# What the API returns back to the frontend (includes database generated values)


class WatchlistResponse(BaseModel):
    id: int
    user_id: UUID4
    ticker: str
    company_name: Optional[str]
    added_at: datetime
    is_active: bool
    last_price: Optional[float]
    last_scanned_at: Optional[datetime]

    # Enables compatibility with raw SQLAlchemy ORM objects
    model_config = ConfigDict(from_attributes=True)
