import numpy as np
from google import genai
from google.genai import types

try:
    ai_client = genai.Client()
except Exception:
    ai_client = None


class PredictionEngine:

    @staticmethod
    def forecast_price_trajectory(prices: list, volumes: list, steps: int = 5) -> list:
        """
        Multi-signal trajectory forecast blending:
        1. Linear regression (trend baseline)
        2. EMA momentum (exponential smoothing)
        3. Volume-weighted velocity factor
        4. Mean reversion pull toward recent EMA
        """
        n = len(prices)
        x = np.arange(n)
        y = np.array(prices)

        # --- Signal 1: OLS Linear Trend ---
        slope, intercept = np.polyfit(x, y, 1)

        # --- Signal 2: EMA-10 Momentum ---
        ema_period = min(10, n)
        multiplier = 2.0 / (ema_period + 1)
        ema = float(np.mean(y[:ema_period]))
        for p in y[ema_period:]:
            ema = (p - ema) * multiplier + ema
        ema_20_mult = 2.0 / 21
        ema20 = float(np.mean(y[:min(20, n)]))
        for p in y[min(20, n):]:
            ema20 = (p - ema20) * ema_20_mult + ema20

        # --- Signal 3: Volume velocity factor ---
        vol_arr = np.array(volumes) if volumes else np.ones(n)
        avg_vol = np.mean(vol_arr[-10:]) if n >= 10 else np.mean(vol_arr)
        recent_vol = np.mean(vol_arr[-3:]) if n >= 3 else vol_arr[-1]
        vol_multiplier = 1.0 + \
            ((recent_vol - avg_vol) / (avg_vol + 1e-8)) * 0.04
        vol_multiplier = float(np.clip(vol_multiplier, 0.90, 1.10))

        # --- Signal 4: Recent momentum (last 5 candles) ---
        recent_window = min(5, n)
        recent_slope = (y[-1] - y[-recent_window]) / \
            recent_window if recent_window > 1 else slope

        # --- Signal 5: ATR-based noise bound ---
        # Use standard deviation of last 14 candles as a proxy for ATR
        atr_proxy = float(np.std(y[-14:])) if n >= 14 else float(np.std(y))

        # --- Blend weights ---
        # Linear trend: 25%, EMA reversion: 30%, recent momentum: 35%, random drift: 10%
        forecasted_track = []
        last_price = float(y[-1])
        running_ema = ema

        for i in range(1, steps + 1):
            linear_proj = (slope * (n + i)) + intercept
            # EMA evolves forward
            running_ema = (last_price - running_ema) * multiplier + running_ema
            # Blend
            blended = (
                0.25 * linear_proj
                + 0.30 * running_ema
                + 0.35 * (last_price + recent_slope * vol_multiplier)
                + 0.10 * (ema20)  # macro mean pull
            )
            # Dampen volatility progressively (uncertainty grows over time)
            damping = 1.0 - (i * 0.04)
            blended = last_price + (blended - last_price) * max(damping, 0.60)

            forecasted_track.append(round(float(blended), 2))
            last_price = blended

        return forecasted_track

    @staticmethod
    def compute_statistical_bounds(prices: list, current_price: float, atr: float) -> tuple:
        """
        Fallback statistical bounds using ATR-based channel expansion.
        More accurate than raw std-dev because ATR accounts for gap risk.
        """
        recent_prices = prices[-20:] if len(prices) >= 20 else prices
        sma = float(np.mean(recent_prices))
        # positive = above average (bullish bias)
        momentum_bias = current_price - sma

        # ATR-based dynamic channel (1.8x ATR = typical 5-day swing range)
        channel_width = atr * \
            1.8 if atr > 0 else float(np.std(recent_prices)) * 1.5

        upper = current_price + channel_width + (momentum_bias * 0.2)
        lower = current_price - channel_width + (momentum_bias * 0.2)
        return round(upper, 2), round(lower, 2)

    @staticmethod
    async def evaluate_range_boundaries(symbol: str, current_price: float, metrics: dict):
        """
        Consults Gemini with full technical context for boundary risk calculations.
        Returns (upper_limit, lower_limit) or None if unavailable.
        """
        if not ai_client:
            return None

        try:
            system_instructions = (
                "You are a quantitative risk engine inside the Sentinal trading system. "
                "Using the provided technical metrics, calculate precise upper and lower price boundaries "
                "for the next 5 trading sessions. "
                "Account for RSI overbought/oversold conditions, Bollinger Band squeeze or expansion, "
                "MACD momentum direction, ATR volatility, and relative volume. "
                "Respond ONLY with two numbers separated by a comma: upper,lower "
                "(e.g., 2540.50,2410.20). No text, no symbols, no explanation."
            )

            rsi = metrics.get("rsi_14", 50)
            atr = metrics.get("atr_14", 0)
            bb_upper = metrics.get("bb_upper", current_price)
            bb_lower = metrics.get("bb_lower", current_price)
            bb_pos = metrics.get("bb_position", 50)
            macd_hist = metrics.get("macd_histogram", 0)
            rel_vol = metrics.get("relative_volume", 1.0)
            ema_20 = metrics.get("ema_20", current_price)
            sma_50 = metrics.get("sma_50", current_price)

            prompt = (
                f"Symbol: {symbol} | Price: {current_price} | "
                f"Period High: {metrics.get('interval_high')} | Period Low: {metrics.get('interval_low')} | "
                f"Change: {metrics.get('percent_change')}% | "
                f"RSI-14: {rsi} | ATR-14: {atr} | "
                f"Bollinger Upper: {bb_upper} | Bollinger Lower: {bb_lower} | BB Position: {bb_pos}% | "
                f"MACD Histogram: {macd_hist} | EMA-20: {ema_20} | SMA-50: {sma_50} | "
                f"Relative Volume: {rel_vol}x | Max Drawdown: {metrics.get('max_drawdown')}%"
            )

            import asyncio
            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: ai_client.models.generate_content(
                    model='gemini-2.5-flash',
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=system_instructions,
                        temperature=0.05  # Near-deterministic for financial ranges
                    )
                )
            )
            if response.text:
                raw = response.text.strip().replace("₹", "").replace(" ", "")
                parts = raw.split(",")
                if len(parts) == 2:
                    up, down = float(parts[0]), float(parts[1])
                    # Sanity check: bounds should be within ±30% of current price
                    if abs(up - current_price) / current_price < 0.30 and abs(down - current_price) / current_price < 0.30:
                        return round(up, 2), round(down, 2)
        except Exception:
            return None
