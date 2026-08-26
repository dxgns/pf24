import type { MetadataRoute } from "next";

const baseUrl = "https://pf24.lat";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/admin/",
        "/dashboard/",
        "/login/",
        "/pfpilot/",
        "/piloto/",
        "/scope/",
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
