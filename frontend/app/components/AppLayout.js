"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function AppLayout({ children }) {
    const [isMobileOpen, setIsMobileOpen] = useState(false);

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