import { Metadata } from "next";
import Link from "next/link";
import { MingleeHeader } from "@/components/MingleeHeader";
import { MingleeFooter } from "@/components/MingleeFooter";

export const metadata: Metadata = {
  title: "About Us — Connecting the World Through Spontaneous Conversations",
  description:
    "Learn about V Mingle, our mission to build a safe, spontaneous, and anonymous random video and text chat platform that brings people closer worldwide.",
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    title: "About V Mingle — Connecting the World Through Spontaneous Conversations",
    description:
      "Learn about V Mingle, our mission to build a safe, spontaneous, and anonymous random video and text chat platform.",
    url: "/about",
  },
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://vmingle.in";

export default function AboutPage() {
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "About V Mingle", item: `${SITE_URL}/about` },
    ],
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#fdfbf7] text-[#111827]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <MingleeHeader />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        {/* Header Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex items-center space-x-2 text-xs font-semibold text-gray-500">
            <li>
              <Link href="/" className="hover:text-rose-500 transition-colors">
                Home
              </Link>
            </li>
            <li>/</li>
            <li className="text-gray-900">About V Mingle</li>
          </ol>
        </nav>

        {/* Main Heading */}
        <header className="mb-10">
          <span className="inline-block px-3.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-xs font-bold text-[#e11d48] uppercase tracking-wider mb-3">
            Our Mission &amp; Vision
          </span>
          <h1 className="text-4xl sm:text-5xl font-black text-gray-900 tracking-tight leading-tight">
            Connecting People Worldwide Through Spontaneous Video Chat
          </h1>
          <p className="mt-4 text-lg text-gray-600 leading-relaxed font-medium">
            V Mingle was built with a single, clear goal: to make meeting new people online effortless, authentic, and safe.
          </p>
        </header>

        {/* Content Sections */}
        <article className="space-y-10 text-gray-700 leading-relaxed text-base sm:text-lg">
          <section className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200/80 shadow-xs">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight mb-3">
              What is V Mingle?
            </h2>
            <p>
              <strong>V Mingle</strong> (often searched as <em>VMingle</em>) is a modern, privacy-first random chat platform that pairs you with strangers across the globe for real-time 1-on-1 video and text conversations. Whether you are looking to practice a foreign language, discuss hobbies, or just have an engaging chat during a break, V Mingle connects you in seconds with no registration or personal details required.
            </p>
          </section>

          <section className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200/80 shadow-xs space-y-4">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
              Our Core Principles
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-100">
                <h3 className="font-bold text-gray-900 text-base mb-1">Instant Anonymity</h3>
                <p className="text-sm text-gray-600">
                  No signups, credit cards, or phone numbers. We believe the best interactions start with zero friction and full privacy.
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-orange-50/70 border border-orange-100">
                <h3 className="font-bold text-gray-900 text-base mb-1">Peer-to-Peer Privacy</h3>
                <p className="text-sm text-gray-600">
                  Our video calls use WebRTC peer-to-peer architecture. Video streams travel directly between participants and are never recorded or stored.
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-100">
                <h3 className="font-bold text-gray-900 text-base mb-1">Shared Passion Matching</h3>
                <p className="text-sm text-gray-600">
                  Smart interest tags pair you with strangers who share your favorite music, tech, travel destinations, or games.
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-pink-50/70 border border-pink-100">
                <h3 className="font-bold text-gray-900 text-base mb-1">Proactive Safety</h3>
                <p className="text-sm text-gray-600">
                  We enforce an explicit 18+ policy, continuous community reporting, and instant moderation tools to keep discussions respectful.
                </p>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200/80 shadow-xs">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight mb-3">
              How V Mingle Works
            </h2>
            <ol className="list-decimal list-inside space-y-3 font-medium text-gray-800">
              <li>
                <strong>Choose your format:</strong> Jump into high-definition <em>Video Chat</em> or quick <em>Text Chat</em> directly from your browser.
              </li>
              <li>
                <strong>Add your interests:</strong> Enter topics like <code>#music</code>, <code>#travel</code>, or <code>#coding</code> to meet like-minded strangers.
              </li>
              <li>
                <strong>Press Start:</strong> Our matchmaking engine pairs you with another online user instantly.
              </li>
              <li>
                <strong>Skip anytime:</strong> If a chat isn’t a good fit, hit <kbd className="px-1.5 py-0.5 rounded bg-gray-100 border text-xs font-mono">Esc</kbd> or click <em>Next</em> to connect with someone new immediately.
              </li>
            </ol>
          </section>

          {/* Call to action */}
          <div className="p-8 rounded-3xl bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 text-white text-center shadow-lg shadow-orange-500/20">
            <h2 className="text-2xl sm:text-3xl font-black">Ready to Start Mingling?</h2>
            <p className="mt-2 text-white/90 font-medium max-w-lg mx-auto text-sm sm:text-base">
              Experience the friendly, modern way to chat with strangers online. No download, no account required.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-4">
              <Link
                href="/video"
                className="px-6 py-3 rounded-2xl bg-white text-gray-900 font-bold text-sm shadow-md hover:bg-gray-50 transition-all cursor-pointer"
              >
                📹 Start Video Chat
              </Link>
              <Link
                href="/text"
                className="px-6 py-3 rounded-2xl bg-black/20 text-white font-bold text-sm hover:bg-black/30 transition-all cursor-pointer border border-white/20"
              >
                💬 Try Text Chat
              </Link>
            </div>
          </div>
        </article>
      </main>

      <MingleeFooter />
    </div>
  );
}
