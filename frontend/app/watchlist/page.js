"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "../components/AppLayout";
import StockDetailCanvas from "../components/StockDetailCanvas";

export default function WatchlistManager() {
    const [watchlist, setWatchlist] = useState([]);
    const [ticker, setTicker] = useState("");
    const [companyName, setCompanyName] = useState("");
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState("");
    const [userId, setUserId] = useState(null);
    const [message, setMessage] = useState("");
    const [msgType, setMsgType] = useState("info");
    const [selectedStock, setSelectedStock] = useState(null);
    const [isCanvasOpen, setIsCanvasOpen] = useState(false);
    const router = useRouter();

    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

    useEffect(() => {
        const storedUserId = localStorage.getItem("sentinal_user_id");
        if (!storedUserId) {
            router.push("/login");
        } else {
            setUserId(storedUserId);
            fetchWatchlist(storedUserId);
        }
    }, [router]);

    const fetchWatchlist = async (uid) => {
        try {
            const res = await fetch(`${API_URL}/api/watchlist`, {
                method: "GET",
                headers: { "Content-Type": "application/json", "X-User-Id": uid },
            });
            if (res.ok) setWatchlist(await res.json());
        } catch (err) {
            showStatus("Error reading configuration feeds.", "error");
        }
    };

    const showStatus = (text, type = "info") => {
        setMsgType(type);
        setMessage(text);
        setTimeout(() => setMessage(""), 3500);
    };

    const handleAddStock = async (e) => {
        e.preventDefault();
        if (!ticker) return;

        try {
            const res = await fetch(`${API_URL}/api/watchlist`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-User-Id": userId },
                body: JSON.stringify({ ticker, company_name: companyName || null }),
            });

            if (res.ok) {
                setTicker("");
                setCompanyName("");
                showStatus("Asset registered successfully.", "success");
                fetchWatchlist(userId);
            } else {
                const err = await res.json();
                showStatus(err.detail || "Failed to submit asset.", "error");
            }
        } catch (err) {
            showStatus("Network connection error.", "error");
        }
    };

    const handleUpdateCompany = async (id, currentTicker) => {
        try {
            const res = await fetch(`${API_URL}/api/watchlist/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", "X-User-Id": userId },
                body: JSON.stringify({ company_name: editName }),
            });

            if (res.ok) {
                setEditingId(null);
                showStatus(`Updated metadata for ${currentTicker}`, "success");
                fetchWatchlist(userId);
            }
        } catch (err) {
            showStatus("Failed to update target details.", "error");
        }
    };

    const handleDeactivate = async (id, currentTicker) => {
        try {
            const res = await fetch(`${API_URL}/api/watchlist/${id}`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json", "X-User-Id": userId },
            });

            if (res.ok) {
                showStatus(`Deactivated tracking for ${currentTicker}`, "success");
                fetchWatchlist(userId);
            }
        } catch (err) {
            showStatus("Deactivation instruction failed.", "error");
        }
    };


    // Synchronize canvas detail reference object inline during continuous polling cycles
    useEffect(() => {
        if (selectedStock) {
            const updatedMatch = watchlist.find((s) => s.id === selectedStock.id);
            if (updatedMatch) setSelectedStock(updatedMatch);
        }
    }, [watchlist, selectedStock]);

    const handleRowActivation = (stock) => {
        setSelectedStock(stock);
        setIsCanvasOpen(true);
    };

    return (
        <AppLayout>
            <div className="mb-6">
                <h2 className="text-xl font-bold tracking-tight font-mono text-white">WATCHLIST TARGET UTILITIES</h2>
                <p className="text-xs text-zinc-500 font-mono mt-1">Configure asset manifests, track vectors, and prune active channel frequencies</p>
            </div>

            {message && (
                <div className={`mb-6 p-4 rounded-xl text-xs border font-mono ${msgType === "success" ? "bg-emerald-950/20 border-emerald-800 text-emerald-400" : "bg-red-950/20 border-red-800 text-red-400"
                    }`}>
                    [{msgType.toUpperCase()}] {message}
                </div>
            )}

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                {/* ADD FORM ASSET CONTAINER */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 backdrop-blur-sm h-fit">
                    <h3 className="text-xs font-semibold tracking-wide text-zinc-200 font-mono mb-4">PROVISION NEW CHANNEL</h3>
                    <form onSubmit={handleAddStock} className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-mono font-medium text-zinc-500 mb-1">ASSET TICKER</label>
                            <input
                                type="text"
                                placeholder="e.g. INFY"
                                value={ticker}
                                onChange={(e) => setTicker(e.target.value)}
                                required
                                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-2.5 text-xs uppercase text-white focus:border-emerald-500 focus:outline-none font-mono"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-mono font-medium text-zinc-500 mb-1">METADATA / DESC</label>
                            <input
                                type="text"
                                placeholder="Company profile tracking name"
                                value={companyName}
                                onChange={(e) => setCompanyName(e.target.value)}
                                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                            />
                        </div>
                        <button type="submit" className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-mono text-xs py-2.5 transition-colors cursor-pointer">
                            MOUNT FREQUENCY REGISTRY
                        </button>
                    </form>
                </div>

                {/* DATA GRID INLINE ACTIONS MANIFEST */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 shadow-xl xl:col-span-2 overflow-hidden">
                    <div className="border-b border-zinc-800 p-4 bg-zinc-900/40">
                        <h3 className="text-xs font-semibold tracking-wide text-zinc-200 font-mono">TARGET MATRIX SYSTEM MANAGEMENT</h3>
                    </div>

                    {watchlist.length === 0 ? (
                        <div className="p-12 text-center text-zinc-600 font-mono text-xs">NO CHANNELS ALLOCATED to NODE.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-left text-xs font-mono">
                                <thead>
                                    <tr className="bg-zinc-950 text-zinc-500 border-b border-zinc-800">
                                        <th className="p-3.5">SYMBOL</th>
                                        <th className="p-3.5">METADATA VECTOR</th>
                                        <th className="p-3.5 text-right">OPERATIONS CONTROL</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-800/60">
                                    {watchlist.map((stock) => {
                                        // Check if scanner updated this specific stock record within the last 30 seconds
                                        const lastScan = stock.last_scanned_at ? new Date(stock.last_scanned_at) : null;
                                        const isLive = lastScan && (new Date() - lastScan) < 30000;

                                        return (
                                            <tr
                                                key={stock.id}
                                                onClick={() => handleRowActivation(stock)}
                                                className="hover:bg-zinc-900/30 transition-colors">
                                                <td className="p-3.5 font-bold text-white tracking-wider text-sm">
                                                    {stock.ticker}
                                                </td>
                                                <td className="p-3.5 text-zinc-300">
                                                    {editingId === stock.id ? (
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="text"
                                                                value={editName}
                                                                onChange={(e) => setEditName(e.target.value)}
                                                                className="rounded border border-zinc-700 bg-zinc-950 p-1 text-xs text-white focus:outline-none focus:border-emerald-500"
                                                            />
                                                            <button onClick={() => handleUpdateCompany(stock.id, stock.ticker)} className="text-emerald-400 font-bold">✓</button>
                                                            <button onClick={() => setEditingId(null)} className="text-zinc-500">✕</button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col">
                                                            <span className="font-sans">{stock.company_name || "—"}</span>
                                                            {stock.last_price > 0 && (
                                                                <span className="text-[11px] text-zinc-400 font-mono mt-0.5">
                                                                    Last Value: ₹{stock.last_price.toFixed(2)}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-3.5 text-right space-x-3">
                                                    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold border mr-4 ${isLive
                                                        ? "bg-emerald-500/5 text-emerald-400 border-emerald-500/20 animate-pulse"
                                                        : "bg-zinc-800 text-zinc-500 border-zinc-700"
                                                        }`}>
                                                        {isLive ? "● SCANNED LIVE" : "● STANDBY"}
                                                    </span>
                                                    {editingId !== stock.id && (
                                                        <button
                                                            onClick={() => { setEditingId(stock.id); setEditName(stock.company_name || ""); }}
                                                            className="text-zinc-400 hover:text-amber-400"
                                                        >
                                                            [EDIT]
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleDeactivate(stock.id, stock.ticker)}
                                                        className="text-zinc-500 hover:text-red-400"
                                                    >
                                                        [TERMINATE]
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>


            {/* RENDER DYNAMIC 90% SLIDE-OVER DETAILS STAGE CANVAS COMPONENT */}
            <StockDetailCanvas
                isOpen={isCanvasOpen}
                onClose={() => setIsCanvasOpen(false)}
                stock={selectedStock}
            />
        </AppLayout>
    );
}