import Link from "next/link";

export function VMingleFooter() {
  return (
    <footer className="w-full border-t border-gray-150 bg-white/80 backdrop-blur-xs py-10 sm:py-12 px-4 sm:px-8 lg:px-12 text-sm text-gray-500">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
        
        {/* Left: Brand & Tagline */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-400 via-orange-500 to-rose-500 p-0.5 shadow-sm overflow-hidden">
            <div className="h-full w-full rounded-[10px] bg-white flex items-center justify-center p-1 overflow-hidden">
              <img
                src="/favicon.png"
                alt="V Mingle logo"
                className="h-full w-full object-contain select-none pointer-events-none"
              />
            </div>
          </div>

          <div className="flex flex-col">
            <span className="text-xl font-black tracking-tight text-[#111827] leading-none">
              V Mingle
            </span>
            <span className="text-[10px] font-semibold text-gray-400 tracking-wider mt-0.5">
              Random Video &amp; Text Chat
            </span>
          </div>
        </div>

        {/* Center: Navigation Links */}
        <div className="flex flex-wrap items-center justify-center gap-5 sm:gap-7 font-medium text-gray-600">
          <Link href="/" className="hover:text-gray-900 transition-colors">
            Home
          </Link>
          <Link href="/about" className="hover:text-gray-900 transition-colors">
            About
          </Link>
          <Link href="/safety" className="hover:text-gray-900 transition-colors">
            Safety
          </Link>
          <Link href="/community" className="hover:text-gray-900 transition-colors">
            Community
          </Link>
          <Link href="/faq" className="hover:text-gray-900 transition-colors">
            FAQ
          </Link>
          <Link href="/contact" className="hover:text-gray-900 transition-colors">
            Contact
          </Link>
          <Link href="/blog" className="hover:text-gray-900 transition-colors">
            Blog
          </Link>
          <Link href="/rules" className="hover:text-gray-900 transition-colors">
            Rules
          </Link>
        </div>

        {/* Right: Social Icons & Copyright */}
        <div className="flex flex-col items-center md:items-end gap-2 text-xs text-gray-400">
          <div className="flex items-center gap-4 text-gray-700">
            {/* Twitter / X */}
            <a
              href="https://twitter.com/vmingle"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#f43f5e] transition-colors"
              aria-label="Twitter"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 22.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>

            {/* Instagram */}
            <a
              href="https://instagram.com/vminglechat"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#f43f5e] transition-colors"
              aria-label="Instagram"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
              </svg>
            </a>

            {/* YouTube */}
            <a
              href="https://youtube.com/@vmingle"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#f43f5e] transition-colors"
              aria-label="YouTube"
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
            </a>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <span>© 2026 V Mingle. All rights reserved.</span>
            <span>•</span>
            <Link href="/privacy" className="hover:text-gray-700 transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-gray-700 transition-colors">
              Terms
            </Link>
            <Link href="/rules" className="hover:text-gray-700 transition-colors">
              Rules
            </Link>
          </div>
        </div>

      </div>
    </footer>
  );
}

export { VMingleFooter as MingleeFooter };
