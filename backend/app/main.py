import os
import asyncio
import uuid
import numpy as np
import yfinance as yf
import httpx
from pydantic import BaseModel
from google import genai
from google.genai import types
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, Header, status, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import text, and_
from typing import List, Optional

from app.database import get_db
from app.models import WatchlistStock
from app.schemas import WatchlistCreate, WatchlistResponse
from app.scanner import scan_market_assets

from app.services.market import MarketService
from app.services.ai_engine import PredictionEngine

ai_client = genai.Client()


# ─── LIFESPAN ────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    scanner_task = asyncio.create_task(scan_market_assets())
    yield
    scanner_task.cancel()
    try:
        await scanner_task
    except asyncio.CancelledError:
        pass


# ─── APP INIT ─────────────────────────────────────────────────────────────────

# Supabase environment configurations verification
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
# Note: Use your Service Role Key or Service API Key to authorize administrative Auth state edits safely
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_KEY", "")

app = FastAPI(
    title="Sentinal Trading Research System API",
    version="2.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://thesentinal.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["X-User-Id", "Content-Type", "Authorization"],
)


# ─── AUTH ─────────────────────────────────────────────────────────────────────

async def get_current_user_id(
    x_user_id: str = Header(None, alias="X-User-Id")
) -> uuid.UUID:
    if not x_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication header: X-User-Id"
        )
    try:
        return uuid.UUID(x_user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid X-User-Id format. Must be a valid UUID."
        )


# ─── CORE ROUTES ──────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {"status": "online", "message": "Welcome to Sentinal API v2.0"}


