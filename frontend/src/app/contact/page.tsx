import { Metadata } from "next";
import Link from "next/link";
import { MingleeHeader } from "@/components/MingleeHeader";
import { MingleeFooter } from "@/components/MingleeFooter";

export const metadata: Metadata = {
  title: "Contact & Support Desk",
  description:
    "Contact V Mingle for technical support, safety issues, DMCA requests, law enforcement inquiries, or general feedback.",
  alternates: {
    canonical: "/contact",
  },
  openGraph: {
    title: "Contact & Support — V Mingle Help Desk",
    description:
      "Get in touch with the V Mingle team for support, reporting, or inquiries.",
    url: "/contact",
  },
};

export default function ContactPage() {
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
            <li className="text-gray-900">Contact Us</li>
          </ol>
        </nav>

        <header className="mb-10">
          <span className="inline-block px-3.5 py-1 rounded-full bg-orange-50 border border-orange-200 text-xs font-bold text-orange-600 uppercase tracking-wider mb-3">
            Support Desk
          </span>
          <h1 className="text-4xl sm:text-5xl font-black text-gray-900 tracking-tight leading-tight">
            Contact V Mingle
          </h1>
          <p className="mt-4 text-lg text-gray-600 leading-relaxed font-medium">
            We are here to assist with safety escalations, bug reports, and general questions regarding the V Mingle random chat platform.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          {/* Card 1: Safety & Trust Escalations */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200/80 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-600 mb-4 text-xl">
                🛡️
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Safety &amp; Abuse Reports</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                To report urgent community violations, harassment, or illegal content encountered during a session, please reach our dedicated safety response desk:
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-gray-100">
              <span className="text-xs font-semibold text-gray-400 block uppercase">Email</span>
              <a
                href="mailto:safety@vmingle.in"
                className="text-base font-bold text-red-600 hover:underline"
              >
                safety@vmingle.in
              </a>
            </div>
          </div>

          {/* Card 2: General Support */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200/80 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 mb-4 text-xl">
                💬
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">General Support &amp; Feedback</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                For questions regarding technical issues, browser camera permissions, partnership inquiries, or feature suggestions:
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-gray-100">
              <span className="text-xs font-semibold text-gray-400 block uppercase">Email</span>
              <a
                href="mailto:support@vmingle.in"
                className="text-base font-bold text-amber-600 hover:underline"
              >
                support@vmingle.in
              </a>
            </div>
          </div>

          {/* Card 3: Legal & DMCA */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200/80 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 text-orange-600 mb-4 text-xl">
                ⚖️
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Legal &amp; Privacy</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                For legal inquiries, copyright notices, and privacy requests pursuant to GDPR or CCPA:
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-gray-100">
              <span className="text-xs font-semibold text-gray-400 block uppercase">Email</span>
              <a
                href="mailto:legal@vmingle.in"
                className="text-base font-bold text-orange-600 hover:underline"
              >
                legal@vmingle.in
              </a>
            </div>
          </div>

          {/* Card 4: Community Resources */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200/80 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 mb-4 text-xl">
                📖
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Quick Community Links</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                Check our official guidelines and policies for immediate answers:
              </p>
            </div>
            <ul className="mt-6 pt-4 border-t border-gray-100 space-y-1.5 text-sm font-semibold text-gray-700">
              <li>
                <Link href="/safety" className="text-rose-600 hover:underline">
                  → Safety Guidelines
                </Link>
              </li>
              <li>
                <Link href="/community" className="text-rose-600 hover:underline">
                  → Community Standards
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-rose-600 hover:underline">
                  → Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </main>

      <MingleeFooter />
    </div>
  );
}
