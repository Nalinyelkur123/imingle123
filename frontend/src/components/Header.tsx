"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { connectSocket } from "@/services/socket";
import { fetchLiveStats } from "@/services/api";

let themeListeners: Array<() => void> = [];

function subscribeTheme(callback: () => void) {
  themeListeners.push(callback);
  window.addEventListener("storage", callback);
  return () => {
    themeListeners = themeListeners.filter((cb) => cb !== callback);
    window.removeEventListener("storage", callback);
  };
}

function notifyThemeChange() {
  themeListeners.forEach((cb) => cb());
}

function getThemeSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  const saved = localStorage.getItem("umingle_dark");
  // Default to light mode (false) matching the reference design
  return saved === "true";
}

function getThemeServerSnapshot(): boolean {
  return false;
}

export function Header() {
  const isDark = useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    getThemeServerSnapshot
  );

  const [onlineCount, setOnlineCount] = useState<string>("1");

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark-mode");
    } else {
      document.documentElement.classList.remove("dark-mode");
    }
  }, [isDark]);

  useEffect(() => {
    // 1. Initial live stats fetch
    fetchLiveStats().then((data) => {
      if (data?.stats?.onlineUsers !== undefined) {
        setOnlineCount(String(data.stats.onlineUsers));
      }
    });

    // 2. Real-time live update from socket
    const socket = connectSocket();
    const handleOnlineCount = (payload: { count: number }) => {
      if (payload?.count !== undefined) {
        setOnlineCount(String(payload.count));
      }
    };

    socket.on("online_count", handleOnlineCount);

    return () => {
      socket.off("online_count", handleOnlineCount);
    };
  }, []);

  const toggleDarkMode = () => {
    const current = getThemeSnapshot();
    const next = !current;
    try {
      localStorage.setItem("umingle_dark", String(next));
    } catch {
      // ignore
    }
    notifyThemeChange();
  };

  return (
    <header className="shrink-0 h-[52px] sm:h-[58px] relative z-50 flex w-full items-center justify-between px-3 sm:px-4 lg:px-6 bg-[#fdfbf7] dark:bg-[#121016] border-b border-gray-200/70 dark:border-white/5">
      {/* V Mingle Logo */}
      <Link href="/" className="noSelect flex items-center gap-2.5 sm:gap-3 group" id="vmingle-logo-link">
        {/* Rounded Brand Icon */}
        <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-400 via-orange-500 to-rose-500 p-0.5 shadow-sm group-hover:scale-105 transition-transform overflow-hidden">
          <div className="h-full w-full rounded-[10px] bg-white flex items-center justify-center p-1 overflow-hidden">
            <img
              src="/favicon.png"
              alt="V Mingle logo"
              className="h-full w-full object-contain select-none pointer-events-none"
            />
          </div>
        </div>

        {/* Wordmark "V Mingle" in bold modern font */}
        <div className="flex flex-col">
          <span className="text-xl sm:text-[23px] font-black tracking-tight text-[#111827] dark:text-white leading-none">
            V Mingle
          </span>
          <span className="hidden sm:inline text-[9px] font-semibold text-gray-400 tracking-wider mt-0.5">
            Random Video &amp; Text Chat
          </span>
        </div>
      </Link>

      {/* Right Controls */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Dark/Light Pill Switch */}
        <button
          onClick={toggleDarkMode}
          className="relative flex h-6 w-11 cursor-pointer items-center rounded-full border border-gray-200/90 bg-white px-0.5 shadow-2xs transition-colors hover:border-gray-300 dark:border-gray-700 dark:bg-[#1e1d2c]"
          aria-label="Toggle dark mode"
          id="theme-toggle-btn"
        >
          {/* Thumb */}
          <span
            className={`h-4.5 w-4.5 rounded-full border border-gray-200/80 bg-white shadow-2xs transition-transform duration-200 dark:border-gray-600 dark:bg-[#2e2c40] ${
              isDark ? "translate-x-5" : "translate-x-0"
            }`}
          />

          {/* Icon Moon or Sun */}
          <span className="absolute right-1 text-[10px] select-none text-gray-400 dark:hidden">
            🌙
          </span>
          <span className="absolute left-1 text-[10px] select-none text-amber-300 hidden dark:inline">
            ☀️
          </span>
        </button>

        {/* Online Count Pill */}
        <div className="flex items-center gap-1.5 rounded-full border border-gray-200/90 bg-white px-3 py-1 shadow-2xs dark:border-gray-700 dark:bg-[#1a1724]">
          <span className="h-2 w-2 rounded-full bg-[#22c55e] animate-pulse" />
          <strong className="text-xs sm:text-sm font-bold text-[#f43f5e] dark:text-[#fb7185]">
            {onlineCount.endsWith("+") ? onlineCount : `${onlineCount}+`}
          </strong>
          <span className="text-xs text-gray-500 dark:text-gray-400 font-normal hidden min-[360px]:inline">
            online
          </span>
        </div>
      </div>
    </header>
  );
}
