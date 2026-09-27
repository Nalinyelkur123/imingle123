import { Metadata } from "next";
import Link from "next/link";
import { MingleeHeader } from "@/components/MingleeHeader";
import { MingleeFooter } from "@/components/MingleeFooter";
import { HomeHeroInteraction } from "@/components/HomeHeroInteraction";
import { HomeFaqAccordion } from "@/components/HomeFaqAccordion";
import { constructMetadata, getFaqSchema } from "@/config/site";

export const metadata: Metadata = constructMetadata({
  title: "Random Video Chat & Text Chat with Strangers",
  description:
    "V Mingle (VMingle) is a free random video chat and online text chat platform connecting people worldwide. Meet strangers instantly, chat anonymously, and enjoy secure peer-to-peer conversations with zero registration.",
  canonical: "/",
  keywords: [
    "V Mingle",
    "VMingle",
    "V Mingle chat",
    "V Mingle video chat",
    "V Mingle text chat",
    "V Mingle random chat",
    "V Mingle talk to strangers",
    "random video chat",
    "video chat with strangers",
    "random video chat online",
    "meet strangers through video chat",
    "random text chat",
    "text chat with strangers",
    "anonymous text chat",
    "random chat online",
    "talk to strangers online",
    "free video chat",
  ],
});

const FAQ_ITEMS = [
  {
    q: "What is V Mingle and how does it work?",
    a: "V Mingle (also written as VMingle) is a free, browser-based online chat platform that instantly pairs you with random strangers for 1-on-1 video chat or text chat conversations. No account, email, or application download is required. Simply select Video or Text, optionally enter your topics of interest, and start mingling immediately.",
  },
  {
    q: "Is V Mingle completely free to use?",
    a: "Yes, V Mingle is 100% free to use. You can jump into random video chat or anonymous text chat anytime without subscriptions, payment methods, or hidden fees.",
  },
  {
    q: "Do I need to create an account on V Mingle?",
    a: "No sign-up or personal profile is required. V Mingle operates on an anonymous-first architecture to protect user privacy. You can chat freely without providing your name, email, or social media accounts.",
  },
  {
    q: "How does interest-based matchmaking work?",
    a: "When you add interest tags (such as #music, #coding, #anime, or #gaming) in the interest bar, V Mingle's matchmaking engine searches for other online users who entered overlapping tags. If a match with shared interests is available, you will be paired together; otherwise, you are paired with a friendly random stranger.",
  },
  {
    q: "Is my privacy protected during video calls?",
    a: "Yes. All V Mingle video and audio streams are directly peer-to-peer encrypted through WebRTC technology. Your media flows directly between your browser and your chat partner's browser. V Mingle does not record, intercept, or store your live camera feed or private conversations.",
  },
  {
    q: "Can I use V Mingle on mobile phones and tablets?",
    a: "Absolutely. V Mingle is fully responsive and optimized for mobile devices (iOS Safari and Android Chrome). No app install is required—simply open your mobile browser, grant camera/microphone permissions if you choose video mode, and start chatting.",
  },
  {
    q: "What community safety guidelines does V Mingle enforce?",
    a: "V Mingle is strictly an 18+ platform. We enforce an uncompromising zero-tolerance policy against inappropriate content, harassment, hate speech, and illegal activities. Users can immediately skip or report anyone who violates our Community Rules using the in-chat reporting tool.",
  },
];

