import Link from "next/link";
import { VMingleHeader } from "@/components/VMingleHeader";
import { VMingleFooter } from "@/components/VMingleFooter";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col bg-[#fdfbf7] text-[#111827]">
      <VMingleHeader />

      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 py-16 sm:py-24">
        <span className="px-3.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-xs font-bold text-[#e11d48] uppercase tracking-wider mb-4">
          404 Error
        </span>
        <h1 className="text-4xl sm:text-6xl font-black text-gray-900 tracking-tight mb-4">
          Page Not Found
        </h1>
        <p className="text-sm sm:text-base text-gray-600 max-w-md mx-auto mb-8 leading-relaxed">
          The page you are looking for doesn&apos;t exist or has moved. Jump into a conversation or explore our guides below:
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-orange-400 via-rose-500 to-pink-500 text-white font-bold text-sm shadow-md shadow-rose-500/25 hover:brightness-105 transition-all"
          >
            Go to Homepage →
          </Link>
          <Link
            href="/video"
            className="px-6 py-3 rounded-2xl bg-white border border-gray-200 hover:border-gray-300 text-gray-800 font-bold text-sm shadow-xs transition-all"
          >
            Start Video Chat
          </Link>
          <Link
            href="/text"
            className="px-6 py-3 rounded-2xl bg-white border border-gray-200 hover:border-gray-300 text-gray-800 font-bold text-sm shadow-xs transition-all"
          >
            Start Text Chat
          </Link>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs font-semibold text-gray-500">
          <Link href="/how-it-works" className="hover:text-rose-500 transition-colors">
            How It Works
          </Link>
          <Link href="/safety" className="hover:text-rose-500 transition-colors">
            Safety
          </Link>
          <Link href="/faq" className="hover:text-rose-500 transition-colors">
            FAQ
          </Link>
          <Link href="/contact" className="hover:text-rose-500 transition-colors">
            Contact
          </Link>
        </div>
      </main>

      <VMingleFooter />
    </div>
  );
}
