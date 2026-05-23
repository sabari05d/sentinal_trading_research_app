"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../utils/supabase";

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const { data, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (authError) {
            setError(authError.message);
            setLoading(false);
        } else {
            localStorage.setItem("sentinal_user_id", data.user.id);
            router.push("/dashboard");
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
            <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl">
                <div className="mb-6 text-center">
                    <h2 className="text-2xl font-bold tracking-tight text-white">Sentinal Research System</h2>
                    <p className="mt-2 text-sm text-zinc-400">Sign in to access your trading monitor dashboard</p>
                </div>

                {error && (
                    <div className="mb-4 rounded-lg bg-red-950/50 border border-red-800 p-3 text-sm text-red-400">
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-1.5">Email Address</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 p-2.5 text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none text-sm transition-colors"
                            placeholder="name@example.com"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-1.5">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 p-2.5 text-white focus:border-emerald-500 focus:outline-none text-sm transition-colors"
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-lg bg-emerald-600 p-2.5 text-sm font-semibold text-white hover:bg-emerald-500 focus:outline-none disabled:opacity-50 transition-colors cursor-pointer mt-2"
                    >
                        {loading ? "Authenticating..." : "Sign In"}
                    </button>
                </form>
            </div>
        </div>
    );
}