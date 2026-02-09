import type { MetadataRoute } from "next";
import { source } from "@/lib/source";

const BASE_URL = "https://shareful.ai";

export default function sitemap(): MetadataRoute.Sitemap {
  return source.getPages().map((page) => ({
    url: `${BASE_URL}${page.url}`,
    lastModified: new Date(),
    priority: page.url === "/docs" ? 1 : 0.7,
  }));
}
