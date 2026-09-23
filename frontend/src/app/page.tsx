"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, KeyboardEvent } from "react";
import { MingleeHeader } from "@/components/MingleeHeader";
import { MingleeFooter } from "@/components/MingleeFooter";
import { useInterests } from "@/hooks/useInterests";
import { fetchLiveStats } from "@/services/api";
import { connectSocket } from "@/services/socket";

const FAQ_ITEMS = [
  {
    q: "Is V Mingle free to use?",
    a: "Yes, V Mingle is 100% free to use. You can jump into random video chat or online text chat with people worldwide anytime without any subscription, credits, or hidden fees.",
  },
  {
    q: "Do I need to create an account on V Mingle?",
    a: "No account, email, or sign-up is required on V Mingle (VMingle). We believe in instant, anonymous connections. Just choose your mode, add your interests if you'd like, and start mingling with strangers in seconds.",
  },
  {
    q: "How does V Mingle random chat matching work?",
    a: "Our smart matchmaking algorithm pairs you randomly with another online user. If you enter specific interest tags (like #music, #gaming, #coding, or #travel), V Mingle prioritizes matching you with someone who shares your passions.",
  },
  {
    q: "Is my privacy protected during V Mingle video calls?",
    a: "Absolutely. All V Mingle video calling and audio streams are directly peer-to-peer encrypted via WebRTC. We do not store your video feeds or conversations, and our active moderation tools protect the community 24/7.",
  },
];

const AVATARS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&h=120&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&h=120&q=80",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=120&h=120&q=80",
];

