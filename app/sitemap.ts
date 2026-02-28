import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

export const revalidate = 86400;

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();

  const routes = ["/", "/redirect"];
  const now = new Date();

  return routes.map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: path === "/" ? "daily" : "monthly",
    priority: path === "/" ? 0.9 : 0.3,
  }));
}
