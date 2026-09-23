import { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://vmingle.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/queue/",
          "/session/",
          "/admin/",
          "/chat*",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
