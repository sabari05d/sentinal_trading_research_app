"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "../components/AppLayout";
import StockDetailCanvas from "../components/StockDetailCanvas";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 30000;
const SCAN_STALENESS_MS = 45000;

// ─── PURE COMPUTE HELPERS ─────────────────────────────────────────────────────

/** Derive context-aware technical signal pills from a stock row */
function computeTechnicalTags(stock) {
    const tags = [];
    const price = stock?.last_price ?? 0;
    const prev = stock?.prev_price ?? 0;

    if (price <= 0) return tags;

    const delta = prev > 0 ? ((price - prev) / prev) * 100 : 0;

    if (delta >= 2.5) tags.push({ label: "BULLISH BREAKOUT", color: "emerald" });
    else if (delta <= -2.5) tags.push({ label: "BEARISH FLUSH", color: "rose" });

    if (stock?.relative_volume > 1.5) tags.push({ label: "VOLUME SPIKE", color: "amber" });
    if (stock?.rsi_14 >= 70) tags.push({ label: "RSI OVERBOUGHT", color: "rose" });
    if (stock?.rsi_14 <= 30) tags.push({ label: "RSI OVERSOLD", color: "sky" });
    if (stock?.ema_20 && stock?.ema_50 && stock.ema_20 > stock.ema_50)
        tags.push({ label: "EMA BULLISH CROSS", color: "emerald" });
    if (stock?.bb_position > 90) tags.push({ label: "BB SQUEEZE UPPER", color: "violet" });
    if (stock?.bb_position < 10) tags.push({ label: "BB SQUEEZE LOWER", color: "violet" });

    return tags.slice(0, 2); // cap at 2 pills per row for density
}

/** Derive macro bias label from stock array */
function derivePortfolioBias(watchlist) {
    if (!watchlist.length) return { label: "—", color: "zinc" };
    const bullish = watchlist.filter(
        (s) => (s?.last_price ?? 0) > 0 && (s?.prev_price ?? 0) > 0 && s.last_price >= s.prev_price
    ).length;
    const ratio = bullish / watchlist.length;
    if (ratio >= 0.65) return { label: "MACRO BULLISH", color: "emerald" };
    if (ratio <= 0.35) return { label: "MACRO BEARISH", color: "rose" };
    return { label: "MIXED / NEUTRAL", color: "amber" };
}

/** Calculate average velocity (mean % daily move) across all scanned positions */
function calcAverageAlpha(watchlist) {
    const valid = watchlist.filter(
        (s) => (s?.last_price ?? 0) > 0 && (s?.prev_price ?? 0) > 0
    );
    if (!valid.length) return null;
    const mean =
        valid.reduce(
            (acc, s) => acc + ((s.last_price - s.prev_price) / s.prev_price) * 100,
            0
        ) / valid.length;
    return mean.toFixed(2);
}

/** Count positions that have any alert-worthy signal */
function countAlertFlags(watchlist) {
    return watchlist.filter((s) => computeTechnicalTags(s).length > 0).length;
}

// ─── SUB-COMPONENTS ──────────────────────────────────────────────────────────

/** Animated pulse dot */
function PulseDot({ active, className = "" }) {
    return (
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"} ${className}`} />
    );
}

