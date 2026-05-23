"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "../components/AppLayout";

export default function ProfileSettings() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [saving, setSaving] = useState(false);
    const [statusMessage, setStatusMessage] = useState({ type: "", text: "" });
    const router = useRouter();

    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

    useEffect(() => {
        const storedUserId = localStorage.getItem("sentinal_user_id");
        if (!storedUserId) {
            router.push("/login");
            return;
        }
        setName(localStorage.getItem("sentinal_user_name") || "Developer Node");
        setEmail(localStorage.getItem("sentinal_user_email") || "");
    }, [router]);

    const handleSaveChanges = async (e) => {
        e.preventDefault();
        setSaving(true);
        setStatusMessage({ type: "", text: "" });

        const userId = localStorage.getItem("sentinal_user_id");
        if (!userId) {
            setStatusMessage({ type: "error", text: "Session tracking lost. Please sign in again." });
            setSaving(false);
            return;
        }

        try {
            const res = await fetch(`${API_URL}/api/user/profile`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "X-User-Id": userId
                },
                body: JSON.stringify({
                    name: name,
                    email: email,
                    ...(password ? { password: password } : {})
                })
            });

            if (res.ok) {
                // Update local structural session maps for topbar parsing
                localStorage.setItem("sentinal_user_name", name);
                localStorage.setItem("sentinal_user_email", email);

                setStatusMessage({
                    type: "success",
                    text: "Identity schema synced successfully with Supabase Auth matrix."
                });
                setPassword("");

                // Fire window state burst reload after a delay to broadcast new initials across the Topbar
                setTimeout(() => {
                    window.location.reload();
                }, 1200);
            } else {
                const errData = await res.json();
                setStatusMessage({
                    type: "error",
                    text: errData.detail || "Supabase rejected identity synchronization."
                });
            }
        } catch (err) {
            console.error("Profile update failed:", err);
            setStatusMessage({ type: "error", text: "Network pipeline exception handling request." });
        } finally {
            setSaving(false);
        }
    };

    return (
        <AppLayout>
            <div className="max-w-4xl mx-auto p-6 font-mono text-xs text-zinc-400 space-y-6 select-none">

                <div>
                    <h1 className="text-xl font-black tracking-tight text-white uppercase">
                        SYSTEM PARAMETERS & PROFILE OPERATIONS
                    </h1>
                    <p className="text-[10px] text-zinc-500 mt-1 font-sans">
                        Configure user identity settings and sync operational credentials directly with your Supabase Auth account instance.
                    </p>
                </div>

                {statusMessage.text && (
                    <div className={`p-3 rounded-lg border font-mono font-bold tracking-wide text-[10px] ${statusMessage.type === "success"
                            ? "bg-emerald-950/30 border-emerald-900/50 text-emerald-400"
                            : "bg-rose-950/30 border-rose-900/50 text-rose-400"
                        }`}>
                        {statusMessage.type === "success" ? "✔ SUCCESS // " : "⚠ ERROR // "} {statusMessage.text.toUpperCase()}
                    </div>
                )}

                <div className="grid grid-cols gap-6">
                    {/* Main Identity Mapping Form Area */}
                    <div className="md:col-span-2 rounded-xl border border-zinc-900 bg-zinc-950 p-5 space-y-4">
                        <h3 className="text-[10px] font-black tracking-widest text-zinc-400 uppercase border-b border-zinc-900 pb-2">
                            SUPABASE AUTH IDENTITY PAIRINGS
                        </h3>

                        <form onSubmit={handleSaveChanges} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] text-zinc-500 font-bold block">OPERATOR DISPLAY NAME</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white font-mono text-xs focus:border-emerald-500 outline-none transition-colors"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] text-zinc-500 font-bold block">CORE EMAIL TARGET</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white font-mono text-xs focus:border-emerald-500 outline-none transition-colors"
                                />
                            </div>

                            <div className="space-y-1.5 pt-2 border-t border-zinc-900/60">
                                <label className="text-[10px] text-rose-400 font-bold block">ROTATE ACCOUNT PASSWORD (CRITICAL)</label>
                                <input
                                    type="password"
                                    placeholder="Leave completely empty to preserve security matrix locks"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white font-mono text-xs focus:border-rose-500 outline-none transition-colors placeholder-zinc-800"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={saving}
                                className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-emerald-950/40 text-[10px] font-black text-zinc-100 hover:text-emerald-400 border border-zinc-800 hover:border-emerald-900/40 transition-all cursor-pointer disabled:opacity-50"
                            >
                                {saving ? "[FLUSHING SCHEMA CHANGES...]" : "[SAVE CREDENTIAL UPDATES]"}
                            </button>
                        </form>
                    </div>

            
                </div>
            </div>
        </AppLayout>
    );
}