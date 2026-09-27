import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pure static site: no Node server, no database, no API.
  // Everything the user edits lives in client state, not in a URL or a backend.
  output: "export",
  // Emit progressions/folk-blues/index.html so the export works on any
  // static host without directory-index rewrites.
  trailingSlash: true,
  // next/image default loader is server-side and unavailable in a static export.
  // We don't use remote images, so the built-in unoptimized path is correct.
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
