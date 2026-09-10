import { IMAGE_REMOTE_PATTERNS } from "./config/images.mjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /**
   * Stamps every `/_next/static` request with the deployment that built it
   * (`?dpl=…`). With Vercel Skew Protection enabled on the project, that param
   * routes the request to *that* deployment, so a tab holding pre-deploy HTML
   * still gets chunk files that exist instead of a 404 → `ChunkLoadError` →
   * crashed page. Without Skew Protection it is a harmless cache-buster and the
   * client-side handler in `lib/chunk-error.ts` does the recovery instead.
   *
   * Vercel sets `NEXT_DEPLOYMENT_ID` itself when Skew Protection is on;
   * `VERCEL_DEPLOYMENT_ID` is the fallback so the stamp is still correct on a
   * project where the toggle has not been flipped yet. Undefined locally, which
   * leaves the param off in dev.
   */
  deploymentId:
    process.env.NEXT_DEPLOYMENT_ID || process.env.VERCEL_DEPLOYMENT_ID,
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
