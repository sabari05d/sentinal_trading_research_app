"use client";

import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { useRouter } from "next/navigation";

export default function AppLayout({ children }) {
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        // Check for the active database session identity token
        const storedUserId = localStorage.getItem("sentinal_user_id");

        if (!storedUserId) {
            // Direct routing kick back if data metrics do not exist
            router.replace("/login");
        } else {
            setIsAuthenticated(true);
            setLoading(false);
        }
    }, [router]);

    // Show a sleek, monochromatic terminal booting screen while checking credentials
    if (loading) {
        return (
            <div className="fixed inset-0 bg-zinc-950 font-mono text-[10px] text-zinc-500 flex flex-col items-center justify-center space-y-2 select-none">
                <div className="h-4 w-4 rounded-full border border-zinc-800 border-t-emerald-500 animate-spin" />
                <span className="tracking-widest animate-pulse">AUTHENTICATING SECURE TERMINAL SESSION...</span>
            </div>
        );
    }

    // Only render system components if user is confirmed valid
    if (!isAuthenticated) return null;

    return (
        <div className="flex min-h-screen bg-zinc-950 text-zinc-100 font-sans antialiased">
            {/* Vertical Navigation Bar */}
            <Sidebar isMobileOpen={isMobileOpen} setIsMobileOpen={setIsMobileOpen} />

            {/* Core Dynamic Content Container */}
            <div className="flex flex-1 flex-col overflow-hidden">
                {/* Horizontal Top Management Control Panel */}
                <Topbar setIsMobileOpen={setIsMobileOpen} />

                {/* Scrollable Viewport Stage Workspace */}
                <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
                    {children}
                </main>
            </div>
        </div>
    );
}