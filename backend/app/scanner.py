import asyncio
import logging
from datetime import datetime, timezone, time
import zoneinfo
import yfinance as yf
from sqlalchemy.future import select
from app.database import AsyncSessionLocal
from app.models import WatchlistStock

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("SentinalScanner")

# NSE official hours: 09:15 - 15:30 IST
# We use a small buffer: scan from 09:00 to 15:45 to catch pre-open & closing bell data
MARKET_OPEN = time(9, 0)
MARKET_CLOSE = time(15, 45)
MAX_FETCH_RETRIES = 2


def is_indian_market_active() -> bool:
    """
    Returns True if current time is within NSE trading window.
    NSE: Monday–Friday, 09:15–15:30 IST (buffer: 09:00–15:45).
    """
    try:
        ist_zone = zoneinfo.ZoneInfo("Asia/Kolkata")
        now_ist = datetime.now(ist_zone)

        # Weekend check: 0=Monday, 4=Friday, 5=Saturday, 6=Sunday
        if now_ist.weekday() >= 5:
            return False

        current_time = now_ist.time()
        return MARKET_OPEN <= current_time <= MARKET_CLOSE

    except Exception as e:
        logger.error(f"[CLOCK ERROR] Timezone determination anomaly: {str(e)}")
        return True  # Fail open to avoid freezing the scanner


def fetch_live_market_price(ticker_symbol: str) -> float:
    """
    Fetches the latest traded price for an NSE/BSE symbol.
    Tries 1m intraday history first, falls back to ticker.info.
    Returns 0.0 on failure.
    """
    symbol = ticker_symbol.strip().upper()
    if not (symbol.endswith(".NS") or symbol.endswith(".BO")):
        symbol = f"{symbol}.NS"

    for attempt in range(1, MAX_FETCH_RETRIES + 1):
        try:
            ticker_obj = yf.Ticker(symbol)

            # Primary: 1-minute intraday bars
            fast_history = ticker_obj.history(period="1d", interval="1m")
            if not fast_history.empty:
                latest_price = fast_history['Close'].iloc[-1]
                return round(float(latest_price), 2)

            # Fallback: regularMarketPrice from info dict
            info = ticker_obj.info
            for field in ("regularMarketPrice", "currentPrice", "previousClose"):
                price = info.get(field)
                if price is not None and float(price) > 0:
                    return round(float(price), 2)

        except Exception as e:
            logger.warning(
                f"[FEED ERROR] Attempt {attempt}/{MAX_FETCH_RETRIES} failed for {symbol}: {str(e)}")
            if attempt < MAX_FETCH_RETRIES:
                import time as time_mod
                time_mod.sleep(1.0)  # Brief pause before retry

    logger.error(f"[FEED ERROR] All fetch attempts exhausted for {symbol}")
    return 0.0


async def scan_market_assets():
    logger.info("Initializing Scheduled Sentinal Market Scanner Engine...")

    while True:
        try:
            if not is_indian_market_active():
                logger.info(
                    "[CLOCK OVERRIDE] Indian Markets are currently CLOSED. Hibernating scanner for 15 minutes...")
                await asyncio.sleep(900)
                continue

            async with AsyncSessionLocal() as session:
                query = select(WatchlistStock).where(
                    WatchlistStock.is_active == True)
                result = await session.execute(query)
                active_tickers = result.scalars().all()

                if not active_tickers:
                    logger.info("[SCANNER] No active tracking targets mapped.")
                else:
                    logger.info(
                        f"[SCANNER] Market Open. Initiating sweep across {len(active_tickers)} assets.")

                    for asset in active_tickers:
                        logger.info(
                            f"[RADAR FEED] Fetching price for: {asset.ticker}")

                        loop = asyncio.get_event_loop()
                        real_price = await loop.run_in_executor(
                            None, fetch_live_market_price, asset.ticker
                        )

                        if real_price > 0.0:
                            logger.info(
                                f"[RADAR FEED] {asset.ticker} -> ₹{real_price}")
                            asset.last_price = real_price
                            asset.last_scanned_at = datetime.now(timezone.utc)
                        else:
                            logger.warning(
                                f"[RADAR FEED] No valid price for: {asset.ticker}")

                        # Throttle to avoid rate-limiting from yfinance
                        await asyncio.sleep(0.5)

                    await session.commit()

            logger.info("[SCANNER] Batch sweep complete. Sleeping 30s.")
            await asyncio.sleep(30)

        except asyncio.CancelledError:
            logger.warning("[SCANNER] Shutdown signal received. Terminating.")
            break
        except Exception as e:
            logger.error(f"[SCANNER] Critical loop exception: {str(e)}")
            await asyncio.sleep(10)
