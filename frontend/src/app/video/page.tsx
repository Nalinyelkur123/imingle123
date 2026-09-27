import { Metadata } from "next";
import Link from "next/link";
import { ChatRoom } from "@/components/ChatRoom";
import { MingleeFooter } from "@/components/MingleeFooter";
import {
  constructMetadata,
  getSoftwareApplicationSchema,
  getBreadcrumbSchema,
  SITE_CONFIG,
} from "@/config/site";

export const metadata: Metadata = constructMetadata({
  title: "Random Video Chat With Strangers",
  description:
    "Start free random video chat on V Mingle (VMingle). Connect with strangers worldwide in 1-on-1 WebRTC video conversations. Instant, private, and no signup needed.",
  canonical: "/video",
  keywords: [
    "random video chat",
    "video chat with strangers",
    "random video chat online",
    "meet strangers through video chat",
    "V Mingle video chat",
    "VMingle video chat",
    "free random video call",
    "talk to strangers video",
    "anonymous video chat",
    "WebRTC video chat",
  ],
});

export default function VideoPage() {
  const breadcrumbSchema = getBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Video Chat", url: "/video" },
  ]);

  const softwareSchema = getSoftwareApplicationSchema({
    name: "V Mingle Video Chat",
    applicationCategory: "CommunicationApplication",
    description:
      "V Mingle random video chat pairs you instantly with strangers around the world for 1-on-1 live WebRTC video conversations.",
  });

  return (
    <div className="min-h-screen flex flex-col bg-[#fdfbf7] dark:bg-[#121016] text-[#111827] dark:text-[#f4f4f7]">
      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
      />

      {/* Main Interactive Video Chat Room */}
      <section className="flex-1 w-full" aria-label="Interactive Video Chat">
        <ChatRoom initialMode="video" />
      </section>

      {/* Semantic Crawlable Guide & Editorial Content */}
      <section className="w-full bg-white dark:bg-[#161520] border-t border-gray-200 dark:border-gray-800 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Breadcrumb Navigation */}
          <nav aria-label="Breadcrumb" className="mb-6">
            <ol className="flex items-center space-x-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
              <li>
                <Link href="/" className="hover:text-rose-500 transition-colors">
                  Home
                </Link>
              </li>
              <li>/</li>
              <li className="text-gray-900 dark:text-white">Video Chat</li>
            </ol>
          </nav>

          <header className="mb-10">
            <span className="inline-block px-3.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-xs font-bold text-[#e11d48] uppercase tracking-wider mb-3">
              WebRTC Video Calling
            </span>
            <h1 className="text-2xl sm:text-4xl font-black text-gray-900 dark:text-white tracking-tight leading-tight">
              Free Random Video Chat with Strangers on V Mingle
            </h1>
            <p className="mt-3 text-sm sm:text-base text-gray-600 dark:text-gray-300 leading-relaxed">
              Experience the spontaneity of real-time face-to-face conversations. V Mingle (VMingle) connects you with friendly people worldwide through secure, high-definition random video chat directly in your browser.
            </p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            <article className="rounded-2xl border border-gray-100 dark:border-gray-800 p-6 bg-gray-50/50 dark:bg-[#1a1725]">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2.5">
                ⚡ Instant WebRTC Connection
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                Connect face-to-face in milliseconds. V Mingle uses direct WebRTC peer-to-peer technology, transmitting audio and video straight between browsers without intermediate media recording servers. Enjoy ultra-low latency, crisp audio, and adaptive HD video streams.
              </p>
            </article>

            <article className="rounded-2xl border border-gray-100 dark:border-gray-800 p-6 bg-gray-50/50 dark:bg-[#1a1725]">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2.5">
                🔒 Anonymous &amp; Account-Free
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                No sign-up forms, phone numbers, or credit card entries. You can jump directly into video chat while keeping your identity private. All calls are ephemeral and vanish the second either person disconnects.
              </p>
            </article>

            <article className="rounded-2xl border border-gray-100 dark:border-gray-800 p-6 bg-gray-50/50 dark:bg-[#1a1725]">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2.5">
                🏷️ Interest Matching Support
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                Want to speak about specific topics? Add your favorite hobbies, sports, languages, or coding languages as tags before launching. Our matchmaking system prioritizes pairing you with users who share those exact tags.
              </p>
            </article>

            <article className="rounded-2xl border border-gray-100 dark:border-gray-800 p-6 bg-gray-50/50 dark:bg-[#1a1725]">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2.5">
                🛡️ Community Safety &amp; Reporting
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                V Mingle strictly enforces an 18+ policy and zero tolerance for harassment, nudity, or inappropriate conduct. Our one-click reporting button lets you flag violations immediately for swift moderation action.
              </p>
            </article>
          </div>

          {/* Contextual Links */}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-6 text-center bg-gray-50 dark:bg-[#12101a]">
            <h3 className="font-bold text-gray-900 dark:text-white text-base mb-2">
              Explore More on V Mingle
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-4">
              Prefer typing without a camera? Or want to learn more about our privacy architecture?
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-bold">
              <Link href="/text" className="px-4 py-2 rounded-xl bg-white dark:bg-gray-800 text-rose-500 border border-gray-200 dark:border-gray-700 hover:shadow-xs transition-all">
                Try Text Chat →
              </Link>
              <Link href="/how-it-works" className="px-4 py-2 rounded-xl bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:shadow-xs transition-all">
                How It Works →
              </Link>
              <Link href="/safety" className="px-4 py-2 rounded-xl bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:shadow-xs transition-all">
                Safety Guidelines →
              </Link>
              <Link href="/rules" className="px-4 py-2 rounded-xl bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:shadow-xs transition-all">
                Community Rules →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <MingleeFooter />
    </div>
  );
}
