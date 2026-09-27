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
  title: "Random Text Chat With Strangers",
  description:
    "Chat anonymously with random strangers on V Mingle (VMingle). Fast, free, lightweight online text chat with interest tags. No login, no profile, 100% private.",
  canonical: "/text",
  keywords: [
    "random text chat",
    "text chat with strangers",
    "anonymous text chat",
    "random chat online",
    "V Mingle text chat",
    "VMingle text chat",
    "chat with strangers online",
    "free text chat",
    "talk to strangers online",
    "stranger chat without video",
  ],
});

export default function TextPage() {
  const breadcrumbSchema = getBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Text Chat", url: "/text" },
  ]);

  const softwareSchema = getSoftwareApplicationSchema({
    name: "V Mingle Text Chat",
    applicationCategory: "CommunicationApplication",
    description:
      "V Mingle anonymous text chat connects you instantly with strangers worldwide for lightweight, fast 1-on-1 typing conversations.",
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

      {/* Main Interactive Text Chat Room */}
      <section className="flex-1 w-full" aria-label="Interactive Text Chat">
        <ChatRoom initialMode="text" />
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
              <li className="text-gray-900 dark:text-white">Text Chat</li>
            </ol>
          </nav>

          <header className="mb-10">
            <span className="inline-block px-3.5 py-1 rounded-full bg-orange-50 dark:bg-orange-950/50 border border-orange-200 dark:border-orange-900 text-xs font-bold text-orange-600 uppercase tracking-wider mb-3">
              Anonymous Messaging
            </span>
            <h1 className="text-2xl sm:text-4xl font-black text-gray-900 dark:text-white tracking-tight leading-tight">
              Anonymous Random Text Chat with Strangers
            </h1>
            <p className="mt-3 text-sm sm:text-base text-gray-600 dark:text-gray-300 leading-relaxed">
              Prefer typing over camera interactions? V Mingle (VMingle) text chat offers lightning-fast, anonymous messaging that lets you converse freely without sharing your voice or face.
            </p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            <article className="rounded-2xl border border-gray-100 dark:border-gray-800 p-6 bg-gray-50/50 dark:bg-[#1a1725]">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2.5">
                💬 Complete Visual &amp; Audio Privacy
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                Text chat requires zero camera or microphone access. Enjoy thoughtful, deep conversations or quick witty exchanges while remaining completely off-camera. Your physical environment and identity remain 100% private.
              </p>
            </article>

            <article className="rounded-2xl border border-gray-100 dark:border-gray-800 p-6 bg-gray-50/50 dark:bg-[#1a1725]">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2.5">
                🚀 Lightweight &amp; Bandwidth Friendly
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                Whether you are on high-speed Wi-Fi or a constrained mobile data connection, V Mingle text chat operates smoothly without buffering, audio stutter, or high battery consumption. Real-time WebSocket delivery guarantees zero lag.
              </p>
            </article>

            <article className="rounded-2xl border border-gray-100 dark:border-gray-800 p-6 bg-gray-50/50 dark:bg-[#1a1725]">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2.5">
                🎯 Deep Interest Tag Filtering
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                Discuss philosophy, literature, coding problems, music recommendations, or relationship advice. Tag your chat with hashtags (#books, #python, #gaming) to connect directly with users seeking intellectual conversations.
              </p>
            </article>

            <article className="rounded-2xl border border-gray-100 dark:border-gray-800 p-6 bg-gray-50/50 dark:bg-[#1a1725]">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2.5">
                🧹 Ephemeral Messaging Logs
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                All messages exist only in your current browser session. Once either you or your partner clicks Disconnect, the conversation is wiped permanently from client memory and never saved to databases.
              </p>
            </article>
          </div>

          {/* Contextual Links */}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-6 text-center bg-gray-50 dark:bg-[#12101a]">
            <h3 className="font-bold text-gray-900 dark:text-white text-base mb-2">
              Ready to Upgrade to Video?
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-4">
              Feel like having a real face-to-face conversation? Switch to Video Chat with a single click.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-bold">
              <Link href="/video" className="px-4 py-2 rounded-xl bg-gradient-to-r from-orange-400 via-rose-500 to-pink-500 text-white shadow-xs hover:brightness-105 transition-all">
                Switch to Video Chat →
              </Link>
              <Link href="/how-it-works" className="px-4 py-2 rounded-xl bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:shadow-xs transition-all">
                How Matching Works →
              </Link>
              <Link href="/community" className="px-4 py-2 rounded-xl bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:shadow-xs transition-all">
                Community Standards →
              </Link>
              <Link href="/faq" className="px-4 py-2 rounded-xl bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:shadow-xs transition-all">
                FAQ →
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