@app.get("/api/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    try:
        result = await db.execute(text("SELECT 1"))
        if result.scalar() == 1:
            return {"status": "healthy", "database": "connected"}
        raise HTTPException(
            status_code=500, detail="Database anomaly detected")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database down: {str(e)}")


# ─── WATCHLIST ────────────────────────────────────────────────────────────────

@app.get("/api/watchlist", response_model=List[WatchlistResponse])
async def get_watchlist(
    current_user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    query = (
        select(WatchlistStock)
        .where(and_(WatchlistStock.user_id == current_user_id, WatchlistStock.is_active == True))
        .order_by(WatchlistStock.ticker.asc())
    )
    result = await db.execute(query)
    return result.scalars().all()


@app.post("/api/watchlist", response_model=WatchlistResponse, status_code=status.HTTP_201_CREATED)
async def add_to_watchlist(
    stock_in: WatchlistCreate,
    current_user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    ticker_upper = stock_in.clean_ticker

    existing_result = await db.execute(
        select(WatchlistStock).where(
            and_(WatchlistStock.user_id == current_user_id,
                 WatchlistStock.ticker == ticker_upper)
        )
    )
    existing_stock = existing_result.scalar_one_or_none()

    if existing_stock:
        if existing_stock.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"'{ticker_upper}' is already active in your watchlist."
            )
        existing_stock.is_active = True
        existing_stock.company_name = stock_in.company_name or existing_stock.company_name
        await db.commit()
        return existing_stock

    new_stock = WatchlistStock(
        user_id=current_user_id,
        ticker=ticker_upper,
        company_name=stock_in.company_name
    )
    try:
        db.add(new_stock)
        await db.commit()
        await db.refresh(new_stock)
        return new_stock
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to persist asset data: {str(e)}"
        )


@app.put("/api/watchlist/{id}")
async def update_watchlist(id: int, payload: dict, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(WatchlistStock).where(WatchlistStock.id == id))
    stock = res.scalar_one_or_none()
    if not stock:
        raise HTTPException(status_code=404, detail="Target not found")
    stock.company_name = payload.get("company_name", stock.company_name)
    await db.commit()
    return {"status": "updated"}


@app.delete("/api/watchlist/{id}")
async def delete_watchlist(id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(WatchlistStock).where(WatchlistStock.id == id))
    stock = res.scalar_one_or_none()
    if not stock:
        raise HTTPException(status_code=404, detail="Target not found")
    stock.is_active = False
    await db.commit()
    return {"status": "deactivated"}


# ─── ANALYTICS ────────────────────────────────────────────────────────────────

@app.get("/api/watchlist/{ticker}/analytics")
async def get_stock_analytics(ticker: str, period: str = "3m"):
    """
    Full technical analytics suite for a given ticker and time period.
    Returns historical data, technical indicators, prediction trajectory,
    and AI/statistical price range boundaries.
    """
    try:
        # Layer 1: Fetch and compute full market dataset
        data = await MarketService.fetch_historical_dataset(ticker, period)
        prices = data["prices"]
        volumes = data["volumes"]
        metrics = data["metrics"]

        # Layer 2: Generate 5-session forward price trajectory
        predicted_sequence = PredictionEngine.forecast_price_trajectory(
            prices, volumes, steps=5
        )

        # Layer 3: Price range boundaries — AI-assisted or ATR statistical fallback
        ai_bounds = await PredictionEngine.evaluate_range_boundaries(
            data["symbol"], metrics["current_value"], metrics
        )

        if ai_bounds:
            upper_limit, lower_limit = ai_bounds
            confidence_label = "GEMINI MULTI-SIGNAL BOUNDARY ENGINE"
        else:
            upper_limit, lower_limit = PredictionEngine.compute_statistical_bounds(
                prices,
                metrics["current_value"],
                metrics.get("atr_14", 0)
            )
            confidence_label = "ATR STATISTICAL CHANNEL (FALLBACK)"

        # Layer 4: Determine signal interpretations
        rsi = metrics["rsi_14"]
        if rsi >= 70:
            rsi_signal = "OVERBOUGHT"
        elif rsi <= 30:
            rsi_signal = "OVERSOLD"
        else:
            rsi_signal = "NEUTRAL"

        macd_hist = metrics["macd_histogram"]
        macd_signal_label = "BULLISH_CROSSOVER" if macd_hist > 0 else "BEARISH_CROSSOVER"

        # EMA trend alignment
        ema_trend = "BULLISH_ALIGNMENT" if metrics["ema_20"] > metrics["ema_50"] else "BEARISH_ALIGNMENT"

        # Volatility level (ATR as % of price)
        atr_pct = round((metrics["atr_14"] / metrics["current_value"])
                        * 100, 2) if metrics["current_value"] > 0 else 0
        if atr_pct > 3:
            volatility_label = "HIGH"
        elif atr_pct > 1.5:
            volatility_label = "MODERATE"
        else:
            volatility_label = "LOW"

        # Prepare chart data (last 30 sessions + 5 predicted)
        last_30_prices = prices[-30:]
        last_30_dates = data["dates"][-30:]
        future_dates = [f"T+{i}" for i in range(1, 6)]

        return {
            "symbol": data["symbol"],
            "period": period,

            "performance": {
                "initial_value": metrics["initial_value"],
                "current_value": metrics["current_value"],
                "net_change": metrics["net_change"],
                "percent_change": metrics["percent_change"],
                "interval_high": metrics["interval_high"],
                "interval_low": metrics["interval_low"],
                "max_drawdown": metrics["max_drawdown"],
            },

            "moving_averages": {
                "sma_20": metrics["sma_20"],
                "sma_50": metrics["sma_50"],
                "ema_20": metrics["ema_20"],
                "ema_50": metrics["ema_50"],
                "macro_trend": "BULLISH_DRIFT" if metrics["current_value"] > metrics["sma_50"] else "BEARISH_DRIFT",
                "ema_trend": ema_trend,
            },

            "oscillators": {
                "rsi_14": rsi,
                "rsi_signal": rsi_signal,
                "macd_line": metrics["macd_line"],
                "macd_signal": metrics["macd_signal"],
                "macd_histogram": macd_hist,
                "macd_bias": macd_signal_label,
            },

            "volatility": {
                "atr_14": metrics["atr_14"],
                "atr_pct": atr_pct,
                "volatility_label": volatility_label,
                "bb_upper": metrics["bb_upper"],
                "bb_middle": metrics["bb_middle"],
                "bb_lower": metrics["bb_lower"],
                "bb_position": metrics["bb_position"],
            },

            "volume": {
                "current_volume": metrics["current_volume"],
                "avg_volume_20": metrics["avg_volume_20"],
                "relative_volume": metrics["relative_volume"],
                "volume_signal": "ABOVE_AVERAGE" if metrics["relative_volume"] > 1.2 else (
                    "BELOW_AVERAGE" if metrics["relative_volume"] < 0.8 else "AVERAGE"
                ),
            },

            "predictive_boundaries": {
                "target_projection_days": 5,
                "upper_limit": round(upper_limit, 2),
                "lower_limit": round(lower_limit, 2),
                "model_confidence": confidence_label,
            },

            "chart_data": {
                "historical_labels": last_30_dates,
                "historical_prices": [round(p, 2) for p in last_30_prices],
                "future_labels": future_dates,
                "predicted_prices": predicted_sequence,
                "bb_upper_series": [metrics["bb_upper"]] * len(last_30_prices),
                "bb_lower_series": [metrics["bb_lower"]] * len(last_30_prices),
            },
        }

    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=500,
            detail=f"Sentinal Analytics Architecture Failure: {str(e)}"
        )

