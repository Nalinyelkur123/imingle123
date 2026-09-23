import { Metadata } from "next";
import Link from "next/link";
import { MingleeHeader } from "@/components/MingleeHeader";
import { MingleeFooter } from "@/components/MingleeFooter";

export const metadata: Metadata = {
  title: "Safety & Moderation — Keeping Online Video Chat Safe",
  description:
    "Learn about V Mingle's safety guidelines, strict 18+ policy, zero tolerance for harassment, peer-to-peer encryption, and one-click user reporting tools.",
  alternates: {
    canonical: "/safety",
  },
  openGraph: {
    title: "Safety & Moderation at V Mingle — Keeping Online Video Chat Safe",
    description:
      "Learn about V Mingle's safety guidelines, strict 18+ policy, zero tolerance for harassment, and reporting tools.",
    url: "/safety",
  },
};

export default function SafetyPage() {
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
            <li className="text-gray-900">Safety &amp; Moderation</li>
          </ol>
        </nav>

        <header className="mb-10">
          <span className="inline-block px-3.5 py-1 rounded-full bg-red-50 border border-red-200 text-xs font-bold text-red-600 uppercase tracking-wider mb-3">
            Safety &amp; Trust Center
          </span>
          <h1 className="text-4xl sm:text-5xl font-black text-gray-900 tracking-tight leading-tight">
            Safety &amp; Moderation on V Mingle
          </h1>
          <p className="mt-4 text-lg text-gray-600 leading-relaxed font-medium">
            Your safety and dignity are our highest priority. Learn how V Mingle protects users and how you can stay safe during video and text chats.
          </p>
        </header>

        <article className="space-y-10 text-gray-700 leading-relaxed text-base sm:text-lg">
          {/* 18+ Rule Card */}
          <section className="bg-red-500/10 border border-red-500/30 rounded-3xl p-6 sm:p-8 flex items-start gap-5">
            <span className="flex shrink-0 items-center justify-center h-12 w-12 rounded-2xl bg-red-600 text-white font-black text-lg shadow-sm">
              18+
            </span>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-red-900 mb-2">
                Strict 18+ Adult Platform Requirement
              </h2>
              <p className="text-sm sm:text-base text-red-950 font-medium">
                V Mingle is strictly reserved for individuals aged 18 years and older. Minors are strictly prohibited from using this service. Anyone found or reported to be underage is immediately and permanently banned.
              </p>
            </div>
          </section>

          {/* Zero Tolerance Policies */}
          <section className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200/80 shadow-xs space-y-4">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
              Zero Tolerance Violations
            </h2>
            <p className="text-sm sm:text-base text-gray-600">
              To keep V Mingle enjoyable and friendly for everyone, the following behaviors result in an immediate session termination and IP ban:
            </p>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2 text-sm sm:text-base">
              <li className="p-3.5 rounded-xl bg-gray-50 border border-gray-200/80 flex items-start gap-2.5">
                <span className="text-red-500 font-bold">✕</span>
                <span><strong>No Nudity or Sexual Acts:</strong> Any explicit, sexual, or indecent exposure is strictly banned.</span>
              </li>
              <li className="p-3.5 rounded-xl bg-gray-50 border border-gray-200/80 flex items-start gap-2.5">
                <span className="text-red-500 font-bold">✕</span>
                <span><strong>No Hate Speech:</strong> Bullying, racial slurs, harassment, or targeting based on identity will not be tolerated.</span>
              </li>
              <li className="p-3.5 rounded-xl bg-gray-50 border border-gray-200/80 flex items-start gap-2.5">
                <span className="text-red-500 font-bold">✕</span>
                <span><strong>Live Face Requirement:</strong> In video mode, your camera must show your live self, not pre-recorded video or blank walls.</span>
              </li>
              <li className="p-3.5 rounded-xl bg-gray-50 border border-gray-200/80 flex items-start gap-2.5">
                <span className="text-red-500 font-bold">✕</span>
                <span><strong>No Commercial Spam:</strong> Advertising, automated bots, selling services, or scam links are prohibited.</span>
              </li>
            </ul>
          </section>

          {/* User Safety Tips */}
          <section className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200/80 shadow-xs space-y-4">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
              Best Practices for Safe Video Chatting
            </h2>
            <div className="space-y-4 text-sm sm:text-base">
              <div className="flex gap-4 items-start">
                <span className="flex shrink-0 h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-600 font-bold">1</span>
                <div>
                  <h3 className="font-bold text-gray-900">Keep Private Information Private</h3>
                  <p className="text-gray-600">Never share your real full name, home address, social security number, passwords, banking info, or personal social media handles with strangers.</p>
                </div>
              </div>
              <div className="flex gap-4 items-start">
                <span className="flex shrink-0 h-8 w-8 items-center justify-center rounded-xl bg-orange-100 text-orange-600 font-bold">2</span>
                <div>
                  <h3 className="font-bold text-gray-900">Be Mindful of Your Background</h3>
                  <p className="text-gray-600">Check that diplomas, family photos, work badges, or identifiable street numbers are not visible on your camera frame.</p>
                </div>
              </div>
              <div className="flex gap-4 items-start">
                <span className="flex shrink-0 h-8 w-8 items-center justify-center rounded-xl bg-rose-100 text-rose-600 font-bold">3</span>
                <div>
                  <h3 className="font-bold text-gray-900">Use the Skip &amp; Report Buttons Immediately</h3>
                  <p className="text-gray-600">If anyone makes you feel uncomfortable, press the flag icon at the bottom of the video feed to submit a report, or press <kbd className="px-1.5 py-0.5 rounded bg-gray-100 border text-xs font-mono">Esc</kbd> to skip instantly.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Reporting Mechanism */}
          <section className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200/80 shadow-xs">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight mb-3">
              How Reporting Works
            </h2>
            <p>
              When you flag a user during a chat, our moderation desk receives the event and temporary connection telemetry. Repeat offenders and verified rule violations result in automated IP address blacklisting. You can also contact our safety officers directly at <Link href="/contact" className="text-rose-600 font-semibold underline">our Contact &amp; Support page</Link>.
            </p>
          </section>
        </article>
      </main>

      <MingleeFooter />
    </div>
  );
}
