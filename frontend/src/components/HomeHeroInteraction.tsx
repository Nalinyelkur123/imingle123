"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, KeyboardEvent } from "react";
import { useInterests } from "@/hooks/useInterests";
import { fetchLiveStats } from "@/services/api";
import { connectSocket } from "@/services/socket";

const AVATARS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&h=120&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&h=120&q=80",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=120&h=120&q=80",
];

export function HomeHeroInteraction() {
  const router = useRouter();
  const [interests, saveInterests] = useInterests();
  const [inputValue, setInputValue] = useState("");
  const [activeMode, setActiveMode] = useState<"video" | "text">("video");
  const [onlineCount, setOnlineCount] = useState<string>("12,500+");

  useEffect(() => {
    fetchLiveStats().then((data) => {
      if (data?.stats?.onlineUsers !== undefined) {
        setOnlineCount(data.stats.onlineUsers.toLocaleString());
      }
    });

    const socket = connectSocket();
    const handleCount = (payload: { count: number }) => {
      if (payload?.count !== undefined) {
        setOnlineCount(payload.count.toLocaleString());
      }
    };

    socket.on("online_count", handleCount);
    return () => {
      socket.off("online_count", handleCount);
    };
  }, []);

  const handleStartChat = (overrideMode?: "video" | "text") => {
    const targetMode = overrideMode || activeMode;
    const trimmed = inputValue.trim().replace(/^,+|,+$/g, "");
    if (trimmed && !interests.includes(trimmed)) {
      saveInterests([...interests, trimmed]);
    }
    router.push(targetMode === "video" ? "/video" : "/text");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const trimmed = inputValue.trim().replace(/^,+|,+$/g, "");
      if (trimmed && !interests.includes(trimmed)) {
        saveInterests([...interests, trimmed]);
        setInputValue("");
      } else {
        handleStartChat();
      }
    }
  };

  return (
    <div className="mt-8 sm:mt-10 w-full max-w-[500px] rounded-3xl sm:rounded-[32px] border border-gray-200 bg-white p-4 sm:p-5 shadow-xl shadow-gray-200/50">
      {/* Direct Navigation Buttons (Video Chat → /video, Text Chat → /text) */}
      <div className="grid grid-cols-2 gap-1.5 p-1.5 rounded-2xl bg-gray-100 border border-gray-200/70">
        {/* Video Chat — navigates immediately to /video */}
        <Link
          href="/video"
          onClick={() => {
            const trimmed = inputValue.trim().replace(/^,+|,+$/g, "");
            if (trimmed && !interests.includes(trimmed)) {
              saveInterests([...interests, trimmed]);
            }
            setActiveMode("video");
          }}
          className={`flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 sm:py-3 px-2 sm:px-4 rounded-xl text-xs sm:text-[15px] font-bold transition-all cursor-pointer select-none ${
            activeMode === "video"
              ? "bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 text-white shadow-md shadow-orange-500/20 hover:brightness-105 active:scale-95"
              : "text-gray-700 hover:text-gray-900 hover:bg-white/80 active:scale-95"
          }`}
          id="mode-video-tab"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M4 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm14.5 4.5l4-2.5v12l-4-2.5v-7z" />
          </svg>
          <span>Video Chat</span>
        </Link>

        {/* Text Chat — navigates immediately to /text */}
        <Link
          href="/text"
          onClick={() => {
            const trimmed = inputValue.trim().replace(/^,+|,+$/g, "");
            if (trimmed && !interests.includes(trimmed)) {
              saveInterests([...interests, trimmed]);
            }
            setActiveMode("text");
          }}
          className={`flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 sm:py-3 px-2 sm:px-4 rounded-xl text-xs sm:text-[15px] font-bold transition-all cursor-pointer select-none ${
            activeMode === "text"
              ? "bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 text-white shadow-md shadow-orange-500/20 hover:brightness-105 active:scale-95"
              : "text-gray-700 hover:text-gray-900 hover:bg-white/80 active:scale-95"
          }`}
          id="mode-text-tab"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
          </svg>
          <span>Text Chat</span>
        </Link>
      </div>

      {/* Interest Input & Circular Launch Button */}
      <div className="mt-4 relative flex items-center rounded-full border border-gray-200 bg-white shadow-xs hover:border-gray-300 focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-400/20 transition-all p-1.5 pl-3 sm:pl-4">
        <span className="text-gray-400 font-bold select-none text-base pr-1">#</span>

        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add your interests (e.g. music, travel, movies)"
          className="w-full min-w-0 bg-transparent py-2 text-xs sm:text-sm text-gray-800 placeholder-gray-400 outline-none"
        />

        <button
          type="button"
          onClick={() => handleStartChat()}
          className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-orange-400 via-rose-500 to-pink-500 text-white shadow-md shadow-rose-500/25 hover:brightness-105 active:scale-95 transition-all cursor-pointer"
          title="Start Chatting"
          id="launch-chat-btn"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      </div>

      {/* Avatar Stack & Dynamic Online Count */}
      <div className="mt-4 flex items-center justify-center gap-3">
        <div className="flex -space-x-2 overflow-hidden">
          {AVATARS.map((src, i) => (
            <div key={i} className="relative h-7 w-7 rounded-full border-2 border-white shadow-xs overflow-hidden">
              <img
                src={src}
                alt={`Active V Mingle community member ${i + 1}`}
                width={28}
                height={28}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
          ))}
        </div>

        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
          <span className="h-2 w-2 rounded-full bg-[#22c55e] animate-pulse" />
          <span className="font-bold text-gray-900">{onlineCount}</span>
          <span className="text-gray-500 font-normal">people online now</span>
        </div>
      </div>
    </div>
  );
}
