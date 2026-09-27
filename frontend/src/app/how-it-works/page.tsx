import { Metadata } from "next";
import Link from "next/link";
import { MingleeHeader } from "@/components/MingleeHeader";
import { MingleeFooter } from "@/components/MingleeFooter";
import { constructMetadata, getBreadcrumbSchema, SITE_CONFIG } from "@/config/site";

export const metadata: Metadata = constructMetadata({
  title: "How It Works — Random Video & Text Matchmaking",
  description:
    "Learn how V Mingle connects you with strangers worldwide for random video chat and text chat. Discover interest matching, WebRTC peer-to-peer security, and safety guidelines.",
  canonical: "/how-it-works",
  keywords: [
    "how V Mingle works",
    "how VMingle works",
    "random video chat guide",
    "stranger chat matchmaking",
    "how to use V Mingle",
    "WebRTC stranger chat",
  ],
});

export default function HowItWorksPage() {
  const breadcrumbs = getBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "How It Works", url: "/how-it-works" },
  ]);

  return (
    <div className="min-h-screen flex flex-col bg-[#fdfbf7] text-[#111827]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }}
      />
      <MingleeHeader />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex items-center space-x-2 text-xs font-semibold text-gray-500">
            <li>
              <Link href="/" className="hover:text-rose-500 transition-colors">
                Home
              </Link>
            </li>
            <li>/</li>
            <li className="text-gray-900">How It Works</li>
          </ol>
        </nav>

        {/* Page Header */}
        <header className="mb-12">
          <span className="inline-block px-3.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-xs font-bold text-[#e11d48] uppercase tracking-wider mb-3">
            Matchmaking &amp; Technology Guide
          </span>
          <h1 className="text-3xl sm:text-5xl font-black text-gray-900 tracking-tight leading-tight">
            How V Mingle Works
          </h1>
          <p className="mt-4 text-base sm:text-lg text-gray-600 leading-relaxed">
            V Mingle (VMingle) makes meeting new people online effortless, instantaneous, and private. Learn how our smart matchmaker pairs you with strangers for live video calls and text chat.
          </p>
        </header>

        {/* 5-Step Visual Walkthrough */}
        <section className="mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight mb-8">
            The 5-Step Conversation Flow
          </h2>

          <div className="space-y-6">
            {/* Step 1 */}
            <div className="rounded-3xl border border-gray-200 bg-white p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row gap-5 items-start">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 font-black text-xl">
                1
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Select Your Preferred Chat Mode
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Decide whether you want to talk face-to-face via{" "}
                  <Link href="/video" className="text-rose-500 font-bold hover:underline">
                    Video Chat
                  </Link>{" "}
                  or type privately in{" "}
                  <Link href="/text" className="text-rose-500 font-bold hover:underline">
                    Text Chat
                  </Link>
                  . Video chat requires microphone and camera permissions in your browser, while text chat operates with zero hardware permissions required.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="rounded-3xl border border-gray-200 bg-white p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row gap-5 items-start">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-orange-600 font-black text-xl">
                2
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Add Your Interest Hashtags (Optional)
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Want to discuss gaming, music, coding, anime, or travel? Enter hashtags into the interest input box. When two users share common tags, our matchmaking algorithm prioritizes pairing them together so you start talking about topics you both love.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="rounded-3xl border border-gray-200 bg-white p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row gap-5 items-start">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 font-black text-xl">
                3
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Instant Matchmaking Engine Connects You
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Click the Launch button or press Enter. Our high-performance WebSocket signaling cluster queries the active queue in milliseconds and pairs you with another real, online user. No bots, no pre-recorded video loops, and zero waiting rooms.
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="rounded-3xl border border-gray-200 bg-white p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row gap-5 items-start">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-purple-100 text-purple-600 font-black text-xl">
                4
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Direct Encrypted Peer-to-Peer Communication
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  For video chat, browsers exchange WebRTC SDP offers and ICE candidates over encrypted TLS signaling, establishing a direct, peer-to-peer media pipeline (DTLS/SRTP). Your audio and video streams flow directly between participants without passing through intermediate video recording servers.
                </p>
              </div>
            </div>

            {/* Step 5 */}
            <div className="rounded-3xl border border-gray-200 bg-white p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row gap-5 items-start">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-pink-100 text-pink-600 font-black text-xl">
                5
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Seamless Skipping, Next Partner, and Reporting
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  You are always in control of your chat experience. Click <strong>Next</strong> (or tap <em>Esc</em>) at any moment to disconnect and find another stranger. If you encounter anyone violating our rules, click the <strong>Flag / Report</strong> icon to report them to our moderation team.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Security & Privacy Section */}
        <section className="mb-16 rounded-3xl bg-gradient-to-br from-amber-500/10 via-rose-500/10 to-pink-500/10 border border-rose-200/60 p-6 sm:p-10">
          <h2 className="text-2xl font-black text-gray-900 mb-4">
            Built for Privacy and User Anonymity
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-700 leading-relaxed">
            <div>
              <h3 className="font-bold text-gray-900 mb-1">Zero Personal Accounts</h3>
              <p>
                We do not collect email addresses, phone numbers, real names, or social media logins. Every session is initiated anonymously.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 mb-1">No Video Storage</h3>
              <p>
                Video and audio streams are directly peer-to-peer. V Mingle does not record, intercept, or save private video feeds.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 mb-1">Strict 18+ Age Policy</h3>
              <p>
                Participation is strictly limited to adults aged 18 and older. Read our{" "}
                <Link href="/safety" className="text-rose-500 font-bold hover:underline">
                  Safety Guidelines
                </Link>{" "}
                to learn how we enforce community standards.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 mb-1">Instant Session Teardown</h3>
              <p>
                Once you click Disconnect or close your browser tab, your temporary session key is wiped from memory immediately.
              </p>
            </div>
          </div>
        </section>

        {/* CTA Launch Cards */}
        <section className="text-center bg-white rounded-3xl border border-gray-200 p-8 sm:p-12 shadow-sm">
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-3">
            Ready to Start Mingling?
          </h2>
          <p className="text-sm text-gray-600 max-w-md mx-auto mb-8">
            Choose your mode and meet someone interesting in seconds.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/video"
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-orange-400 via-rose-500 to-pink-500 text-white font-bold text-sm shadow-md shadow-rose-500/25 hover:brightness-105 transition-all"
            >
              Start Video Chat →
            </Link>
            <Link
              href="/text"
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-sm border border-gray-200 transition-all"
            >
              Start Text Chat →
            </Link>
          </div>
        </section>
      </main>

      <MingleeFooter />
    </div>
  );
}
