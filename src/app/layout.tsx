import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

/**
 * The site's own origin.
 *
 * Next needs an absolute URL to build canonical and social URLs, and it cannot
 * infer one during a static export. Set NEXT_PUBLIC_SITE_URL on the host to the
 * real domain; the fallback keeps local builds working.
 */
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ggchords.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "ggchords — Gajre Guitar Chords",
    template: "%s — ggchords",
  },
  description:
    "Gajre Guitar Chords: work out any chord progression in any key, with shapes you can actually play.",
  applicationName: "ggchords",
  keywords: [
    "guitar chords",
    "chord progressions",
    "chord chart",
    "capo chords",
    "transpose chords",
    "guitar song chords",
  ],
  // Without these, a shared link renders as a bare URL with no title or image.
  openGraph: {
    type: "website",
    siteName: "ggchords",
    title: "ggchords — Gajre Guitar Chords",
    description:
      "Every chord progression in any key, with shapes you can actually play.",
    url: siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "ggchords — Gajre Guitar Chords",
    description:
      "Every chord progression in any key, with shapes you can actually play.",
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    // metadataBase only resolves relative URLs; without this, no canonical
    // link is emitted at all.
    canonical: "/",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <header className="sticky top-0 z-40 border-b border-line/70 bg-surface/90 backdrop-blur">
          <nav className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-5">
            <Link
              href="/"
              className="text-sm font-semibold tracking-tight"
              title="Gajre Guitar Chords"
            >
              <span className="text-accent">gg</span>chords
            </Link>
            <div className="flex items-center gap-1 text-sm text-ink-muted">
              <Link
                href="/progressions"
                className="rounded-md px-2.5 py-1.5 transition-colors hover:bg-panel hover:text-ink"
              >
                Progressions
              </Link>
              <Link
                href="/songs"
                className="rounded-md px-2.5 py-1.5 transition-colors hover:bg-panel hover:text-ink"
              >
                Songs
              </Link>
            </div>
            {/* The full name lives in the header on wide screens, so the brand
                reads as ggchords without anyone having to guess what it stands
                for. */}
            <span className="ml-auto hidden text-[11px] tracking-wide text-ink-faint sm:block">
              Gajre Guitar Chords
            </span>
          </nav>
        </header>
        {children}
        <footer className="mt-16 border-t border-line/70">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-8">
            <div>
              <p className="text-sm font-semibold tracking-tight">
                <span className="text-accent">gg</span>chords
              </p>
              <p className="mt-0.5 text-xs text-ink-faint">
                Gajre Guitar Chords
                <span className="mx-1.5 text-line-strong">·</span>
                <span title="Gajre Guitar">GG</span> for short
              </p>
            </div>
            <p className="text-[11px] text-ink-faint">
              Chord shapes are computed, not copied. Progressions are free to
              publish; song lyrics here are public domain.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
