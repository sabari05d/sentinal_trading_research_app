"use client";

import { useEffect, useState, useCallback } from "react";

// ─── RSI Gauge Colors ─────────────────────────────────────────────────────────
function getRsiColor(rsi) {
    if (rsi >= 70) return { text: "text-rose-400", bg: "bg-rose-950/40", border: "border-rose-900/40", label: "OVERBOUGHT" };
    if (rsi <= 30) return { text: "text-emerald-400", bg: "bg-emerald-950/40", border: "border-emerald-900/40", label: "OVERSOLD" };
    return { text: "text-amber-400", bg: "bg-amber-950/40", border: "border-amber-900/40", label: "NEUTRAL" };
}

function getVolLabel(signal) {
    if (signal === "ABOVE_AVERAGE") return { text: "text-emerald-400", label: "ABOVE AVG" };
    if (signal === "BELOW_AVERAGE") return { text: "text-rose-400", label: "BELOW AVG" };
    return { text: "text-zinc-400", label: "AVERAGE" };
}

// ─── Metric Row ───────────────────────────────────────────────────────────────
function MetricRow({ label, value, valueClass = "text-zinc-300" }) {
    return (
        <div className="flex justify-between items-center p-2.5 rounded-lg bg-zinc-900/40 border border-zinc-900">
            <span className="text-zinc-500 font-bold text-[10px] tracking-wider">{label}</span>
            <span className={`font-black font-mono ${valueClass}`}>{value}</span>
        </div>
    );
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ color = "bg-zinc-700", label }) {
    return (
        <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-black tracking-widest uppercase">
            <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
            {label}
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function StockDetailCanvas({ isOpen, onClose, stock }) {
    const [mounted, setMounted] = useState(false);
    const [intervalFilter, setIntervalFilter] = useState("3m");
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

    useEffect(() => {
        if (isOpen) {
            setMounted(true);
        } else {
            const timer = setTimeout(() => setMounted(false), 350);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    const fetchAnalytics = useCallback(async (ticker, period) => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_URL}/api/watchlist/${ticker}/analytics?period=${period}`);
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || `HTTP ${res.status}`);
            }
            setAnalytics(await res.json());
        } catch (err) {
            console.error("Analytics fetch error:", err);
            setError(err.message || "Failed to load analytics data.");
        } finally {
            setLoading(false);
        }
    }, [API_URL]);

    useEffect(() => {
        if (isOpen && stock?.ticker) {
            fetchAnalytics(stock.ticker, intervalFilter);
        }
    }, [isOpen, stock, intervalFilter, fetchAnalytics]);

    if (!isOpen && !mounted) return null;

    const perf = analytics?.performance;
    const bounds = analytics?.predictive_boundaries;
    const trend = analytics?.moving_averages;
    const chart = analytics?.chart_data;
    const osc = analytics?.oscillators;
    const vol = analytics?.volatility;
    const volume = analytics?.volume;

    const currentPrice = perf?.current_value ?? 0;
    const initialPrice = perf?.initial_value ?? 0;
    const isBullish = currentPrice >= (trend?.sma_50 ?? 0);
    const velocityTrend = currentPrice >= initialPrice;
    const rsiColors = getRsiColor(osc?.rsi_14 ?? 50);
    const volColors = getVolLabel(volume?.volume_signal);

    return (
        <div className="fixed inset-0 z-50 flex overflow-hidden font-mono text-xs select-none">
            {/* Backdrop */}
            <div
                className={`absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0"}`}
                onClick={onClose}
            />

            {/* Panel */}
            <div className={`relative flex h-full w-[92vw] max-w-7xl flex-col border-l border-zinc-800 bg-zinc-950 text-zinc-100 shadow-2xl transition-transform duration-300 ease-in-out ml-auto ${isOpen ? "translate-x-0" : "translate-x-full"}`}>

                {/* ── TOP BAR ── */}
                <div className="flex h-16 items-center justify-between border-b border-zinc-900 bg-zinc-950 px-6">
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <span className="text-xl font-black tracking-tight text-white">{stock?.ticker}</span>
                                <span className={`h-2 w-2 rounded-full ${loading ? "bg-amber-400 animate-ping" : "bg-emerald-400"}`} />
                            </div>
                            <span className="text-[10px] text-zinc-500 font-sans tracking-wide mt-0.5">
                                {stock?.company_name || "NSE EQUITY"}
                            </span>
                        </div>
                    </div>

                    {/* Period filter */}
                    <div className="flex items-center gap-1.5 border border-zinc-900 rounded-xl p-1 bg-zinc-950/80">
                        {["1m", "3m", "6m", "1y"].map((p) => (
                            <button
                                key={p}
                                onClick={() => setIntervalFilter(p)}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${intervalFilter === p
                                    ? "bg-zinc-800 text-emerald-400 border border-zinc-700/50 shadow-inner"
                                    : "text-zinc-500 hover:text-zinc-300"
                                    }`}
                            >
                                {p === "1m" ? "30D" : p === "3m" ? "90D" : p === "6m" ? "6M" : "1Y"}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={onClose}
                        className="rounded-lg border border-zinc-900 bg-zinc-950 px-4 py-2 hover:bg-zinc-900 hover:text-white text-[10px] font-bold tracking-widest text-zinc-400 transition-colors cursor-pointer"
                    >
                        [ESC] CLOSE
                    </button>
                </div>

                {/* ── CONTENT ── */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gradient-to-b from-zinc-950 to-zinc-900/40">

                    {loading ? (
                        <div className="flex h-96 flex-col items-center justify-center text-zinc-600 gap-3">
                            <div className="h-5 w-5 border-2 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin" />
                            <span className="tracking-widest animate-pulse">[PARSING SENTINAL QUANT MATRIX...]</span>
                        </div>
                    ) : error ? (
                        <div className="flex h-96 flex-col items-center justify-center text-rose-500 gap-3">
                            <span className="text-2xl">⚠</span>
                            <span className="tracking-widest font-bold">[FEED ERROR]</span>
                            <span className="text-zinc-500 font-sans text-[11px]">{error}</span>
                            <button
                                onClick={() => fetchAnalytics(stock?.ticker, intervalFilter)}
                                className="mt-2 border border-zinc-800 px-4 py-2 rounded-lg text-[10px] text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
                            >
                                RETRY
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* ══ PHASE I: PERFORMANCE OVERVIEW ══ */}
                            <div className="space-y-3">
                                <SectionHeader color="bg-zinc-700" label="Phase I: Retrospective Performance Metrics" />
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                    <div className="rounded-xl border border-zinc-900/80 bg-zinc-950 p-4 relative overflow-hidden">
                                        <span className="text-[10px] text-zinc-500 block font-bold tracking-wider">INTERVAL NET DELTA</span>
                                        <span className={`text-xl font-black tracking-tight block mt-1.5 ${perf?.net_change >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                            {perf?.net_change >= 0 ? "▲" : "▼"} ₹{perf?.net_change ? Math.abs(perf.net_change).toFixed(2) : "0.00"}
                                        </span>
                                        <span className={`text-[10px] font-black mt-1 block ${perf?.percent_change >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                                            {perf?.percent_change >= 0 ? "+" : ""}{perf?.percent_change}%
                                        </span>
                                    </div>
                                    <div className="rounded-xl border border-zinc-900/80 bg-zinc-950 p-4">
                                        <span className="text-[10px] text-zinc-500 block font-bold tracking-wider">PERIOD HIGH</span>
                                        <span className="text-xl font-black text-zinc-100 tracking-tight block mt-1.5">₹{perf?.interval_high?.toFixed(2) ?? "—"}</span>
                                        <span className="text-[9px] text-zinc-500 mt-1 block font-sans">Resistance ceiling</span>
                                    </div>
                                    <div className="rounded-xl border border-zinc-900/80 bg-zinc-950 p-4">
                                        <span className="text-[10px] text-zinc-500 block font-bold tracking-wider">PERIOD LOW</span>
                                        <span className="text-xl font-black text-zinc-100 tracking-tight block mt-1.5">₹{perf?.interval_low?.toFixed(2) ?? "—"}</span>
                                        <span className="text-[9px] text-zinc-500 mt-1 block font-sans">Demand support zone</span>
                                    </div>
                                    <div className="rounded-xl border border-zinc-900/80 bg-zinc-950 p-4">
                                        <span className="text-[10px] text-zinc-500 block font-bold tracking-wider">MAX DRAWDOWN</span>
                                        <span className="text-xl font-black text-rose-400 tracking-tight block mt-1.5">{perf?.max_drawdown}%</span>
                                        <span className="text-[9px] text-zinc-500 mt-1 block font-sans">Peak-to-trough decline</span>
                                    </div>
                                </div>
                            </div>

                            {/* ══ PHASE II: CHART + SIGNALS ══ */}
                            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

                                {/* Chart */}
                                <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-5 lg:col-span-2 space-y-4">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-900">
                                        <div>
                                            <h4 className="text-xs font-black tracking-wider text-zinc-300 uppercase">Price Trajectory + Bollinger Bands</h4>
                                            <p className="text-[9px] text-zinc-500 mt-0.5 font-sans">30-session history → 5-session AI forecast</p>
                                        </div>
                                        <div className="flex items-center gap-3 text-[9px] font-black">
                                            <div className="flex items-center gap-1.5">
                                                <span className="h-2 w-2 rounded-sm bg-zinc-600 block" />
                                                <span className="text-zinc-400">HISTORY</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="h-2 w-2 rounded-sm bg-emerald-400 block animate-pulse" />
                                                <span className="text-emerald-400">FORECAST</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="h-2 w-2 rounded-sm bg-purple-500/60 block" />
                                                <span className="text-purple-400">BB BANDS</span>
                                            </div>
                                        </div>
                                    </div>

                                    {chart ? (
                                        <div className="w-full relative pt-2">
                                            <svg viewBox="0 0 500 170" className="w-full h-48 overflow-visible">
                                                <defs>
                                                    <linearGradient id="histGradient" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="0%" stopColor="#3f3f46" stopOpacity="0.15" />
                                                        <stop offset="100%" stopColor="#09090b" stopOpacity="0.0" />
                                                    </linearGradient>
                                                    <linearGradient id="predGradient" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="0%" stopColor="#34d399" stopOpacity="0.18" />
                                                        <stop offset="100%" stopColor="#09090b" stopOpacity="0.0" />
                                                    </linearGradient>
                                                    <linearGradient id="bbGradient" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="0%" stopColor="#a855f7" stopOpacity="0.06" />
                                                        <stop offset="100%" stopColor="#a855f7" stopOpacity="0.02" />
                                                    </linearGradient>
                                                </defs>

                                                {(() => {
                                                    const hist = chart.historical_prices || [];
                                                    const pred = chart.predicted_prices || [];
                                                    const bbUp = chart.bb_upper_series || [];
                                                    const bbLo = chart.bb_lower_series || [];
                                                    const totalPoints = hist.length + pred.length;
                                                    if (totalPoints === 0) return null;

                                                    const allVals = [...hist, ...pred, ...bbUp, ...bbLo].filter(Boolean);
                                                    const minPrice = Math.min(...allVals) * 0.985;
                                                    const maxPrice = Math.max(...allVals) * 1.015;
                                                    const priceRange = maxPrice - minPrice || 1;

                                                    const toY = (p) => 155 - ((p - minPrice) / priceRange) * 140 - 5;
                                                    const toX = (i) => (i / (totalPoints - 1)) * 500;

                                                    // Bollinger band area
                                                    let bbUpperPath = "";
                                                    let bbLowerPath = "";
                                                    bbUp.forEach((p, i) => { bbUpperPath += `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(p)} `; });
                                                    bbLo.forEach((p, i) => { bbLowerPath += `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(p)} `; });
                                                    const bbArea = bbUpperPath + bbLo.slice().reverse().map((p, i) => `L ${toX(bbLo.length - 1 - i)} ${toY(p)}`).join(" ") + " Z";

                                                    let histPath = "";
                                                    hist.forEach((p, i) => { histPath += `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(p)} `; });

                                                    const lastHistIdx = hist.length - 1;
                                                    const startX = toX(lastHistIdx);
                                                    const startY = toY(hist[lastHistIdx]);
                                                    let predPath = `M ${startX} ${startY} `;
                                                    pred.forEach((p, i) => { predPath += `L ${toX(lastHistIdx + 1 + i)} ${toY(p)} `; });

                                                    const histArea = `${histPath} L ${startX} 160 L 0 160 Z`;

                                                    // Y-axis price labels
                                                    const midPrice = (minPrice + maxPrice) / 2;
                                                    const yLabels = [maxPrice, midPrice, minPrice];

                                                    return (
                                                        <>
                                                            {/* Grid lines */}
                                                            {[0.1, 0.5, 0.9].map((f, i) => (
                                                                <line key={i} x1="0" y1={5 + f * 150} x2="500" y2={5 + f * 150}
                                                                    stroke="#18181b" strokeWidth="1" strokeDasharray="4,4" />
                                                            ))}

                                                            {/* Y-axis labels */}
                                                            {yLabels.map((price, i) => (
                                                                <text key={i} x="2" y={toY(price) - 2}
                                                                    fill="#52525b" fontSize="7" fontFamily="monospace">
                                                                    ₹{price.toFixed(0)}
                                                                </text>
                                                            ))}

                                                            {/* Bollinger Band fill */}
                                                            {bbArea && <path d={bbArea} fill="url(#bbGradient)" />}

                                                            {/* Bollinger Band lines */}
                                                            {bbUp.length > 0 && (
                                                                <path d={bbUpperPath} fill="none"
                                                                    stroke="#a855f7" strokeWidth="0.8"
                                                                    strokeDasharray="3,3" strokeOpacity="0.5" />
                                                            )}
                                                            {bbLo.length > 0 && (
                                                                <path d={bbLowerPath} fill="none"
                                                                    stroke="#a855f7" strokeWidth="0.8"
                                                                    strokeDasharray="3,3" strokeOpacity="0.5" />
                                                            )}

                                                            {/* History area fill */}
                                                            {histArea && <path d={histArea} fill="url(#histGradient)" />}

                                                            {/* History line */}
                                                            <path d={histPath} fill="none"
                                                                stroke="#52525b" strokeWidth="1.5"
                                                                strokeLinecap="round" strokeLinejoin="round" />

                                                            {/* Transition divider */}
                                                            <line x1={startX} y1="0" x2={startX} y2="160"
                                                                stroke="#27272a" strokeWidth="1" strokeDasharray="2,2" />

                                                            {/* Forecast line */}
                                                            <path d={predPath} fill="none"
                                                                stroke="#10b981" strokeWidth="2.5"
                                                                strokeLinecap="round" strokeLinejoin="round"
                                                                strokeDasharray="3,2" />

                                                            {/* Forecast dots with price labels */}
                                                            {pred.map((p, i) => {
                                                                const cx = toX(lastHistIdx + 1 + i);
                                                                const cy = toY(p);
                                                                return (
                                                                    <g key={i}>
                                                                        <circle cx={cx} cy={cy} r="3"
                                                                            fill="#10b981" stroke="#09090b" strokeWidth="1.5" />
                                                                        <text x={cx} y={cy - 7}
                                                                            fill="#6ee7b7" fontSize="6.5"
                                                                            textAnchor="middle" fontFamily="monospace">
                                                                            ₹{p.toFixed(1)}
                                                                        </text>
                                                                    </g>
                                                                );
                                                            })}

                                                            {/* Current price anchor dot */}
                                                            <circle cx={startX} cy={startY} r="4"
                                                                fill="#34d399" stroke="#09090b" strokeWidth="2.5" />
                                                        </>
                                                    );
                                                })()}
                                            </svg>

                                            <div className="flex justify-between items-center text-[8px] text-zinc-600 font-bold pt-2 border-t border-zinc-900 mt-2">
                                                <span>{chart.historical_labels?.[0] || "PERIOD START"}</span>
                                                <span className="text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded font-mono">NOW → T+5</span>
                                                <span>{chart.future_labels?.[chart.future_labels.length - 1] || "T+5"}</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="h-48 bg-zinc-900/10 border border-zinc-900 rounded-xl flex items-center justify-center text-zinc-700 font-bold">
                                            [NO DATA]
                                        </div>
                                    )}
                                </div>

                                {/* Signal Panel */}
                                <div className="space-y-4 lg:col-span-1">
                                    <SectionHeader color="bg-emerald-500" label="Phase II: Live Signal Telemetry" />

                                    <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-4 space-y-3">
                                        <MetricRow
                                            label="CURRENT PRICE"
                                            value={`₹${currentPrice.toFixed(2)}`}
                                            valueClass="text-white"
                                        />
                                        <MetricRow label="SMA-20" value={`₹${trend?.sma_20?.toFixed(2) ?? "—"}`} />
                                        <MetricRow label="SMA-50" value={`₹${trend?.sma_50?.toFixed(2) ?? "—"}`} />
                                        <MetricRow label="EMA-20" value={`₹${trend?.ema_20?.toFixed(2) ?? "—"}`} />
                                        <MetricRow label="EMA-50" value={`₹${trend?.ema_50?.toFixed(2) ?? "—"}`} />

                                        <div className="flex justify-between items-center p-2.5 rounded-lg bg-zinc-900/40 border border-zinc-900">
                                            <span className="text-zinc-500 font-bold text-[10px] tracking-wider">MACRO TREND</span>
                                            <span className={`font-black px-2 py-0.5 rounded text-[9px] tracking-widest ${isBullish ? "text-emerald-400 bg-emerald-950/40 border border-emerald-900/40" : "text-amber-400 bg-amber-950/40 border border-amber-900/40"}`}>
                                                {trend?.macro_trend ?? "—"}
                                            </span>
                                        </div>

                                        <div className="flex justify-between items-center p-2.5 rounded-lg bg-zinc-900/40 border border-zinc-900">
                                            <span className="text-zinc-500 font-bold text-[10px] tracking-wider">EMA ALIGNMENT</span>
                                            <span className={`font-black text-[9px] tracking-wider ${trend?.ema_trend === "BULLISH_ALIGNMENT" ? "text-emerald-400" : "text-rose-400"}`}>
                                                {trend?.ema_trend ?? "—"}
                                            </span>
                                        </div>

                                        <div className="flex justify-between items-center p-2.5 rounded-lg bg-zinc-900/40 border border-zinc-900">
                                            <span className="text-zinc-500 font-bold text-[10px] tracking-wider">MOMENTUM</span>
                                            <span className={`font-black tracking-wider text-[9px] ${velocityTrend ? "text-emerald-400" : "text-rose-400"}`}>
                                                {velocityTrend ? "ACCELERATING" : "RETRACTING"}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* ══ PHASE III: OSCILLATORS + VOLATILITY + VOLUME ══ */}
                            <div className="space-y-3">
                                <SectionHeader color="bg-amber-500" label="Phase III: Oscillators · Volatility · Volume" />

                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

                                    {/* RSI */}
                                    <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-4 space-y-3">
                                        <div className="flex justify-between items-center border-b border-zinc-900 pb-2">
                                            <span className="text-[10px] font-black text-zinc-400 tracking-wider">RSI-14</span>
                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded ${rsiColors.text} ${rsiColors.bg} border ${rsiColors.border}`}>
                                                {rsiColors.label}
                                            </span>
                                        </div>
                                        <div className="text-2xl font-black font-mono text-white">{osc?.rsi_14 ?? "—"}</div>
                                        {/* RSI bar */}
                                        <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all ${(osc?.rsi_14 ?? 0) >= 70 ? "bg-rose-500" : (osc?.rsi_14 ?? 0) <= 30 ? "bg-emerald-500" : "bg-amber-400"}`}
                                                style={{ width: `${Math.min(osc?.rsi_14 ?? 0, 100)}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-between text-[8px] text-zinc-600">
                                            <span>OS 30</span><span>NEUTRAL</span><span>OB 70</span>
                                        </div>
                                    </div>

                                    {/* MACD */}
                                    <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-4 space-y-3">
                                        <div className="flex justify-between items-center border-b border-zinc-900 pb-2">
                                            <span className="text-[10px] font-black text-zinc-400 tracking-wider">MACD</span>
                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded ${(osc?.macd_histogram ?? 0) > 0 ? "text-emerald-400 bg-emerald-950/40 border border-emerald-900/40" : "text-rose-400 bg-rose-950/40 border border-rose-900/40"}`}>
                                                {osc?.macd_bias ?? "—"}
                                            </span>
                                        </div>
                                        <MetricRow label="MACD LINE" value={(osc?.macd_line ?? 0).toFixed(3)} />
                                        <MetricRow label="SIGNAL" value={(osc?.macd_signal ?? 0).toFixed(3)} />
                                        <div className="flex justify-between items-center p-2.5 rounded-lg bg-zinc-900/40 border border-zinc-900">
                                            <span className="text-zinc-500 font-bold text-[10px]">HISTOGRAM</span>
                                            <span className={`font-black font-mono ${(osc?.macd_histogram ?? 0) > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                                {(osc?.macd_histogram ?? 0) > 0 ? "+" : ""}{(osc?.macd_histogram ?? 0).toFixed(3)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* ATR + Volume */}
                                    <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-4 space-y-3">
                                        <div className="text-[10px] font-black text-zinc-400 tracking-wider border-b border-zinc-900 pb-2">
                                            VOLATILITY · VOLUME
                                        </div>
                                        <MetricRow label="ATR-14" value={`₹${vol?.atr_14?.toFixed(2) ?? "—"}`} />
                                        <MetricRow label="ATR %" value={`${vol?.atr_pct ?? "—"}%`} valueClass={
                                            vol?.volatility_label === "HIGH" ? "text-rose-400" :
                                                vol?.volatility_label === "MODERATE" ? "text-amber-400" : "text-emerald-400"
                                        } />
                                        <MetricRow
                                            label="VOLATILITY"
                                            value={vol?.volatility_label ?? "—"}
                                            valueClass={vol?.volatility_label === "HIGH" ? "text-rose-400" : vol?.volatility_label === "MODERATE" ? "text-amber-400" : "text-emerald-400"}
                                        />
                                        <div className="pt-1 border-t border-zinc-900 space-y-2">
                                            <MetricRow
                                                label="REL. VOLUME"
                                                value={`${volume?.relative_volume ?? "—"}x`}
                                                valueClass={volColors.text}
                                            />
                                            <MetricRow label="VOL SIGNAL" value={volColors.label} valueClass={volColors.text} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* ══ PHASE IV: BOLLINGER BANDS ══ */}
                            <div className="space-y-3">
                                <SectionHeader color="bg-purple-500" label="Phase IV: Bollinger Band Position (20-Period, 2σ)" />
                                <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-5 space-y-4">
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="text-center p-3 rounded-lg border border-purple-900/40 bg-purple-950/10">
                                            <span className="text-[9px] text-zinc-500 block font-bold">UPPER BAND</span>
                                            <span className="text-base font-black text-purple-300 block mt-1">₹{vol?.bb_upper?.toFixed(2) ?? "—"}</span>
                                        </div>
                                        <div className="text-center p-3 rounded-lg border border-zinc-800 bg-zinc-900/20">
                                            <span className="text-[9px] text-zinc-500 block font-bold">MIDDLE (SMA-20)</span>
                                            <span className="text-base font-black text-zinc-300 block mt-1">₹{vol?.bb_middle?.toFixed(2) ?? "—"}</span>
                                        </div>
                                        <div className="text-center p-3 rounded-lg border border-purple-900/40 bg-purple-950/10">
                                            <span className="text-[9px] text-zinc-500 block font-bold">LOWER BAND</span>
                                            <span className="text-base font-black text-purple-300 block mt-1">₹{vol?.bb_lower?.toFixed(2) ?? "—"}</span>
                                        </div>
                                    </div>
                                    {/* Band position bar */}
                                    <div>
                                        <div className="flex justify-between text-[8px] text-zinc-600 mb-1">
                                            <span>LOWER BAND</span>
                                            <span className="text-zinc-400">PRICE POSITION: {vol?.bb_position ?? "—"}%</span>
                                            <span>UPPER BAND</span>
                                        </div>
                                        <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden relative">
                                            <div className="absolute inset-0 bg-gradient-to-r from-rose-900/20 via-zinc-800/20 to-emerald-900/20 rounded-full" />
                                            <div
                                                className="absolute top-0 h-full w-1 bg-white rounded-full"
                                                style={{ left: `${Math.min(Math.max(vol?.bb_position ?? 50, 0), 100)}%` }}
                                            />
                                        </div>
                                        <p className="text-[9px] text-zinc-500 mt-1.5 font-sans">
                                            {(vol?.bb_position ?? 50) > 80 ? "Price near upper band — potential resistance / overbought zone." :
                                                (vol?.bb_position ?? 50) < 20 ? "Price near lower band — potential support / oversold zone." :
                                                    "Price within mid-band range — no extreme band signal."}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* ══ PHASE V: PREDICTIVE RANGE ══ */}
                            <div className="space-y-3 pt-2">
                                <SectionHeader color="bg-purple-500 animate-pulse" label="Phase V: Predictive Trajectory Architecture (Next 5 Sessions)" />

                                <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-5 space-y-4">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-900 pb-3">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-zinc-300 tracking-wider uppercase">
                                                5-SESSION FORWARD RANGE PROJECTION
                                            </span>
                                            <span className="text-[9px] text-zinc-500 font-sans mt-0.5">
                                                Multi-signal blend: linear regression · EMA momentum · volume velocity
                                            </span>
                                        </div>
                                        <div className="rounded bg-zinc-900 px-3 py-1 border border-zinc-800 text-[9px] text-zinc-400 font-mono font-bold tracking-wider">
                                            MODEL: <span className="text-emerald-400 uppercase">{bounds?.model_confidence ?? "—"}</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="p-4 rounded-xl bg-emerald-950/5 border border-emerald-900/30">
                                            <span className="text-[10px] text-emerald-500 font-black tracking-wider block">UPPER CEILING (RESISTANCE TARGET)</span>
                                            <span className="text-3xl font-black text-emerald-400 block mt-2">₹{bounds?.upper_limit?.toFixed(2) ?? "0.00"}</span>
                                            <p className="text-[10px] text-zinc-400 mt-2 font-sans leading-relaxed">
                                                If high-volume momentum extends, the model projects a ceiling near <span className="font-bold text-emerald-400 font-mono">₹{bounds?.upper_limit?.toFixed(2)}</span> over the next 5 sessions before mean-reversion pressure emerges.
                                            </p>
                                        </div>
                                        <div className="p-4 rounded-xl bg-rose-950/5 border border-rose-900/30">
                                            <span className="text-[10px] text-rose-500 font-black tracking-wider block">LOWER FLOOR (SUPPORT TARGET)</span>
                                            <span className="text-3xl font-black text-rose-400 block mt-2">₹{bounds?.lower_limit?.toFixed(2) ?? "0.00"}</span>
                                            <p className="text-[10px] text-zinc-400 mt-2 font-sans leading-relaxed">
                                                In a negative liquidity event, the model establishes a defensive floor near <span className="font-bold text-rose-400 font-mono">₹{bounds?.lower_limit?.toFixed(2)}</span> where structural demand is expected.
                                            </p>
                                        </div>
                                    </div>

                                    {/* 5-step predicted prices */}
                                    {chart?.predicted_prices?.length > 0 && (
                                        <div className="pt-3 border-t border-zinc-900">
                                            <span className="text-[9px] text-zinc-500 font-black tracking-widest block mb-2">SESSION-BY-SESSION TRAJECTORY</span>
                                            <div className="grid grid-cols-5 gap-2">
                                                {chart.predicted_prices.map((price, i) => {
                                                    const prev = i === 0 ? currentPrice : chart.predicted_prices[i - 1];
                                                    const up = price >= prev;
                                                    return (
                                                        <div key={i} className={`text-center p-2 rounded-lg border ${up ? "border-emerald-900/30 bg-emerald-950/5" : "border-rose-900/30 bg-rose-950/5"}`}>
                                                            <span className="text-[8px] text-zinc-600 block font-bold">T+{i + 1}</span>
                                                            <span className={`text-[11px] font-black font-mono block mt-0.5 ${up ? "text-emerald-400" : "text-rose-400"}`}>
                                                                ₹{price.toFixed(2)}
                                                            </span>
                                                            <span className={`text-[8px] ${up ? "text-emerald-600" : "text-rose-600"}`}>
                                                                {up ? "▲" : "▼"}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}