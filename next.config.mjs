import { IMAGE_REMOTE_PATTERNS } from "./config/images.mjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Media providers (Cloudinary / UploadThing / S3) wired in Stage 3.6.
    // The host list lives in `config/images.mjs` because the app reads it too —
    // see the note there on why an unlisted host becomes a *broken internal*
    // image rather than a broken external one.
    remotePatterns: IMAGE_REMOTE_PATTERNS,
  },
  // Mongoose ships server-only code; keep it external to the server bundle.
  experimental: {
    serverComponentsExternalPackages: ["mongoose", "sharp"],
  },
};

export default nextConfig;