/** Tag pill */
function TechPill({ label, color }) {
    const palettes = {
        emerald: "text-emerald-400 bg-emerald-950/50 border-emerald-800/50",
        rose: "text-rose-400 bg-rose-950/50 border-rose-800/50",
        amber: "text-amber-400 bg-amber-950/50 border-amber-800/50",
        sky: "text-sky-400 bg-sky-950/50 border-sky-800/50",
        violet: "text-violet-400 bg-violet-950/50 border-violet-800/50",
        zinc: "text-zinc-400 bg-zinc-800/50 border-zinc-700/50",
    };
    return (
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black tracking-wider border ${palettes[color] ?? palettes.zinc}`}>
            {label}
        </span>
    );
}

/** Mini inline sparkline using SVG — renders last_price history array */
function MiniSparkline({ prices = [], positive }) {
    if (!prices || prices.length < 2) {
        return (
            <div className="flex items-center gap-0.5 h-5">
                {[...Array(8)].map((_, i) => (
                    <div key={i} className="w-0.5 h-2 bg-zinc-800 rounded-full" />
                ))}
            </div>
        );
    }
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    const w = 60;
    const h = 20;
    const pts = prices
        .map((p, i) => {
            const x = (i / (prices.length - 1)) * w;
            const y = h - ((p - min) / range) * h;
            return `${x},${y}`;
        })
        .join(" ");
    const color = positive ? "#34d399" : "#f87171";
    return (
        <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="overflow-visible">
            <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

/** Top-level command header with system clock */
function CommandHeader({ liveCount, lastSync }) {

    const [mounted, setMounted] = useState(false);
    const [timeString, setTimeString] = useState("");

    const fmt = (d) =>
        d?.toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
            timeZone: "Asia/Kolkata",
        }) ?? "—";


    useEffect(() => {
        setMounted(true);

        const updateClock = () => {
            const now = new Date();
            setTimeString(fmt(now)); // e.g., "16:13"
        };

        updateClock(); // Initial client timestamp assignment
        const interval = setInterval(updateClock, 60000); // Keep it running

        return () => clearInterval(interval);
    }, []);



    return (
        <div className="flex flex-col gap-1 mb-8">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-600 tracking-widest mb-1">
                <span>SENTINAL</span>
                <span className="text-zinc-800">▸</span>
                <span>COMMAND CENTER</span>
                <span className="text-zinc-800">▸</span>
                <span className="text-zinc-500">RADAR MATRIX</span>
            </div>

            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-white font-mono leading-none">
                        CORE OPERATION WORKSPACE
                    </h1>
                    <p className="text-[11px] text-zinc-500 font-mono mt-1.5 tracking-wide">
                        Live quantitative market surveillance terminal — real-time feed streaming across all tracked nodes
                    </p>
                </div>

                {/* Live clock + sync badge */}
                <div className="flex items-center gap-3 shrink-0">
                    <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-2 bg-zinc-900/60 border border-zinc-800 rounded-lg px-3 py-1.5">
                            <PulseDot active />
                            <span suppressHydrationWarning className="font-mono text-[11px] text-emerald-400 font-black tracking-widest tabular-nums">
                                {mounted ? timeString : "--:--:--"} IST
                            </span>
                        </div>
                        <span className="text-[9px] text-zinc-600 font-mono tracking-wider">
                            SYNC: {lastSync ? fmt(lastSync) : "AWAITING"}
                        </span>
                    </div>
                    <div className="hidden sm:flex flex-col items-center justify-center w-14 h-14 rounded-xl border border-zinc-800 bg-zinc-900/40">
                        <span className="text-xl font-black text-white font-mono leading-none">{liveCount}</span>
                        <span className="text-[8px] text-zinc-500 tracking-wider mt-0.5">LIVE</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

/** Portfolio-level analytics summary card strip */
function PortfolioMetricStrip({ watchlist }) {
    const bias = derivePortfolioBias(watchlist);
    const alpha = calcAverageAlpha(watchlist);
    const alerts = countAlertFlags(watchlist);
    const liveCount = watchlist.filter((s) => {
        const ls = s?.last_scanned_at ? new Date(s.last_scanned_at) : null;
        return ls && new Date() - ls < SCAN_STALENESS_MS;
    }).length;

    const exposure = watchlist.length;

    const biasColor = {
        emerald: "text-emerald-400",
        rose: "text-rose-400",
        amber: "text-amber-400",
        zinc: "text-zinc-500",
    }[bias.color] ?? "text-zinc-400";

    const metrics = [
        {
            id: "exposure",
            label: "MARKET EXPOSURE",
            sublabel: "Total tracked positions",
            value: exposure,
            suffix: " nodes",
            accent: "text-white",
            icon: "◈",
            iconColor: "text-zinc-500",
        },
        {
            id: "alpha",
            label: "AVG ALPHA VELOCITY",
            sublabel: "Mean session drift %",
            value: alpha !== null ? `${alpha > 0 ? "+" : ""}${alpha}%` : "—",
            accent: alpha !== null
                ? parseFloat(alpha) >= 0 ? "text-emerald-400" : "text-rose-400"
                : "text-zinc-500",
            icon: "⟳",
            iconColor: alpha !== null
                ? parseFloat(alpha) >= 0 ? "text-emerald-500" : "text-rose-500"
                : "text-zinc-600",
        },
        {
            id: "bias",
            label: "MACRO PORTFOLIO BIAS",
            sublabel: "Aggregate directional signal",
            value: bias.label,
            accent: biasColor,
            icon: "▲",
            iconColor: biasColor,
        },
        {
            id: "alerts",
            label: "ACTIVE ALERT FLAGS",
            sublabel: "Technical signal triggers",
            value: alerts,
            suffix: " signals",
            accent: alerts > 0 ? "text-amber-400" : "text-zinc-500",
            icon: "⚑",
            iconColor: alerts > 0 ? "text-amber-500" : "text-zinc-700",
        },
        {
            id: "live",
            label: "LIVE SCAN NODES",
            sublabel: "Actively pinging market feeds",
            value: `${liveCount}/${exposure}`,
            accent: liveCount > 0 ? "text-emerald-400" : "text-zinc-500",
            icon: "●",
            iconColor: liveCount > 0 ? "text-emerald-400" : "text-zinc-700",
        },
    ];

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 mb-6">
            {metrics.map((m, i) => (
                <div
                    key={m.id}
                    className="group relative rounded-xl border border-zinc-900 bg-zinc-950 p-4 overflow-hidden transition-all duration-200 hover:border-zinc-700 hover:bg-zinc-900/40"
                    style={{ animationDelay: `${i * 60}ms` }}
                >
                    {/* subtle corner accent */}
                    <div className="absolute top-0 right-0 w-12 h-12 rounded-bl-3xl bg-zinc-900/60 transition-all group-hover:scale-110" />

                    <div className="flex items-start justify-between gap-2 mb-3">
                        <span className="text-[10px] font-black text-zinc-500 tracking-widest leading-tight">{m.label}</span>
                        <span className={`text-base ${m.iconColor} shrink-0 leading-none`}>{m.icon}</span>
                    </div>
                    <div className={`text-xl font-black font-mono tracking-tight ${m.accent} leading-none`}>
                        {m.value}{m.suffix && <span className="text-[11px] text-zinc-600 font-normal ml-1">{m.suffix}</span>}
                    </div>
                    <div className="text-[9px] text-zinc-600 font-sans mt-1.5 tracking-wide">{m.sublabel}</div>
                </div>
            ))}
        </div>
    );
}

/** Single watchlist table row */
function WatchlistRow({ stock, onSelect }) {
    const lastScan = stock?.last_scanned_at ? new Date(stock.last_scanned_at) : null;
    const isLive = lastScan && new Date() - lastScan < SCAN_STALENESS_MS;
    const price = stock?.last_price ?? 0;
    const prev = stock?.prev_price ?? 0;
    const delta = price > 0 && prev > 0 ? ((price - prev) / prev) * 100 : null;
    const isUp = delta !== null ? delta >= 0 : null;
    const tags = computeTechnicalTags(stock);

    // Synthesize a mock sparkline from price + prev if no history series available
    const sparkPrices = stock?.price_series?.length >= 2
        ? stock.price_series
        : prev > 0 && price > 0
            ? [prev, (prev + price) / 2, price]
            : [];

    return (
        <tr
            onClick={() => onSelect(stock)}
            className="group border-b border-zinc-900/80 hover:bg-zinc-900/30 transition-all duration-150 cursor-pointer"
        >
            {/* Symbol */}
            <td className="px-5 py-3.5">
                <div className="flex items-center gap-2.5">
                    <div className="flex flex-col">
                        <span className="text-[13px] font-black text-white tracking-wider font-mono group-hover:text-emerald-400 transition-colors">
                            {stock.ticker}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-sans leading-tight mt-0.5 max-w-[140px] truncate">
                            {stock.company_name || "—"}
                        </span>
                    </div>
                </div>
            </td>

            {/* Price */}
            <td className="px-5 py-3.5">
                <div className="flex flex-col">
                    <span className="font-black font-mono text-[13px] text-white tabular-nums">
                        {price > 0 ? `₹${price.toFixed(2)}` : <span className="text-zinc-600 animate-pulse text-[11px]">SYNCING...</span>}
                    </span>
                    {delta !== null && (
                        <span className={`text-[10px] font-black font-mono tabular-nums ${isUp ? "text-emerald-400" : "text-rose-400"}`}>
                            {isUp ? "▲" : "▼"} {Math.abs(delta).toFixed(2)}%
                        </span>
                    )}
                </div>
            </td>

            {/* Sparkline */}
            <td className="px-5 py-3.5 hidden sm:table-cell">
                <MiniSparkline prices={sparkPrices} positive={isUp ?? true} />
            </td>

            {/* Technical tags */}
            <td className="px-5 py-3.5 hidden md:table-cell">
                <div className="flex items-center gap-1.5 flex-wrap">
                    {tags.length > 0
                        ? tags.map((t, i) => <TechPill key={i} label={t.label} color={t.color} />)
                        : <span className="text-[9px] text-zinc-700 font-mono tracking-wider">NO SIGNAL</span>
                    }
                </div>
            </td>

            {/* Status */}
            <td className="px-5 py-3.5">
                <div className="flex items-center justify-end gap-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[9px] font-black border tracking-widest ${isLive
                        ? "bg-emerald-500/5 text-emerald-400 border-emerald-500/20"
                        : "bg-zinc-900/60 text-zinc-600 border-zinc-800/60"
                        }`}>
                        <span className={`h-1 w-1 rounded-full ${isLive ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"}`} />
                        {isLive ? "SCANNING" : "STANDBY"}
                    </span>
                    <span className="text-zinc-700 text-[10px] font-mono opacity-0 group-hover:opacity-100 transition-opacity tracking-wider">
                        OPEN →
                    </span>
                </div>
            </td>
        </tr>
    );
}