export default function HomePage() {
  const faqSchema = getFaqSchema(FAQ_ITEMS);

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-[#fdfbf7] text-[#111827] overflow-x-hidden selection:bg-rose-500/20 selection:text-[#f43f5e]">
      {/* Schema.org FAQPage Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

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

          {/* Large Bold Headline (Exact single H1 for Brand + Primary Keyword) */}
          <h1 className="mt-6 text-4xl sm:text-6xl lg:text-[80px] font-black tracking-tight text-[#0f172a] leading-[1.04]">
            Chat with<br />
            <span className="bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 bg-clip-text text-transparent">
              Strangers
            </span>
          </h1>

          {/* Supporting Subtitle */}
          <p className="mt-4 sm:mt-5 max-w-xl text-sm sm:text-base lg:text-[17px] text-gray-600 font-medium leading-relaxed px-4">
            Meet new people from around the world on <strong>V Mingle</strong> (VMingle). Have fun conversations, explore different cultures, and make new friends safely and anonymously.
          </p>

          {/* Interactive Chat Launcher (Client Island) */}
          <HomeHeroInteraction />

          {/* 4 Feature Highlights */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mt-12 sm:mt-16 w-full max-w-3xl">
            {/* Feature 1 */}
            <div className="flex flex-col items-center text-center p-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-500 mb-4 shadow-sm">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
              </div>
              <h3 className="text-base sm:text-[17px] font-bold text-gray-900 leading-snug">
                Interest<br />Matching
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-gray-500 max-w-[200px] leading-relaxed">
                Connect over shared passions.
              </p>
            </div>

            {/* Feature 2 */}
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
                Safe and respectful chats.
              </p>
            </div>

            {/* Feature 3 */}
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
                People from 190+ countries.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="flex flex-col items-center text-center p-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-rose-500 mb-4 shadow-sm">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7 2v11h3v9l7-12h-4l4-8z" />
                </svg>
              </div>
              <h3 className="text-base sm:text-[17px] font-bold text-gray-900 leading-snug">
                Instant &amp;<br />Anonymous
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-gray-500 max-w-[200px] leading-relaxed">
                Start chatting in seconds.
              </p>
            </div>
          </div>
        </div>

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
                HD Random Video Chat &amp; Calling
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 leading-relaxed mb-4">
                Connect face-to-face via WebRTC peer-to-peer media pipelines. V Mingle video calling enables low-latency, encrypted conversations with strangers worldwide with zero application downloads.
              </p>
              <Link href="/video" className="text-xs font-bold text-rose-500 hover:text-rose-600 inline-flex items-center gap-1">
                Explore Video Chat →
              </Link>
            </article>

            <article className="rounded-3xl bg-white border border-gray-200/80 p-5 sm:p-6 shadow-xs hover:border-orange-300 transition-colors">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600 font-bold mb-3.5 text-lg">
                💬
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-2">
                Anonymous Text Chat &amp; Meet Strangers
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 leading-relaxed mb-4">
                Prefer typing? V Mingle online chat offers lightning-fast, anonymous messaging. Meet interesting people, exchange viewpoints, and switch to a new partner whenever you choose.
              </p>
              <Link href="/text" className="text-xs font-bold text-rose-500 hover:text-rose-600 inline-flex items-center gap-1">
                Explore Text Chat →
              </Link>
            </article>

            <article className="rounded-3xl bg-white border border-gray-200/80 p-5 sm:p-6 shadow-xs hover:border-orange-300 transition-colors">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 font-bold mb-3.5 text-lg">
                🏷️
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-2">
                Interest Matching &amp; Tag Filtering
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 leading-relaxed mb-4">
                Add interest hashtags like #music, #coding, #anime, or #languages to find shared topics effortlessly. Our matchmaking algorithm connects you with like-minded individuals.
              </p>
              <Link href="/how-it-works" className="text-xs font-bold text-rose-500 hover:text-rose-600 inline-flex items-center gap-1">
                See How It Works →
              </Link>
            </article>
          </div>
        </section>

        {/* =============================================================== */}
        {/* HOW IT WORKS SECTION (Internal Links & Crawlability)             */}
        {/* =============================================================== */}
        <section className="w-full max-w-4xl mx-auto mt-20 sm:mt-24 px-4 text-center">
          <span className="rounded-full bg-amber-50 border border-amber-200 px-3.5 py-1 text-xs font-bold text-amber-600">
            Simple 3-Step Process
          </span>
          <h2 className="mt-3.5 text-2xl sm:text-3xl lg:text-4xl font-black text-gray-900 tracking-tight">
            How V Mingle Works
          </h2>
          <p className="mt-3 text-xs sm:text-sm text-gray-600 max-w-xl mx-auto leading-relaxed">
            Starting a conversation with a new friend or stranger takes less than 5 seconds.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10 text-left">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-50 text-rose-500 font-bold text-sm mb-3">1</span>
              <h3 className="font-bold text-gray-900 text-base mb-1.5">Choose Video or Text</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Click <Link href="/video" className="text-rose-500 font-semibold hover:underline">Video Chat</Link> for face-to-face conversations or <Link href="/text" className="text-rose-500 font-semibold hover:underline">Text Chat</Link> for quick anonymous messaging.
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-50 text-orange-500 font-bold text-sm mb-3">2</span>
              <h3 className="font-bold text-gray-900 text-base mb-1.5">Add Shared Interests</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Type in topics you care about like #travel, #movies, or #gaming so our smart matching engine can pair you with someone who shares your passions.
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-50 text-amber-500 font-bold text-sm mb-3">3</span>
              <h3 className="font-bold text-gray-900 text-base mb-1.5">Instant Connection</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Meet your new partner instantly. If you ever want to move on to another person, simply tap <em>Next</em> or <em>Esc</em> anytime.
              </p>
            </div>
          </div>

          <div className="mt-8">
            <Link
              href="/how-it-works"
              className="inline-flex items-center gap-2 rounded-2xl bg-white border border-gray-200 hover:border-gray-300 px-6 py-3 text-xs sm:text-sm font-bold text-gray-800 shadow-xs hover:shadow-sm transition-all"
            >
              Read Complete Guide: How V Mingle Works →
            </Link>
          </div>
        </section>

        {/* =============================================================== */}
        {/* FAQ ACCORDION SECTION                                            */}
        {/* =============================================================== */}
        <section className="w-full max-w-2xl mx-auto mt-20 sm:mt-24">
          <div className="flex flex-col items-center text-center mb-10">
            <span className="rounded-full bg-rose-50 border border-rose-200 px-3.5 py-1 text-xs font-bold text-[#e11d48]">
              Frequently Asked Questions
            </span>
            <h2 className="mt-3.5 text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">
              Got Questions?<br />
              <span className="bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 bg-clip-text text-transparent">
                We&apos;ve Got Answers.
              </span>
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-gray-500">
              Find answers to common questions about V Mingle, random chat, privacy, and safety.
            </p>
          </div>

          <HomeFaqAccordion items={FAQ_ITEMS} />

          <div className="text-center mt-6">
            <Link href="/faq" className="text-xs sm:text-sm font-semibold text-rose-500 hover:underline">
              View all frequently asked questions →
            </Link>
          </div>
        </section>

      </main>

      {/* Footer */}
      <MingleeFooter />
    </div>
  );
}
