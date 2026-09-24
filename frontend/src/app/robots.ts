import { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://vmingle.in";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",        // REST API endpoints
          "/queue/",      // WebSocket queue internals
          "/session/",    // Session management
          "/admin/",      // Admin panel
          "/chat/",       // Internal /chat route (app screen)
          "/_next/",      // Next.js internals
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
