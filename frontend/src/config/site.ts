import { Metadata } from "next";

export const SITE_CONFIG = {
  name: "V Mingle",
  alternateNames: ["VMingle", "V Mingle Chat", "VMingle Chat", "V-Mingle"],
  domain: "vmingle.in",
  baseUrl: process.env.NEXT_PUBLIC_SITE_URL || "https://vmingle.in",
  tagline: "Random Video Chat & Text Chat with Strangers",
  description:
    "V Mingle (VMingle) is a free random video chat and online text chat platform connecting people worldwide. Meet strangers instantly, chat anonymously, and enjoy secure peer-to-peer conversations with zero registration.",
  keywords: [
    "V Mingle",
    "VMingle",
    "V Mingle chat",
    "V Mingle video chat",
    "V Mingle text chat",
    "V Mingle random chat",
    "V Mingle talk to strangers",
    "random video chat",
    "video chat with strangers",
    "random video chat online",
    "meet strangers through video chat",
    "random text chat",
    "text chat with strangers",
    "anonymous text chat",
    "random chat online",
    "talk to strangers online",
    "free video chat",
    "WebRTC stranger chat",
  ],
  socials: {
    twitter: "https://twitter.com/vmingle",
    twitterHandle: "@vmingle",
    instagram: "https://instagram.com/vminglechat",
    youtube: "https://youtube.com/@vmingle",
  },
  links: {
    home: "/",
    video: "/video",
    text: "/text",
    howItWorks: "/how-it-works",
    about: "/about",
    safety: "/safety",
    community: "/community",
    faq: "/faq",
    blog: "/blog",
    rules: "/rules",
    contact: "/contact",
    privacy: "/privacy",
    terms: "/terms",
  },
  ogImage: "/og-image.png",
  favicon: "/favicon.png",
  appleIcon: "/apple-icon.png",
};

interface ConstructMetadataParams {
  title?: string;
  description?: string;
  canonical?: string;
  noIndex?: boolean;
  ogImage?: string;
  type?: "website" | "article";
  keywords?: string[];
}

/**
 * Creates standardized, complete, and search-optimized Next.js metadata.
 */
export function constructMetadata({
  title,
  description = SITE_CONFIG.description,
  canonical = "/",
  noIndex = false,
  ogImage = SITE_CONFIG.ogImage,
  type = "website",
  keywords = SITE_CONFIG.keywords,
}: ConstructMetadataParams = {}): Metadata {
  const fullCanonical = canonical.startsWith("http")
    ? canonical
    : `${SITE_CONFIG.baseUrl}${canonical === "/" ? "" : canonical}`;

  const pageTitle =
    canonical === "/"
      ? { absolute: `${SITE_CONFIG.name} – ${SITE_CONFIG.tagline}` }
      : title;

  return {
    metadataBase: new URL(SITE_CONFIG.baseUrl),
    title: pageTitle,
    description,
    keywords,
    authors: [{ name: `${SITE_CONFIG.name} Team`, url: SITE_CONFIG.baseUrl }],
    creator: SITE_CONFIG.name,
    publisher: SITE_CONFIG.name,
    applicationName: SITE_CONFIG.name,
    alternates: {
      canonical: fullCanonical,
    },
    robots: noIndex
      ? {
          index: false,
          follow: false,
        }
      : {
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
      type,
      locale: "en_US",
      url: fullCanonical,
      siteName: SITE_CONFIG.name,
      title: title ? `${title} | ${SITE_CONFIG.name}` : `${SITE_CONFIG.name} – ${SITE_CONFIG.tagline}`,
      description,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${SITE_CONFIG.name} – ${SITE_CONFIG.tagline}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: title ? `${title} | ${SITE_CONFIG.name}` : `${SITE_CONFIG.name} – ${SITE_CONFIG.tagline}`,
      description,
      images: [ogImage],
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
}

/**
 * Returns Schema.org Organization structured data.
 */
export function getOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_CONFIG.name,
    alternateName: SITE_CONFIG.alternateNames,
    url: SITE_CONFIG.baseUrl,
    logo: `${SITE_CONFIG.baseUrl}${SITE_CONFIG.favicon}`,
    description: SITE_CONFIG.description,
    sameAs: [
      SITE_CONFIG.socials.twitter,
      SITE_CONFIG.socials.instagram,
      SITE_CONFIG.socials.youtube,
    ],
  };
}

/**
 * Returns Schema.org WebSite structured data with SearchAction.
 */
export function getWebSiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_CONFIG.name,
    alternateName: SITE_CONFIG.alternateNames,
    url: SITE_CONFIG.baseUrl,
    description: SITE_CONFIG.description,
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_CONFIG.baseUrl}/?interest={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

/**
 * Returns Schema.org WebApplication / SoftwareApplication structured data.
 */
export function getSoftwareApplicationSchema({
  name = "V Mingle Random Video & Text Chat",
  operatingSystem = "All",
  applicationCategory = "CommunicationApplication",
  description = SITE_CONFIG.description,
}: {
  name?: string;
  operatingSystem?: string;
  applicationCategory?: string;
  description?: string;
} = {}) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name,
    alternateName: SITE_CONFIG.alternateNames,
    operatingSystem,
    applicationCategory,
    description,
    url: SITE_CONFIG.baseUrl,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    browserRequirements: "Requires modern WebRTC and JavaScript browser support",
  };
}

/**
 * Returns Schema.org BreadcrumbList structured data.
 */
export function getBreadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url.startsWith("http") ? item.url : `${SITE_CONFIG.baseUrl}${item.url}`,
    })),
  };
}

/**
 * Returns Schema.org FAQPage structured data from question/answer pairs.
 */
export function getFaqSchema(faqs: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.a,
      },
    })),
  };
}
