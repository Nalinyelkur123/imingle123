"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";

export function VMingleHeader() {
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [selectedLang, setSelectedLang] = useState("EN");
  const langRef = useRef<HTMLDivElement>(null);

  const languages = [
    { code: "EN", label: "English" },
    { code: "ES", label: "Español" },
    { code: "FR", label: "Français" },
    { code: "DE", label: "Deutsch" },
    { code: "JA", label: "日本語" },
    { code: "PT", label: "Português" },
  ];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (langRef.current && !langRef.current.contains(event.target as Node)) {
        setLangMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-white/90 border-b border-gray-100 transition-all">
      <div className="w-full max-w-6xl mx-auto flex items-center justify-between px-6 sm:px-8 lg:px-12 h-20">
        
        {/* Left: Brand Logo & Tagline */}
        <Link href="/" className="flex items-center gap-3 group select-none shrink-0" id="vmingle-nav-brand">
          {/* Friendly Smiling Face Icon in Warm Yellow-Orange-Magenta Gradient */}
          <div className="relative flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-400 via-orange-500 to-rose-500 p-0.5 shadow-md shadow-orange-500/20 group-hover:scale-105 transition-transform overflow-hidden">
            <div className="h-full w-full rounded-[14px] bg-white flex items-center justify-center p-1.5 overflow-hidden">
              <img
                src="/favicon.png"
                alt="V Mingle logo"
                className="h-full w-full object-contain select-none pointer-events-none"
              />
            </div>
          </div>

          <div className="flex flex-col">
            <span className="text-2xl sm:text-[27px] font-black tracking-tight text-[#111827] leading-none">
              V Mingle
            </span>
            <span className="text-[10px] sm:text-[11px] font-semibold text-gray-500 tracking-wider mt-0.5">
              Random Video &amp; Text Chat
            </span>
          </div>
        </Link>

        {/* Right: Language Selector & CTA */}
        <div className="flex items-center gap-3 sm:gap-4 lg:gap-5 shrink-0">
          {/* Language Selector */}
          <div className="relative" ref={langRef}>
            <button
              onClick={() => setLangMenuOpen(!langMenuOpen)}
              className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-gray-700 hover:text-gray-900 py-2 px-2.5 sm:px-3 rounded-xl hover:bg-gray-100/70 transition-all cursor-pointer"
              aria-label="Select Language"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              <span>{selectedLang}</span>
              <span className="text-[10px] text-gray-400">▾</span>
            </button>

            {langMenuOpen && (
              <div className="absolute right-0 mt-2 w-36 rounded-2xl bg-white border border-gray-200 p-1.5 shadow-xl shadow-gray-200/50 z-50 animate-fade-in">
                {languages.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => {
                      setSelectedLang(l.code);
                      setLangMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-xl text-left transition-colors cursor-pointer ${
                      selectedLang === l.code
                        ? "bg-rose-50 text-[#f43f5e]"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <span>{l.label}</span>
                    {selectedLang === l.code && <span className="text-[10px]">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Primary Action Button */}
          <Link
            href="/video"
            className="flex items-center justify-center rounded-2xl bg-gradient-to-r from-orange-400 via-rose-500 to-pink-500 px-4 sm:px-7 py-2 sm:py-3 text-xs sm:text-[15px] font-bold text-white shadow-md shadow-rose-500/25 transition-all hover:brightness-105 active:scale-95 cursor-pointer whitespace-nowrap"
            id="header-start-btn"
          >
            Start Chatting
          </Link>
        </div>

      </div>
    </header>
  );
}

export { VMingleHeader as MingleeHeader };
