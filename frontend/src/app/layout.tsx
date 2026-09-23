import type { Metadata } from "next";
import "./globals.css";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://vmingle.com";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "V Mingle – Random Video & Text Chat to Meet New People",
    template: "%s | V Mingle",
  },
  description:
    "V Mingle lets you meet and chat with new people through random video and text conversations. Connect with people around the world in a simple, friendly chat experience.",
  keywords: [
    "V Mingle",
    "VMingle",
    "V Mingle chat",
    "V Mingle video chat",
    "V Mingle random chat",
    "V Mingle online chat",
    "V Mingle meet strangers",
    "V Mingle video calling",
    "random video chat",
    "chat with strangers",
    "free video chat",
    "anonymous chat",
  ],
  authors: [{ name: "V Mingle Team", url: baseUrl }],
  creator: "V Mingle",
  publisher: "V Mingle",
  applicationName: "V Mingle",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: baseUrl,
    siteName: "V Mingle",
    title: "V Mingle – Random Video & Text Chat to Meet New People",
    description:
      "V Mingle lets you meet and chat with new people through random video and text conversations. Connect with people around the world in a simple, friendly chat experience.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "V Mingle – Random Video & Text Chat Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "V Mingle – Random Video & Text Chat to Meet New People",
    description:
      "Connect with strangers worldwide through random video and text chat on V Mingle. Free, instant, and anonymous.",
    images: ["/og-image.png"],
    creator: "@vmingle",
  },
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png" },
      { url: "/icon.png", type: "image/png" },
    ],
    shortcut: "/favicon.png",
    apple: "/apple-icon.png",
  },
};

import { Inter, JetBrains_Mono, Caveat } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
  display: "swap",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} ${caveat.variable}`} suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.png" type="image/png" />
        <link rel="shortcut icon" href="/favicon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-icon.png" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([
              {
                "@context": "https://schema.org",
                "@type": "Organization",
                name: "V Mingle",
                alternateName: ["VMingle", "V Mingle Chat", "VMingle Chat"],
                url: baseUrl,
                logo: `${baseUrl}/favicon.png`,
                description:
                  "V Mingle is an instant random video and text chat platform connecting people worldwide safely, privately, and anonymously.",
                sameAs: [
                  "https://twitter.com/vmingle",
                  "https://instagram.com/vminglechat",
                  "https://youtube.com/@vmingle",
                ],
              },
              {
                "@context": "https://schema.org",
                "@type": "WebSite",
                name: "V Mingle",
                alternateName: "VMingle",
                url: baseUrl,
                description:
                  "Meet and chat with new people through random video and text conversations on V Mingle.",
                potentialAction: {
                  "@type": "SearchAction",
                  target: `${baseUrl}/?interest={search_term_string}`,
                  "query-input": "required name=search_term_string",
                },
              },
              {
                "@context": "https://schema.org",
                "@type": "WebApplication",
                name: "V Mingle",
                applicationCategory: "CommunicationApplication",
                operatingSystem: "All",
                browserRequirements: "Requires WebRTC and JavaScript support",
                offers: {
                  "@type": "Offer",
                  price: "0",
                  priceCurrency: "USD",
                },
              },
            ]),
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
