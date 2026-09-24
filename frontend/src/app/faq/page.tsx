import { Metadata } from "next";
import Link from "next/link";
import { MingleeHeader } from "@/components/MingleeHeader";
import { MingleeFooter } from "@/components/MingleeFooter";

export const metadata: Metadata = {
  title: "Frequently Asked Questions (FAQ)",
  description:
    "Get answers to common questions about V Mingle: pricing, account requirements, WebRTC video calling privacy, smart interest matching, and safety moderation.",
  alternates: {
    canonical: "/faq",
  },
  openGraph: {
    title: "Frequently Asked Questions (FAQ) — V Mingle",
    description:
      "Get answers to common questions about V Mingle random video and text chat.",
    url: "/faq",
  },
};

const FAQS = [
  {
    q: "What is V Mingle?",
    a: "V Mingle (also known as VMingle) is a free, web-based random chat platform that pairs you with strangers for spontaneous, 1-on-1 video and text conversations. No app download or registration is needed.",
  },
  {
    q: "Is V Mingle completely free to use?",
    a: "Yes, V Mingle is 100% free. You can start video chatting or text chatting with strangers worldwide without subscriptions, credit cards, or hidden fees.",
  },
  {
    q: "Do I need an account or email to start chatting?",
    a: "No. V Mingle does not require an account, email address, or phone number. We believe in spontaneous, anonymous connections that protect your personal privacy.",
  },
  {
    q: "How does the random matching algorithm work?",
    a: "Our smart matchmaking engine connects you instantly with another active online user. If you enter interest tags (like #coding, #music, or #sports), our algorithm prioritizes matching you with users who share those exact topics.",
  },
  {
    q: "Are video calls recorded or stored by V Mingle?",
    a: "Never. All video and audio streams are transmitted peer-to-peer using WebRTC technology. Video data flows directly between user browsers and is never recorded, intercepted, or saved to our servers.",
  },
  {
    q: "Who is allowed to use V Mingle?",
    a: "V Mingle is strictly restricted to adults aged 18 years and older. We enforce an uncompromising zero-tolerance policy against underage participation, nudity, harassment, and hate speech.",
  },
  {
    q: "What happens if someone violates the community rules?",
    a: "Users can click the flag/report button on any chat session to report a violation. Reported users are immediately skipped and investigated by our moderation desk, with verified violators permanently banned.",
  },
  {
    q: "Does V Mingle work on mobile devices and tablets?",
    a: "Yes. V Mingle is fully responsive and optimized for mobile browsers on iOS (Safari) and Android (Chrome), featuring Picture-in-Picture (PiP) and split-screen video preview modes.",
  },
];

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://vmingle.in";

export default function FaqPage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${SITE_URL}/faq#faqpage`,
    url: `${SITE_URL}/faq`,
    name: "V Mingle FAQ — Frequently Asked Questions",
    mainEntity: FAQS.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.a,
      },
    })),
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: SITE_URL,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "FAQ",
        item: `${SITE_URL}/faq`,
      },
    ],
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#fdfbf7] text-[#111827]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
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
            <li className="text-gray-900">FAQ</li>
          </ol>
        </nav>

        <header className="mb-10 text-center sm:text-left">
          <span className="inline-block px-3.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-xs font-bold text-[#e11d48] uppercase tracking-wider mb-3">
            Help &amp; Answers
          </span>
          <h1 className="text-4xl sm:text-5xl font-black text-gray-900 tracking-tight leading-tight">
            Frequently Asked Questions
          </h1>
          <p className="mt-4 text-lg text-gray-600 leading-relaxed font-medium">
            Everything you need to know about V Mingle video chat, anonymous text chat, matching, and privacy.
          </p>
        </header>

        <article className="space-y-4">
          {FAQS.map((item, index) => (
            <section
              key={index}
              className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-xs hover:border-gray-300 transition-colors"
            >
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">
                {item.q}
              </h2>
              <p className="text-gray-600 leading-relaxed text-sm sm:text-base">
                {item.a}
              </p>
            </section>
          ))}
        </article>

        {/* Support Callout */}
        <div className="mt-12 p-8 rounded-3xl bg-white border border-gray-200/80 text-center shadow-xs">
          <h2 className="text-xl font-bold text-gray-900">Have More Questions?</h2>
          <p className="mt-2 text-gray-600 text-sm sm:text-base max-w-md mx-auto">
            Our team is always here to assist. Visit our contact desk to reach our support and safety specialists.
          </p>
          <div className="mt-5">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-orange-400 via-rose-500 to-pink-500 text-white font-bold text-sm shadow-md hover:brightness-105 active:scale-95 transition-all"
            >
              Contact Support
            </Link>
          </div>
        </div>
      </main>

      <MingleeFooter />
    </div>
  );
}
