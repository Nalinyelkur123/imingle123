import type { Metadata } from "next";
import "./globals.css";
import { Inter, JetBrains_Mono, Caveat } from "next/font/google";
import {
  SITE_CONFIG,
  getOrganizationSchema,
  getWebSiteSchema,
  getSoftwareApplicationSchema,
} from "@/config/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_CONFIG.baseUrl),
  title: {
    default: `${SITE_CONFIG.name} – ${SITE_CONFIG.tagline}`,
    template: `%s | ${SITE_CONFIG.name}`,
  },
  description: SITE_CONFIG.description,
  keywords: SITE_CONFIG.keywords,
  authors: [{ name: `${SITE_CONFIG.name} Team`, url: SITE_CONFIG.baseUrl }],
  creator: SITE_CONFIG.name,
  publisher: SITE_CONFIG.name,
  applicationName: SITE_CONFIG.name,
  alternates: {
    canonical: SITE_CONFIG.baseUrl,
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
    url: SITE_CONFIG.baseUrl,
    siteName: SITE_CONFIG.name,
    title: `${SITE_CONFIG.name} – ${SITE_CONFIG.tagline}`,
    description: SITE_CONFIG.description,
    images: [
      {
        url: SITE_CONFIG.ogImage,
        width: 1200,
        height: 630,
        alt: `${SITE_CONFIG.name} – ${SITE_CONFIG.tagline}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_CONFIG.name} – ${SITE_CONFIG.tagline}`,
    description: SITE_CONFIG.description,
    images: [SITE_CONFIG.ogImage],
    creator: SITE_CONFIG.socials.twitterHandle,
  },
  icons: {
    icon: [
      { url: SITE_CONFIG.favicon, type: "image/png" },
      { url: "/icon.png", type: "image/png" },
    ],
    shortcut: SITE_CONFIG.favicon,
    apple: SITE_CONFIG.appleIcon,
  },
};

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
  const globalSchemas = [
    getOrganizationSchema(),
    getWebSiteSchema(),
    getSoftwareApplicationSchema(),
  ];

  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} ${caveat.variable}`} suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.png" type="image/png" />
        <link rel="shortcut icon" href="/favicon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-icon.png" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(globalSchemas),
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