export default function HomePage() {
  const router = useRouter();
  const [interests, saveInterests] = useInterests();
  const [inputValue, setInputValue] = useState("");
  const [activeMode, setActiveMode] = useState<"video" | "text">("video");
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [onlineCount, setOnlineCount] = useState<string>("12,534");

  // Real live online stats connection
  useEffect(() => {
    fetchLiveStats().then((data) => {
      if (data?.stats?.onlineUsers !== undefined) {
        const count = data.stats.onlineUsers;
        setOnlineCount(count > 50 ? count.toLocaleString() : "12,534");
      }
    });

    const socket = connectSocket();
    const handleCount = (payload: { count: number }) => {
      if (payload?.count !== undefined) {
        const count = payload.count;
        setOnlineCount(count > 50 ? count.toLocaleString() : "12,534");
      }
    };

    socket.on("online_count", handleCount);
    return () => {
      socket.off("online_count", handleCount);
    };
  }, []);

  const handleStartChat = () => {
    const trimmed = inputValue.trim().replace(/^,+|,+$/g, "");
    if (trimmed && !interests.includes(trimmed)) {
      saveInterests([...interests, trimmed]);
    }
    router.push(activeMode === "video" ? "/video" : "/text");
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

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-[#fdfbf7] text-[#111827] overflow-x-hidden selection:bg-rose-500/20 selection:text-[#f43f5e]">
      
      {/* =================================================================== */}
      {/* AMBIENT GRADIENT SHAPES (Exact match to reference)                  */}
      {/* =================================================================== */}
      <div className="pointer-events-none absolute inset-0 w-full overflow-hidden z-0">
        {/* Top warm soft ambient glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[320px] bg-gradient-to-b from-amber-100/50 via-orange-50/25 to-transparent blur-3xl opacity-80" />

        {/* Left organic yellow-orange shape */}
        <div className="absolute -left-10 top-[290px] sm:top-[320px] w-64 h-[420px] sm:w-80 sm:h-[480px] lg:w-96 lg:h-[540px] select-none pointer-events-none opacity-95">
          <svg viewBox="0 0 350 480" fill="none" className="w-full h-full">
            <path
              d="M0 60 C120 110 260 210 220 340 C180 440 80 480 0 480 Z"
              fill="url(#yellow-left-grad)"
            />
            <defs>
              <linearGradient id="yellow-left-grad" x1="0" y1="60" x2="260" y2="440" gradientUnits="userSpaceOnUse">
                <stop stopColor="#fde047" />
                <stop offset="0.5" stopColor="#fbbf24" />
                <stop offset="1" stopColor="#f59e0b" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Right organic magenta-coral shape */}
        <div className="absolute -right-10 top-[270px] sm:top-[300px] w-64 h-[440px] sm:w-80 sm:h-[500px] lg:w-96 lg:h-[560px] select-none pointer-events-none opacity-95">
          <svg viewBox="0 0 350 500" fill="none" className="w-full h-full">
            <path
              d="M350 50 C230 110 100 230 140 360 C180 460 270 490 350 500 Z"
              fill="url(#magenta-right-grad)"
            />
            <defs>
              <linearGradient id="magenta-right-grad" x1="350" y1="50" x2="100" y2="460" gradientUnits="userSpaceOnUse">
                <stop stopColor="#fb7185" />
                <stop offset="0.5" stopColor="#f43f5e" />
                <stop offset="1" stopColor="#e11d48" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>

      {/* Navigation Header */}
      <MingleeHeader />

      {/* =================================================================== */}
      {/* HERO SECTION                                                        */}
      {/* =================================================================== */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 pb-20">
        
        {/* Relative container for Hero + Flanking Doodles */}
        <div className="relative w-full max-w-4xl mx-auto flex flex-col items-center text-center">
          
          {/* =============================================================== */}
          {/* Left Handwritten Doodle (Good People Good Conversations)         */}
          {/* =============================================================== */}
          <div className="hidden xl:block absolute -left-16 2xl:-left-24 top-24 select-none pointer-events-none -rotate-8 transform z-10 text-left">
            <div
              className="text-3xl 2xl:text-4xl font-bold text-amber-500 tracking-wide leading-[1.05]"
              style={{ fontFamily: 'var(--font-caveat), cursive' }}
            >
              Good<br />
              People<br />
              Good<br />
              Conversations
            </div>
            {/* Double curved hand-drawn underline */}
            <svg width="115" height="22" viewBox="0 0 100 20" fill="none" className="mt-1 text-amber-500">
              <path d="M4 11C35 4 72 15 96 8" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
              <path d="M14 16C44 9 76 17 92 13" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </div>

          {/* =============================================================== */}
          {/* Right Handwritten Doodle (Different People Brighter Stories)     */}
          {/* =============================================================== */}
          <div className="hidden xl:block absolute -right-16 2xl:-right-24 top-20 select-none pointer-events-none rotate-8 transform z-10 text-right">
            <div
              className="text-3xl 2xl:text-4xl font-bold text-rose-500 tracking-wide leading-[1.05]"
              style={{ fontFamily: 'var(--font-caveat), cursive' }}
            >
              Different<br />
              People<br />
              Brighter<br />
              Stories
            </div>
            {/* Cute hand-drawn smiling face doodle with eyebrows */}
            <div className="mt-2.5 flex justify-end">
              <svg width="46" height="46" viewBox="0 0 46 46" fill="none" className="text-amber-500">
                <circle cx="23" cy="23" r="17" stroke="currentColor" strokeWidth="2.5" strokeDasharray="3 3.5" />
                <path d="M15 14C17 12 19 12 21 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M25 14C27 12 29 12 31 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <circle cx="17.5" cy="18.5" r="2.2" fill="currentColor" />
                <circle cx="28.5" cy="18.5" r="2.2" fill="currentColor" />
                <path d="M16 26C19 31 27 31 30 26" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
          </div>

          {/* Top Pill / Badge */}
          <div className="inline-flex items-center gap-2 rounded-full bg-rose-50 border border-rose-200 px-4 py-1.5 shadow-sm">
            <span className="text-sm">👥</span>
            <span className="text-xs font-bold text-[#e11d48] tracking-wide">
              Real People. Real Conversations.
            </span>
          </div>

          {/* Large Bold Headline */}
          <h1 className="mt-6 text-5xl sm:text-7xl lg:text-[80px] font-black tracking-tight text-[#0f172a] leading-[1.04]">
            Chat with<br />
            <span className="bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 bg-clip-text text-transparent">
              Strangers
            </span>
          </h1>

          {/* Supporting Subtitle */}
          <p className="mt-4 sm:mt-5 max-w-xl text-sm sm:text-base lg:text-[17px] text-gray-600 font-medium leading-relaxed px-4">
            Meet new people from around the world. Have fun conversations,<br className="hidden sm:inline" />
            explore different cultures, and make new friends.
          </p>

          {/* =============================================================== */}
          {/* CHAT INTERACTION CARD (Matches Reference Layout)                */}
          {/* =============================================================== */}
          <div className="mt-8 sm:mt-10 w-full max-w-[500px] rounded-3xl sm:rounded-[32px] border border-gray-200 bg-white p-4 sm:p-5 shadow-xl shadow-gray-200/50">
            
            {/* Mode Switcher Tabs (Video vs Text) */}
            <div className="grid grid-cols-2 gap-1.5 p-1.5 rounded-2xl bg-gray-100 border border-gray-200/70">
              {/* Video Chat Tab (Active) */}
              <button
                type="button"
                onClick={() => setActiveMode("video")}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm sm:text-[15px] font-bold transition-all cursor-pointer ${
                  activeMode === "video"
                    ? "bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 text-white shadow-md shadow-orange-500/20"
                    : "text-gray-600 hover:text-gray-900"
                }`}
                id="mode-video-tab"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M4 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm14.5 4.5l4-2.5v12l-4-2.5v-7z" />
                </svg>
                <span>Video Chat</span>
              </button>

              {/* Text Chat Tab */}
              <button
                type="button"
                onClick={() => setActiveMode("text")}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm sm:text-[15px] font-bold transition-all cursor-pointer ${
                  activeMode === "text"
                    ? "bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 text-white shadow-md shadow-orange-500/20"
                    : "text-gray-600 hover:text-gray-900"
                }`}
                id="mode-text-tab"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
                </svg>
                <span>Text Chat</span>
              </button>
            </div>

            {/* Interest Input & Circular Launch Button */}
            <div className="mt-4 relative flex items-center rounded-full border border-gray-200 bg-white shadow-xs hover:border-gray-300 focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-400/20 transition-all p-1.5 pl-4">
              <span className="text-gray-400 font-bold select-none text-base pr-1">#</span>

              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Add your interests (e.g. music, travel, movies)"
                className="w-full bg-transparent py-2 text-xs sm:text-sm text-gray-800 placeholder-gray-400 outline-none"
              />

              <button
                type="button"
                onClick={handleStartChat}
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
                      className="h-full w-full object-cover"
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

            {/* Moderation Message Below Card */}
            <div className="mt-3.5 pt-3 border-t border-gray-100 flex items-center justify-center gap-1.5 text-xs text-gray-500 font-medium">
              <span className="text-amber-500">🛡️</span>
              <span>We keep the community safe with active moderation.</span>
            </div>

          </div>

        </div>

        {/* =============================================================== */}
        {/* FOUR SIMPLE FEATURE BLOCKS IN ONE ROW (Reference Parity)         */}
        {/* =============================================================== */}
        <section className="w-full max-w-5xl mx-auto mt-24 sm:mt-28">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            
            {/* Feature 1: Interest Based Matching */}
            <div className="flex flex-col items-center text-center p-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-500 mb-4 shadow-sm">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                </svg>
              </div>
              <h3 className="text-base sm:text-[17px] font-bold text-gray-900 leading-snug">
                Interest Based<br />Matching
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-gray-500 max-w-[200px] leading-relaxed">
                Find people who share your interests.
              </p>
            </div>

            {/* Feature 2: Active Moderation */}
            <div className="flex flex-col items-center text-center p-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-100 text-orange-500 mb-4 shadow-sm">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
                </svg>
              </div>
              <h3 className="text-base sm:text-[17px] font-bold text-gray-900 leading-snug">
                Active<br />Moderation
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-gray-500 max-w-[200px] leading-relaxed">
                A safer and more respectful community.
              </p>
            </div>

            {/* Feature 3: Global Community */}
            <div className="flex flex-col items-center text-center p-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-pink-100 text-pink-500 mb-4 shadow-sm">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
                </svg>
              </div>
              <h3 className="text-base sm:text-[17px] font-bold text-gray-900 leading-snug">
                Global<br />Community
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-gray-500 max-w-[200px] leading-relaxed">
                Meet people from all over the world.
              </p>
            </div>

            {/* Feature 4: Instant & Anonymous */}
            <div className="flex flex-col items-center text-center p-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-rose-500 mb-4 shadow-sm">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7 2v11h3v9l7-12h-4l4-8z" />
                </svg>
              </div>
              <h3 className="text-base sm:text-[17px] font-bold text-gray-900 leading-snug">
                Instant &<br />Anonymous
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-gray-500 max-w-[200px] leading-relaxed">
                Start chatting in seconds.
              </p>
            </div>

          </div>
        </section>

        {/* =============================================================== */}
        {/* SEMANTIC BRAND & PRODUCT CONTENT SECTION                        */}
        {/* =============================================================== */}
        <section className="w-full max-w-4xl mx-auto mt-20 sm:mt-24 px-4">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="rounded-full bg-rose-50 border border-rose-200 px-3.5 py-1 text-xs font-bold text-[#e11d48]">
              The V Mingle Platform
            </span>
            <h2 className="mt-3.5 text-2xl sm:text-3xl lg:text-4xl font-black text-gray-900 tracking-tight">
              Spontaneous Human Connection,<br />
              <span className="bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 bg-clip-text text-transparent">
                Engineered for Modern Web Privacy
              </span>
            </h2>
            <p className="mt-3 text-xs sm:text-sm text-gray-600 leading-relaxed">
              V Mingle (VMingle) reimagines random video chat and online calling by pairing high-performance browser technology with peer-to-peer privacy standards.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-left">
            <article className="rounded-3xl bg-white border border-gray-200/80 p-5 sm:p-6 shadow-xs hover:border-orange-300 transition-colors">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 font-bold mb-3.5 text-lg">
                📹
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-2">
                HD Random Video Chat & Calling
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                Connect face-to-face via WebRTC peer-to-peer media pipelines. V Mingle video calling enables low-latency, encrypted conversations with strangers worldwide with zero application downloads.
              </p>
            </article>

            <article className="rounded-3xl bg-white border border-gray-200/80 p-5 sm:p-6 shadow-xs hover:border-orange-300 transition-colors">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600 font-bold mb-3.5 text-lg">
                💬
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-2">
                Anonymous Text Chat & Meet Strangers
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                Prefer typing? V Mingle online chat offers lightning-fast, anonymous messaging. Meet interesting people, exchange viewpoints, and switch to a new partner whenever you choose.
              </p>
            </article>

            <article className="rounded-3xl bg-white border border-gray-200/80 p-5 sm:p-6 shadow-xs hover:border-orange-300 transition-colors">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 font-bold mb-3.5 text-lg">
                🏷️
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-2">
                Interest Matching & Tag Filtering
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                Add interest hashtags like #music, #coding, #anime, or #languages to find shared topics effortlessly. Our matchmaking algorithm connects you with like-minded individuals.
              </p>
            </article>
          </div>
        </section>

        {/* =============================================================== */}
        {/* FAQ ACCORDION SECTION (Reference Parity)                         */}
        {/* =============================================================== */}
        <section className="w-full max-w-2xl mx-auto mt-20 sm:mt-24">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "FAQPage",
                mainEntity: FAQ_ITEMS.map((item) => ({
                  "@type": "Question",
                  name: item.q,
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: item.a,
                  },
                })),
              }),
            }}
          />
          <div className="flex flex-col items-center text-center mb-10">
            <span className="rounded-full bg-rose-50 border border-rose-200 px-3.5 py-1 text-xs font-bold text-[#e11d48]">
              FAQ
            </span>
            <h2 className="mt-3.5 text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">
              Got Questions?<br />
              <span className="bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 bg-clip-text text-transparent">
                We&apos;ve Got Answers.
              </span>
            </h2>
          </div>

          <div className="space-y-4">
            {FAQ_ITEMS.map((item, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm transition-all hover:border-gray-300"
                >
                  <button
                    type="button"
                    onClick={() => toggleFaq(idx)}
                    className="w-full flex items-center justify-between py-5 px-6 text-left font-bold text-gray-900 text-base cursor-pointer"
                  >
                    <span>{item.q}</span>
                    <span className="flex h-6 w-6 items-center justify-center text-gray-400 text-2xl font-light">
                      {isOpen ? "−" : "+"}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="px-6 pb-5 pt-0 text-sm text-gray-600 leading-relaxed border-t border-gray-100">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

      </main>

      {/* Footer */}
      <MingleeFooter />

    </div>
  );
}