# ─── TICKER SEARCH ────────────────────────────────────────────────────────────


@app.get("/api/market/search")
async def look_up_tickers(q: str = Query(..., min_length=1)):
    """
    Queries yfinance autocomplete matching the text block.
    Uses safe fallback mapping to eliminate 500 failures inside isolated containers.
    """
    query_str = q.strip().upper()
    if not query_str:
        return []

    try:
        # Use yfinance Search wrapper safely
        search_engine = yf.Search(query_str, max_results=8)
        results = getattr(search_engine, 'results', []) or []

        filtered_suggestions = []
        for match in results:
            if not isinstance(match, dict):
                continue

            # Defensively extract info with default fallbacks
            quote_type = match.get('quoteType', 'EQUITY')
            if quote_type in ['EQUITY', 'ETF', 'INDEX']:
                ticker = match.get('symbol')
                if not ticker:
                    continue

                name = (
                    match.get('shortname') or
                    match.get('longname') or
                    match.get('name') or
                    f"{ticker} ASSET NODE"
                )

                filtered_suggestions.append({
                    "ticker": ticker,
                    "company_name": name,
                    "exchange": match.get('exchDisp', 'INTL'),
                    "type": quote_type
                })

        # Fallback: If yfinance search endpoints are throttled, provide a direct matching node
        if not filtered_suggestions and len(query_str) >= 2:
            filtered_suggestions.append({
                "ticker": query_str,
                "company_name": f"{query_str} SYSTEM TRACK TARGET",
                "exchange": "NSE/BSE",
                "type": "EQUITY"
            })

        return filtered_suggestions

    except Exception as e:
        print(f"[SEARCH ERROR LOG] Ticker parsing bypass triggered: {str(e)}")
        # Safe structural fallback to prevent UI 500 error blips
        return [{
            "ticker": query_str,
            "company_name": f"{query_str} TRACK TARGET",
            "exchange": "MARKET ENGINE",
            "type": "EQUITY"
        }]


class ProfileUpdateRequest(BaseModel):
    name: str
    email: str
    password: Optional[str] = None


@app.put("/api/user/profile")
async def update_supabase_user_auth(
    payload: ProfileUpdateRequest,
    x_user_id: str = Header(..., alias="X-User-Id")
):
    """
    Updates the target user's metadata attributes and credentials directly inside
    the Supabase Auth management layers using the Admin API framework.
    """
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise HTTPException(
            status_code=500,
            detail="Supabase infrastructure connection variables are not defined on the host container environment."
        )

    # Core endpoint for Admin User updating rules
    admin_auth_url = f"{SUPABASE_URL}/auth/v1/admin/users/{x_user_id}"
    headers = {
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "apikey": SUPABASE_SERVICE_KEY,
        "Content-Type": "application/json"
    }

    # Map name cleanly inside user_metadata matching standard Supabase conventions
    update_data = {
        "email": payload.email,
        "user_metadata": {
            "display_name": payload.name,
            "full_name": payload.name
        }
    }

    if payload.password and payload.password.strip():
        update_data["password"] = payload.password.strip()

    async with httpx.AsyncClient() as client:
        try:
            response = await client.put(admin_auth_url, json=update_data, headers=headers)
            if response.status_code != 200:
                error_info = response.json()
                raise HTTPException(
                    status_code=response.status_code,
                    detail=error_info.get(
                        "msg") or "Supabase Auth rejected metadata adjustment mapping."
                )

            return {"status": "success", "message": "Supabase identity profile updated successfully."}

        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=503,
                detail=f"Connection failure to remote Supabase server: {str(exc)}"
            )
