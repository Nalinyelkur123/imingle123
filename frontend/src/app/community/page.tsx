import { Metadata } from "next";
import Link from "next/link";
import { MingleeHeader } from "@/components/MingleeHeader";
import { MingleeFooter } from "@/components/MingleeFooter";

export const metadata: Metadata = {
  title: "Community Guidelines — Respectful Culture & Standards",
  description:
    "Read the V Mingle community standards. Discover how we nurture respectful, diverse, and authentic spontaneous conversations between strangers worldwide.",
  alternates: {
    canonical: "/community",
  },
  openGraph: {
    title: "Community Guidelines — V Mingle Culture & Standards",
    description:
      "Read the V Mingle community standards for respectful and positive random video chat.",
    url: "/community",
  },
};

export default function CommunityPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#fdfbf7] text-[#111827]">
      <MingleeHeader />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex items-center space-x-2 text-xs font-semibold text-gray-500">
            <li>
              <Link href="/" className="hover:text-rose-500 transition-colors">
                Home
              </Link>
            </li>
            <li>/</li>
            <li className="text-gray-900">Community Guidelines</li>
          </ol>
        </nav>

        <header className="mb-10">
          <span className="inline-block px-3.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-xs font-bold text-amber-700 uppercase tracking-wider mb-3">
            Community Standards
          </span>
          <h1 className="text-4xl sm:text-5xl font-black text-gray-900 tracking-tight leading-tight">
            Building a Respectful, Global Community
          </h1>
          <p className="mt-4 text-lg text-gray-600 leading-relaxed font-medium">
            V Mingle brings millions of people together across languages, cultures, and continents. Our community thrives when conversations are rooted in kindness and mutual respect.
          </p>
        </header>

        <article className="space-y-10 text-gray-700 leading-relaxed text-base sm:text-lg">
          <section className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200/80 shadow-xs space-y-4">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
              What Makes V Mingle Special
            </h2>
            <p>
              Unlike conventional social networks built around follower counts and curated profiles, V Mingle is about the magic of the unexpected. A two-minute conversation with someone in Tokyo, São Paulo, or Berlin can brighten your day and open your worldview.
            </p>
          </section>

          <section className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200/80 shadow-xs space-y-6">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
              Community Pillars
            </h2>
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-100/70">
                <h3 className="font-bold text-gray-900 text-lg mb-1">1. Respect Differences &amp; Perspectives</h3>
                <p className="text-sm sm:text-base text-gray-600">
                  You will encounter people from diverse backgrounds, political beliefs, and traditions. Treat everyone with empathy and curiosity rather than judgment.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-orange-50/50 border border-orange-100/70">
                <h3 className="font-bold text-gray-900 text-lg mb-1">2. Keep It Authentic</h3>
                <p className="text-sm sm:text-base text-gray-600">
                  Be yourself! Real human connections happen when people show up with good intentions and genuine conversation topics.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-rose-50/50 border border-rose-100/70">
                <h3 className="font-bold text-gray-900 text-lg mb-1">3. V Mingle is NOT a Dating Site</h3>
                <p className="text-sm sm:text-base text-gray-600">
                  Please do not demand age, gender, or romantic pursuit from strangers. V Mingle is an open social platform for casual, friendly conversations.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-pink-50/50 border border-pink-100/70">
                <h3 className="font-bold text-gray-900 text-lg mb-1">4. Protect Vulnerable Participants</h3>
                <p className="text-sm sm:text-base text-gray-600">
                  Any harassment, coercion, extortion, or harmful behavior will result in severe legal and platform repercussions.
                </p>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200/80 shadow-xs">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight mb-3">
              Great Conversation Starters
            </h2>
            <p className="text-sm sm:text-base text-gray-600 mb-4">
              Stuck on what to say after saying hello? Here are community-favorite icebreakers:
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm sm:text-base font-medium text-gray-800">
              <li className="p-3 bg-gray-50 rounded-xl border border-gray-200/70">🎵 &ldquo;What song are you listening to right now?&rdquo;</li>
              <li className="p-3 bg-gray-50 rounded-xl border border-gray-200/70">🍕 &ldquo;What is your favorite local food where you live?&rdquo;</li>
              <li className="p-3 bg-gray-50 rounded-xl border border-gray-200/70">✈️ &ldquo;Where is one place in the world you want to travel?&rdquo;</li>
              <li className="p-3 bg-gray-50 rounded-xl border border-gray-200/70">🎮 &ldquo;What hobby or video game are you obsessed with?&rdquo;</li>
            </ul>
          </section>
        </article>
      </main>

      <MingleeFooter />
    </div>
  );
}
