"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export default function Topbar({ setIsMobileOpen, onWatchlistUpdated }) {
    const [searchFocused, setSearchFocused] = useState(false);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [addingTicker, setAddingTicker] = useState(null);
    const [userProfile, setUserProfile] = useState({ name: "Developer", email: "" });
    const [dropdownOpen, setDropdownOpen] = useState(false);

    const router = useRouter();
    const searchContainerRef = useRef(null);
    const profileDropdownRef = useRef(null);

    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

    // 1. Fetch Local User Account Profile Attributes
    useEffect(() => {
        const storedUserId = localStorage.getItem("sentinal_user_id");
        if (storedUserId) {
            // Simulated retrieval from localStorage; falls back cleanly to defaults if empty
            const name = localStorage.getItem("sentinal_user_name") || "User";
            const email = localStorage.getItem("sentinal_user_email") || "abc@sentinal.com";
            setUserProfile({ name, email });
        }

        // Global key binder for command bar focus tracking (Ctrl + K)
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "k") {
                e.preventDefault();
                document.getElementById("globalTickerSearch")?.focus();
            }
            if (e.key === "Escape") {
                setSearchFocused(false);
                setDropdownOpen(false);
            }
        };

        const handleClickOutside = (e) => {
            if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
                setSearchFocused(false);
            }
            if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target)) {
                setDropdownOpen(false);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    // 2. Continuous Live Lookup Polling Core
    useEffect(() => {
        if (query.trim().length < 2) {
            setResults([]);
            return;
        }

        const delayDebounce = setTimeout(async () => {
            setSearching(true);
            try {
                const res = await fetch(`${API_URL}/api/market/search?q=${encodeURIComponent(query)}`);
                if (res.ok) {
                    const data = await res.json();
                    setResults(data);
                }
            } catch (err) {
                console.error("Ticker search failed:", err);
            } finally {
                setSearching(false);
            }
        }, 300); // 300ms Debounce limit to conserve system bandwidth

        return () => clearTimeout(delayDebounce);
    }, [query]);

    // 3. Inject Selected Asset Vector Directly to Watchlist Database
    const handleAddAsset = async (asset) => {
        const userId = localStorage.getItem("sentinal_user_id");
        if (!userId) return;

        setAddingTicker(asset.ticker);
        try {
            const res = await fetch(`${API_URL}/api/watchlist`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-User-Id": userId,
                },
                body: JSON.stringify({
                    ticker: asset.ticker,
                    company_name: asset.company_name
                })
            });

            if (res.ok) {
                setQuery("");
                setSearchFocused(false);
                // Trigger an instant refresh callback loop if dashboard functions are mounted
                if (onWatchlistUpdated) onWatchlistUpdated();
                alert(`Successfully onboarded ${asset.ticker} into active tracking channel.`);
            } else {
                const errData = await res.json();
                alert(`Asset onboarding rejected: ${errData.detail || "Duplicate Node Entry"}`);
            }
        } catch (err) {
            console.error("Failed to commit asset schema alignment:", err);
        } finally {
            setAddingTicker(null);
        }
    };

    // 4. Generate Deterministic Colors Based On First Letter Code
    const getAvatarColorClass = (char) => {
        const code = char.toUpperCase().charCodeAt(0) || 65;
        const colorMatrix = [
            "bg-blue-600 border-blue-500 text-blue-100",
            "bg-emerald-600 border-emerald-500 text-emerald-100",
            "bg-purple-600 border-purple-500 text-purple-100",
            "bg-amber-600 border-amber-500 text-amber-100",
            "bg-rose-600 border-rose-500 text-rose-100",
            "bg-cyan-600 border-cyan-500 text-cyan-100"
        ];
        return colorMatrix[code % colorMatrix.length];
    };

    const firstChar = userProfile.name.trim().charAt(0) || "D";
    const avatarTheme = getAvatarColorClass(firstChar);

    return (
        <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-zinc-900 bg-zinc-950/80 px-4 backdrop-blur-md md:px-6">

            {/* Left Segment: Mobile Open Action Trigger */}
            <div className="flex items-center gap-4 flex-1">
                <button
                    onClick={() => setIsMobileOpen(true)}
                    className="rounded p-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 lg:hidden cursor-pointer text-sm"
                >
                    ☰
                </button>

                {/* 🔍 LIVE AUTOCOMPLETE INTERACTIVE ENGINE CONTAINER */}
                <div ref={searchContainerRef} className="relative w-full max-w-md hidden md:block">
                    <div className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs text-zinc-400 transition-all bg-zinc-950 ${searchFocused ? "border-emerald-500/80 ring-1 ring-emerald-500/20" : "border-zinc-800"}`}>
                        <span>🔍</span>
                        <input
                            id="globalTickerSearch"
                            type="text"
                            placeholder="Type to search live tickers... (Ctrl+K)"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onFocus={() => setSearchFocused(true)}
                            className="bg-transparent border-none outline-none text-zinc-100 flex-1 placeholder-zinc-600 text-xs font-mono font-medium"
                        />
                        {query && (
                            <button onClick={() => setQuery("")} className="text-zinc-600 hover:text-zinc-400 text-[10px] font-bold cursor-pointer">
                                CLEAR
                            </button>
                        )}
                    </div>

                    {/* Autocomplete Dynamic Dropdown Matrix */}
                    {searchFocused && (query.length >= 2 || results.length > 0) && (
                        <div className="absolute top-full left-0 right-0 mt-2 max-h-72 overflow-y-auto rounded-xl border border-zinc-900 bg-zinc-950 shadow-2xl p-2 space-y-1 z-50 font-mono text-xs">
                            {searching ? (
                                <div className="p-3 text-center text-zinc-600 animate-pulse text-[10px] tracking-wider">[CONTACTING YAHOO FINANCE DATASTREAM...]</div>
                            ) : results.length === 0 ? (
                                <div className="p-3 text-center text-zinc-600 text-[10px] font-bold">[NO ACTIVE VECTOR NODES REGISTERED]</div>
                            ) : (
                                results.map((asset) => (
                                    <div key={asset.ticker} className="flex items-center justify-between p-2 rounded-lg hover:bg-zinc-900/60 transition-colors border border-transparent hover:border-zinc-800/40">
                                        <div className="flex flex-col max-w-[75%]">
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-black text-white text-xs">{asset.ticker}</span>
                                                <span className="text-[8px] bg-zinc-900 border border-zinc-800 text-zinc-500 px-1 py-0.2 rounded uppercase font-bold tracking-tight">
                                                    {asset.exchange}
                                                </span>
                                            </div>
                                            <span className="text-[10px] text-zinc-500 font-sans truncate mt-0.5">{asset.company_name}</span>
                                        </div>
                                        <button
                                            onClick={() => handleAddAsset(asset)}
                                            disabled={addingTicker === asset.ticker}
                                            className="px-2 py-1 rounded bg-zinc-900 hover:bg-emerald-950/40 text-[10px] font-black text-zinc-300 hover:text-emerald-400 border border-zinc-800 hover:border-emerald-900/40 transition-all cursor-pointer disabled:opacity-40"
                                        >
                                            {addingTicker === asset.ticker ? "ADDING..." : "[+] TRACK"}
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Right Segment: Hardware Status Metrics & 👤 AVATAR PROFILE DROP-DOWN */}
            <div className="flex items-center gap-4 text-xs font-mono">
                <div className="hidden items-center gap-2 rounded border border-zinc-900 bg-zinc-950 px-2.5 py-1 text-zinc-500 sm:flex text-[10px] tracking-tight font-bold">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>STREAM: LIVE TELEMETRY</span>
                </div>

                {/* USER PROFILE CONTROL CHANNELS */}
                <div ref={profileDropdownRef} className="relative">
                    <button
                        onClick={() => setDropdownOpen(!dropdownOpen)}
                        className={`h-8 w-8 rounded-full border flex items-center justify-center font-black text-sm tracking-tighter transition-all shadow-md uppercase select-none cursor-pointer scale-95 hover:scale-100 ${avatarTheme}`}
                    >
                        {firstChar}
                    </button>

                    {dropdownOpen && (
                        <div className="absolute right-0 mt-2 w-56 rounded-xl border border-zinc-900 bg-zinc-950 shadow-2xl p-1.5 z-50 text-xs">
                            <div className="p-2.5 border-b border-zinc-900 mb-1">
                                <span className="block font-black text-white truncate text-[11px] uppercase tracking-wide">{userProfile.name}</span>
                                <span className="block text-[9px] text-zinc-500 font-sans truncate mt-0.5">{userProfile.email}</span>
                            </div>

                            <button
                                onClick={() => { setDropdownOpen(false); router.push("/profile"); }}
                                className="w-full text-left p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 font-bold transition-colors cursor-pointer text-[10px] tracking-wider block"
                            >
                                ⚙️ SYSTEM SETTINGS
                            </button>

                            <button
                                onClick={() => {
                                    setDropdownOpen(false);
                                    localStorage.clear();
                                    router.push("/login");
                                }}
                                className="w-full text-left p-2 rounded-lg text-rose-400 hover:bg-rose-950/20 font-bold transition-colors cursor-pointer text-[10px] tracking-wider block mt-0.5 border-t border-zinc-900/60 pt-2"
                            >
                                🚪 SHUTDOWN SESSION
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}