/** Empty state */
function EmptyState() {
    return (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl border border-zinc-800 bg-zinc-900/40 flex items-center justify-center text-2xl text-zinc-700">
                ◈
            </div>
            <div>
                <p className="text-xs font-black text-zinc-500 font-mono tracking-widest">NO TARGET CHANNELS ALLOCATED</p>
                <p className="text-[10px] text-zinc-700 font-sans mt-1">Add assets to your watchlist to begin surveillance.</p>
            </div>
        </div>
    );
}

/** Market status bar */
function MarketStatusBar({ watchlistCount }) {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const check = () => {
            const now = new Date();
            // IST offset: UTC+5:30
            const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
            const istDate = new Date(utcMs + 5.5 * 3600000);
            const day = istDate.getDay(); // 0=Sun, 6=Sat
            const h = istDate.getHours();
            const m = istDate.getMinutes();
            const mins = h * 60 + m;
            setIsOpen(day >= 1 && day <= 5 && mins >= 555 && mins <= 930); // 9:15–15:30
        };
        check();
        const t = setInterval(check, 30000);
        return () => clearInterval(t);
    }, []);

    return (
        <div className="flex items-center justify-between mb-4 px-1">
            <div className="flex items-center gap-3">
                <h3 className="text-[10px] font-black tracking-widest text-zinc-400 font-mono uppercase">
                    LIVE RADAR STOCK MATRIX
                </h3>
                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-[9px] font-black tracking-widest ${isOpen
                    ? "text-emerald-400 bg-emerald-950/30 border-emerald-900/40"
                    : "text-zinc-500 bg-zinc-900/40 border-zinc-800"
                    }`}>
                    <span className={`h-1 w-1 rounded-full ${isOpen ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"}`} />
                    NSE {isOpen ? "OPEN" : "CLOSED"}
                </div>
            </div>
            <span className="text-[9px] text-zinc-600 font-mono tracking-wider">
                {watchlistCount} POSITION{watchlistCount !== 1 ? "S" : ""} TRACKED
            </span>
        </div>
    );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
    const [watchlist, setWatchlist] = useState([]);
    const [userId, setUserId] = useState(null);
    const [selectedStock, setSelectedStock] = useState(null);
    const [isCanvasOpen, setIsCanvasOpen] = useState(false);
    const [lastSync, setLastSync] = useState(null);
    const [initialLoad, setInitialLoad] = useState(true);
    const router = useRouter();
    const prevWatchlistRef = useRef([]);

    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

    const fetchWatchlist = useCallback(
        async (uid) => {
            try {
                const res = await fetch(`${API_URL}/api/watchlist`, {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                        "X-User-Id": uid,
                    },
                });
                if (!res.ok) return;
                const fresh = await res.json();

                // Merge new prices into existing rows to avoid flicker —
                // preserve prev_price for delta calculations
                setWatchlist((prev) => {
                    const prevMap = Object.fromEntries(prev.map((s) => [s.id, s]));
                    return fresh.map((s) => ({
                        ...s,
                        prev_price: prevMap[s.id]?.last_price ?? s.last_price,
                    }));
                });

                setLastSync(new Date());
                if (initialLoad) setInitialLoad(false);
            } catch (err) {
                console.error("[DASHBOARD] Feed fetch error:", err);
            }
        },
        [API_URL, initialLoad]
    );

    useEffect(() => {
        const storedUserId = localStorage.getItem("sentinal_user_id");
        if (!storedUserId) {
            router.push("/login");
            return;
        }
        setUserId(storedUserId);
        fetchWatchlist(storedUserId);

        const poller = setInterval(() => fetchWatchlist(storedUserId), POLL_INTERVAL_MS);
        return () => clearInterval(poller);
    }, [router, fetchWatchlist]);

    // Keep canvas stock reference in sync with latest polled data
    useEffect(() => {
        if (selectedStock) {
            const updated = watchlist.find((s) => s.id === selectedStock.id);
            if (updated) setSelectedStock(updated);
        }
    }, [watchlist]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleRowSelect = useCallback((stock) => {
        setSelectedStock(stock);
        setIsCanvasOpen(true);
    }, []);

    const liveCount = watchlist.filter((s) => {
        const ls = s?.last_scanned_at ? new Date(s.last_scanned_at) : null;
        return ls && new Date() - ls < SCAN_STALENESS_MS;
    }).length;

    return (
        <AppLayout>
            {/* ── COMMAND HEADER ── */}
            <CommandHeader liveCount={liveCount} lastSync={lastSync} />

            {/* ── PORTFOLIO METRIC STRIP ── */}
            {!initialLoad && (
                <PortfolioMetricStrip watchlist={watchlist} />
            )}

            {/* Skeleton strip on first load */}
            {initialLoad && (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 mb-6">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="rounded-xl border border-zinc-900 bg-zinc-950 p-4 h-[90px] animate-pulse">
                            <div className="h-2 w-20 bg-zinc-800 rounded mb-3" />
                            <div className="h-5 w-16 bg-zinc-800 rounded mb-2" />
                            <div className="h-2 w-24 bg-zinc-900 rounded" />
                        </div>
                    ))}
                </div>
            )}

            {/* ── MAIN TABLE PANEL ── */}
            <div className="rounded-xl border border-zinc-900 bg-zinc-950 overflow-hidden shadow-2xl">

                {/* Table header bar */}
                <div className="border-b border-zinc-900 px-5 py-3.5 bg-zinc-950/80 backdrop-blur-sm">
                    <MarketStatusBar watchlistCount={watchlist.length} />
                </div>

                {initialLoad ? (
                    /* Skeleton rows */
                    <div className="divide-y divide-zinc-900/60">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="flex items-center gap-6 px-5 py-4 animate-pulse">
                                <div className="flex flex-col gap-1.5">
                                    <div className="h-3 w-16 bg-zinc-800 rounded" />
                                    <div className="h-2 w-24 bg-zinc-900 rounded" />
                                </div>
                                <div className="h-3 w-20 bg-zinc-800 rounded ml-auto" />
                                <div className="h-3 w-16 bg-zinc-900 rounded" />
                            </div>
                        ))}
                    </div>
                ) : watchlist.length === 0 ? (
                    <EmptyState />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left">
                            <thead>
                                <tr className="bg-zinc-950/60 text-zinc-600 border-b border-zinc-900">
                                    <th className="px-5 py-3 text-[9px] font-black tracking-widest font-mono">ASSET SYMBOL</th>
                                    <th className="px-5 py-3 text-[9px] font-black tracking-widest font-mono">LAST PRICE</th>
                                    <th className="px-5 py-3 text-[9px] font-black tracking-widest font-mono hidden sm:table-cell">TREND</th>
                                    <th className="px-5 py-3 text-[9px] font-black tracking-widest font-mono hidden md:table-cell">SIGNAL FLAGS</th>
                                    <th className="px-5 py-3 text-[9px] font-black tracking-widest font-mono text-right">STATUS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {watchlist.map((stock) => (
                                    <WatchlistRow
                                        key={stock.id}
                                        stock={stock}
                                        onSelect={handleRowSelect}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Footer */}
                {watchlist.length > 0 && (
                    <div className="border-t border-zinc-900 px-5 py-2.5 flex items-center justify-between">
                        <span className="text-[9px] text-zinc-700 font-mono tracking-wider">
                            AUTO-SYNC EVERY {POLL_INTERVAL_MS / 1000}S · CLICK ROW TO OPEN FULL ANALYSIS
                        </span>
                        <span className="text-[9px] text-zinc-700 font-mono tracking-wider">
                            SENTINAL v2.0 · NSE/BSE
                        </span>
                    </div>
                )}
            </div>

            {/* ── STOCK DETAIL CANVAS ── */}
            <StockDetailCanvas
                isOpen={isCanvasOpen}
                onClose={() => setIsCanvasOpen(false)}
                stock={selectedStock}
            />
        </AppLayout>
    );
}