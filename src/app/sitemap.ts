import type { MetadataRoute } from "next";
import { PROGRESSIONS } from "@/lib/progressions/data";
import { SONGBOOK } from "@/lib/songs/songbook";

/**
 * Sitemap.
 *
 * Free to generate here because the site is a static export with no server, so
 * the route list is known at build time. It would need to become dynamic the
 * moment user-editable pages needed indexing, which is worth knowing before
 * anyone adds a "share your progression" feature.
 */

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ggchords.vercel.app";

// A static export refuses to prerender a metadata route unless it is explicitly
// static, because the route has no page component to infer it from.
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    {
      url: siteUrl,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${siteUrl}/progressions/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/songs/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    ...PROGRESSIONS.map((progression) => ({
      url: `${siteUrl}/progressions/${progression.id}/`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...SONGBOOK.map((song) => ({
      url: `${siteUrl}/songs/${song.id}/`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
