"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "../utils/supabase";

export default function Sidebar({ isMobileOpen, setIsMobileOpen }) {
    const router = useRouter();
    const pathname = usePathname();
    const [isCollapsed, setIsCollapsed] = useState(false);

    const navigation = [
        { name: "Terminal Matrix", path: "/dashboard", icon: "📊" },
        { name: "Watchlist Manager", path: "/watchlist", icon: "⚙️" },
    ];

    const handleLogout = async () => {
        await supabase.auth.signOut();
        localStorage.removeItem("sentinal_user_id");
        router.push("/login");
    };

    const sidebarWidth = isCollapsed ? "w-16" : "w-64";

    return (
        <>
            {/* Mobile Background Overlay Overlay */}
            {isMobileOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
                    onClick={() => setIsMobileOpen(false)}
                />
            )}

            {/* Main Container */}
            <aside className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col border-r border-zinc-800 bg-zinc-900 transition-all duration-300 lg:static
                ${sidebarWidth} 
                ${isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
            `}>
                {/* Brand Header */}
                <div className="flex h-16 items-center justify-between border-b border-zinc-800 px-4">
                    {!isCollapsed && (
                        <div className="flex items-center gap-2">
                            <span className="text-xl font-black tracking-wider text-emerald-500 font-mono">SENTINAL</span>
                            <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-bold text-zinc-400">v1.0</span>
                        </div>
                    )}
                    {isCollapsed && <span className="mx-auto font-mono text-xl font-bold text-emerald-500">S</span>}

                    {/* Collapse Toggle desktop switch */}
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="hidden rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 lg:block cursor-pointer"
                    >
                        {isCollapsed ? "»" : "«"}
                    </button>
                </div>

                {/* Navigation Elements */}
                <nav className="flex-1 space-y-1 p-3">
                    {navigation.map((item) => {
                        const isActive = pathname === item.path;
                        return (
                            <button
                                key={item.name}
                                onClick={() => {
                                    router.push(item.path);
                                    setIsMobileOpen(false);
                                }}
                                className={`flex w-full items-center gap-3 rounded-lg p-2.5 text-sm font-medium transition-all cursor-pointer
                                    ${isActive
                                        ? "bg-emerald-950/40 text-emerald-400 border-l-2 border-emerald-500 pl-2"
                                        : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
                                    }
                                `}
                            >
                                <span className="text-base">{item.icon}</span>
                                {!isCollapsed && <span className="truncate flex-1 text-left">{item.name}</span>}
                                {!isCollapsed && item.badge && (
                                    <span className="rounded bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-400 animate-pulse">
                                        {item.badge}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </nav>

                {/* Footprint Signout Control */}
                <div className="border-t border-zinc-800 p-3">
                    <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-3 rounded-lg p-2.5 text-sm font-medium text-zinc-500 hover:bg-red-950/20 hover:text-red-400 transition-all cursor-pointer"
                    >
                        <span>🚪</span>
                        {!isCollapsed && <span>Disconnect</span>}
                    </button>
                </div>
            </aside>
        </>
    );
}