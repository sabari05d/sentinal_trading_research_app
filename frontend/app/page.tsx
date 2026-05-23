"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const storedUserId = localStorage.getItem("sentinal_user_id");
    if (storedUserId) {
      router.push("/dashboard");
    } else {
      router.push("/login");
    }
  }, [router]);

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-950 text-white">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-700 border-t-emerald-500" />
        <p className="text-zinc-400 font-medium tracking-wide">Initializing Sentinal Core...</p>
      </div>
    </div>
  );
}