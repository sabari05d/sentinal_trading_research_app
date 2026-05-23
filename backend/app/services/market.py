import asyncio
import numpy as np
import yfinance as yf
from fastapi import HTTPException


def _calculate_rsi(prices: list, period: int = 14) -> float:
    """Standard Wilder's RSI calculation."""
    if len(prices) < period + 1:
        return 50.0
    deltas = np.diff(prices)
    gains = np.where(deltas > 0, deltas, 0.0)
    losses = np.where(deltas < 0, -deltas, 0.0)
    avg_gain = np.mean(gains[:period])
    avg_loss = np.mean(losses[:period])
    for i in range(period, len(deltas)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return round(100.0 - (100.0 / (1.0 + rs)), 2)


def _calculate_ema(prices: list, period: int) -> float:
    """Exponential Moving Average — standard multiplier method."""
    if len(prices) < period:
        return round(float(np.mean(prices)), 2)
    multiplier = 2.0 / (period + 1)
    ema = float(np.mean(prices[:period]))
    for price in prices[period:]:
        ema = (price - ema) * multiplier + ema
    return round(ema, 2)


def _calculate_atr(hist, period: int = 14) -> float:
    """Average True Range for volatility measurement."""
    highs = hist['High'].tolist()
    lows = hist['Low'].tolist()
    closes = hist['Close'].tolist()
    if len(closes) < period + 1:
        return 0.0
    true_ranges = []
    for i in range(1, len(closes)):
        tr = max(
            highs[i] - lows[i],
            abs(highs[i] - closes[i - 1]),
            abs(lows[i] - closes[i - 1])
        )
        true_ranges.append(tr)
    atr = float(np.mean(true_ranges[-period:]))
    return round(atr, 2)


def _calculate_bollinger_bands(prices: list, period: int = 20, std_dev: float = 2.0):
    """Standard Bollinger Bands: SMA ± (std_dev * σ)."""
    if len(prices) < period:
        p = float(np.mean(prices))
        return round(p, 2), round(p, 2), round(p, 2)
    window = prices[-period:]
    middle = float(np.mean(window))
    sigma = float(np.std(window))
    upper = middle + std_dev * sigma
    lower = middle - std_dev * sigma
    return round(upper, 2), round(middle, 2), round(lower, 2)


def _calculate_macd(prices: list):
    """MACD line, Signal line, and histogram."""
    if len(prices) < 26:
        return 0.0, 0.0, 0.0
    ema12 = _calculate_ema(prices, 12)
    ema26 = _calculate_ema(prices, 26)
    macd_line = round(ema12 - ema26, 4)
    # Signal: 9-period EMA of MACD — approximate with a rolling window
    # Build a MACD series for the last 35 candles minimum
    if len(prices) < 35:
        return macd_line, 0.0, macd_line
    macd_series = []
    for i in range(26, len(prices) + 1):
        e12 = _calculate_ema(prices[:i], 12)
        e26 = _calculate_ema(prices[:i], 26)
        macd_series.append(e12 - e26)
    signal_line = round(_calculate_ema(macd_series, 9), 4)
    histogram = round(macd_line - signal_line, 4)
    return macd_line, signal_line, histogram


class MarketService:
    @staticmethod
    async def fetch_historical_dataset(ticker: str, period: str = "3m"):
        """Downloads historical data and calculates full quantitative metrics suite."""
        symbol = ticker.strip().upper()
        if not (symbol.endswith(".NS") or symbol.endswith(".BO")):
            symbol = f"{symbol}.NS"

        period_mapping = {"1m": "1mo", "3m": "3mo", "6m": "6mo", "1y": "1y"}
        yf_period = period_mapping.get(period, "3mo")

        try:
            ticker_obj = yf.Ticker(symbol)
            hist = await asyncio.get_event_loop().run_in_executor(
                None, lambda: ticker_obj.history(
                    period=yf_period, interval="1d")
            )

            if hist.empty:
                raise HTTPException(
                    status_code=404, detail=f"No asset streams available for {symbol}.")

            prices = hist['Close'].dropna().tolist()
            volumes = hist['Volume'].dropna().tolist()
            dates = [d.strftime('%Y-%m-%d') for d in hist.index]

            if len(prices) < 10:
                raise HTTPException(
                    status_code=400, detail="Insufficient chronological timeline intervals.")

            current_price = round(prices[-1], 2)
            start_price = prices[0]
            percentage_change = round(
                ((current_price - start_price) / start_price) * 100, 2)
            highest_high = round(float(hist['High'].max()), 2)
            lowest_low = round(float(hist['Low'].min()), 2)

            # SMA-50 and SMA-20
            sma_50 = round(float(np.mean(
                prices[-50:])), 2) if len(prices) >= 50 else round(float(np.mean(prices)), 2)
            sma_20 = round(float(np.mean(
                prices[-20:])), 2) if len(prices) >= 20 else round(float(np.mean(prices)), 2)

            # EMA-20 and EMA-50
            ema_20 = _calculate_ema(prices, 20)
            ema_50 = _calculate_ema(prices, 50)

            # RSI-14
            rsi_14 = _calculate_rsi(prices, 14)

            # ATR-14
            atr_14 = _calculate_atr(hist, 14)

            # Bollinger Bands (20-period, 2σ)
            bb_upper, bb_middle, bb_lower = _calculate_bollinger_bands(
                prices, 20)

            # MACD
            macd_line, macd_signal, macd_hist = _calculate_macd(prices)

            # Volume metrics
            avg_volume_20 = int(
                np.mean(volumes[-20:])) if len(volumes) >= 20 else int(np.mean(volumes))
            current_volume = int(volumes[-1]) if volumes else 0
            relative_volume = round(
                current_volume / avg_volume_20, 2) if avg_volume_20 > 0 else 1.0

            # Drawdown Matrix
            peak = prices[0]
            max_dd = 0.0
            for p in prices:
                if p > peak:
                    peak = p
                dd = (p - peak) / peak
                if dd < max_dd:
                    max_dd = dd

            # Price position within Bollinger Bands (0-100 scale)
            bb_range = bb_upper - bb_lower
            bb_position = round(
                ((current_price - bb_lower) / bb_range) * 100, 1) if bb_range > 0 else 50.0

            return {
                "symbol": symbol,
                "prices": prices,
                "volumes": volumes,
                "dates": dates,
                "metrics": {
                    "initial_value": round(start_price, 2),
                    "current_value": current_price,
                    "net_change": round(current_price - start_price, 2),
                    "percent_change": percentage_change,
                    "interval_high": highest_high,
                    "interval_low": lowest_low,
                    "max_drawdown": round(max_dd * 100, 2),
                    # Moving averages
                    "sma_20": sma_20,
                    "sma_50": sma_50,
                    "ema_20": ema_20,
                    "ema_50": ema_50,
                    # Momentum & oscillators
                    "rsi_14": rsi_14,
                    "macd_line": macd_line,
                    "macd_signal": macd_signal,
                    "macd_histogram": macd_hist,
                    # Volatility
                    "atr_14": atr_14,
                    "bb_upper": bb_upper,
                    "bb_middle": bb_middle,
                    "bb_lower": bb_lower,
                    "bb_position": bb_position,
                    # Volume
                    "avg_volume_20": avg_volume_20,
                    "current_volume": current_volume,
                    "relative_volume": relative_volume,
                }
            }
        except Exception as e:
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(
                status_code=500, detail=f"Market Extraction Fault: {str(e)}")
