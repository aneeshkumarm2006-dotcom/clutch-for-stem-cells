/**
 * One-off: compress THIS project's existing Cloudinary images in place.
 *
 * Scope: public_ids under `blog/` and `og/` only (this codebase's folders) —
 * every other folder on the shared account is left untouched.
 *
 * Behaviour: download each image, re-encode in the SAME format, downscale the
 * longest edge to 2000px, and drive the file under 300KB. Re-upload to the SAME
 * public_id (overwrite + invalidate) so the delivery URL and format are byte-for
 * -byte identical — only the stored bytes shrink. Images that are already small
 * enough (and not oversized), or that can't be made smaller, are skipped.
 *
 *   node scripts/compress-cloudinary.mjs          # DRY RUN (no writes)
 *   node scripts/compress-cloudinary.mjs --apply   # download backups + overwrite
 *
 * Requires network (run outside the sandbox).
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";

const APPLY = process.argv.includes("--apply");
const TARGET = 300 * 1024;
const DIMENSION_STEPS = [2000, 1600, 1280, 1024, 800, 640];
const QUALITY_STEPS = [82, 72, 62, 52, 42, 32];
const SCOPE = ["blog/", "og/"];
const BACKUP_DIR =
  "C:/Users/anees/AppData/Local/Temp/claude/c--Users-anees-Desktop-Clutch-for-Stem-Cells/f23fe858-a147-4599-8a3b-d68f48dbfd2e/scratchpad/cloudinary-originals";

// ── env ──────────────────────────────────────────────────────────────────────
const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);
const CLOUD = env.CLOUDINARY_CLOUD_NAME;
const KEY = env.CLOUDINARY_API_KEY;
const SECRET = env.CLOUDINARY_API_SECRET;
const authHeader = "Basic " + Buffer.from(`${KEY}:${SECRET}`).toString("base64");

// ── helpers ──────────────────────────────────────────────────────────────────
function kb(b) {
  return (b / 1024).toFixed(0) + "KB";
}

/** Retry a promise-returning fn a few times — survives intermittent DNS blips. */
async function withRetry(fn, tries = 4) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw last;
}

async function listScoped() {
  const out = [];
  let cursor = null;
  do {
    const j = await withRetry(async () => {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 30000);
      try {
        const r = await fetch(
          `https://api.cloudinary.com/v1_1/${CLOUD}/resources/image?max_results=500${cursor ? `&next_cursor=${encodeURIComponent(cursor)}` : ""}`,
          { headers: { Authorization: authHeader }, signal: c.signal },
        );
        return await r.json();
      } finally {
        clearTimeout(t);
      }
    });
    if (!j.resources) throw new Error("list failed: " + JSON.stringify(j).slice(0, 200));
    out.push(...j.resources);
    cursor = j.next_cursor;
  } while (cursor);
  return out.filter((r) => SCOPE.some((p) => r.public_id.startsWith(p)));
}

function extAndMime(format) {
  if (format === "webp") return [".webp", "image/webp"];
  if (format === "png") return [".png", "image/png"];
  if (format === "jpg" || format === "jpeg") return [".jpg", "image/jpeg"];
  if (format === "gif") return [".gif", "image/gif"];
  return null; // unsupported (svg/pdf/avif) → skip
}

/** Re-encode `buf` in `format`, resized+quality-laddered to fit TARGET. */
async function compressSameFormat(buf, format) {
  const meta = await sharp(buf, { animated: true }).metadata();
  const animated = (meta.pages ?? 1) > 1;
  const longest = Math.max(meta.width ?? 0, meta.height ?? 0);
  const encode = (dim, q) => {
    const p = sharp(buf, { animated });
    if (longest > dim)
      p.resize({ width: dim, height: dim, fit: "inside", withoutEnlargement: true });
    if (format === "webp") return p.webp({ quality: q, effort: 4 }).toBuffer();
    if (format === "png")
      return p.png({ quality: q, palette: true, effort: 9, compressionLevel: 9 }).toBuffer();
    if (format === "gif") return p.gif().toBuffer();
    return p.jpeg({ quality: q, mozjpeg: true }).toBuffer();
  };
  let best = null;
  outer: for (const dim of DIMENSION_STEPS) {
    if (dim > longest && dim !== DIMENSION_STEPS[0]) continue;
    for (const q of QUALITY_STEPS) {
      const out = await encode(dim, q);
      if (!best || out.byteLength < best.byteLength) best = out;
      if (out.byteLength <= TARGET) break outer;
      if (format === "gif") break; // gif has no quality knob here
    }
  }
  const outMeta = await sharp(best, { animated }).metadata();
  return { buf: best, width: outMeta.width, height: outMeta.height };
}

async function download(url) {
  return withRetry(async () => {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 45000);
    try {
      const r = await fetch(url, { signal: c.signal });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return Buffer.from(await r.arrayBuffer());
    } finally {
      clearTimeout(t);
    }
  });
}

async function overwrite(publicId, buf, mime, filename) {
  const timestamp = Math.round(Date.now() / 1000);
  const signParams = { invalidate: "true", overwrite: "true", public_id: publicId, timestamp };
  const toSign = Object.keys(signParams)
    .sort()
    .map((k) => `${k}=${signParams[k]}`)
    .join("&");
  const signature = createHash("sha1").update(toSign + SECRET).digest("hex");
  const form = new FormData();
  form.append("file", new Blob([buf], { type: mime }), filename);
  form.append("api_key", KEY);
  form.append("timestamp", String(timestamp));
  form.append("public_id", publicId);
  form.append("overwrite", "true");
  form.append("invalidate", "true");
  form.append("signature", signature);
  const j = await withRetry(async () => {
    const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, {
      method: "POST",
      body: form,
    });
    const jj = await r.json();
    if (!r.ok || jj.error) throw new Error(jj.error?.message ?? r.statusText);
    return jj;
  });
  return j; // { public_id, format, bytes, width, height, secure_url, version }
}

// ── run ──────────────────────────────────────────────────────────────────────
console.log(`Mode: ${APPLY ? "APPLY (will overwrite)" : "DRY RUN (no writes)"}\n`);
if (APPLY) fs.mkdirSync(BACKUP_DIR, { recursive: true });

const images = await listScoped();
console.log(`In scope (blog/ + og/): ${images.length} images\n`);

let changed = 0,
  skipped = 0,
  savedBytes = 0,
  failed = 0;

for (const img of images) {
  const em = extAndMime(img.format);
  const oversized = Math.max(img.width ?? 0, img.height ?? 0) > 2000;
  if (!em) {
    console.log(`SKIP  ${img.public_id} (unsupported format ${img.format})`);
    skipped++;
    continue;
  }
  if (!oversized && (img.bytes ?? 0) <= TARGET) {
    console.log(`ok    ${img.public_id} — ${kb(img.bytes)} ${img.width}x${img.height} (already fine)`);
    skipped++;
    continue;
  }
  try {
    const orig = await download(img.secure_url);
    const res = await compressSameFormat(orig, img.format);
    const delta = orig.length - res.buf.length;
    if (res.buf.length >= orig.length) {
      console.log(`ok    ${img.public_id} — ${kb(orig.length)} (can't shrink, leaving as is)`);
      skipped++;
      continue;
    }
    const flag = res.buf.length <= TARGET ? "" : " (still >300KB — smallest possible)";
    console.log(
      `${APPLY ? "WRITE" : "would"} ${img.public_id} — ${kb(orig.length)} ${img.width}x${img.height} -> ${kb(res.buf.length)} ${res.width}x${res.height}${flag}`,
    );
    savedBytes += delta;
    if (APPLY) {
      const [ext, mime] = em;
      const safe = img.public_id.replace(/[\\/]/g, "__");
      fs.writeFileSync(path.join(BACKUP_DIR, safe + ext), orig);
      const filename = img.public_id.split("/").pop() + ext;
      await overwrite(img.public_id, res.buf, mime, filename);
    }
    changed++;
  } catch (e) {
    console.log(`FAIL  ${img.public_id} — ${e.message}`);
    failed++;
  }
}

console.log(
  `\n${APPLY ? "Overwrote" : "Would change"}: ${changed} | skipped: ${skipped} | failed: ${failed} | saved ~${(savedBytes / 1048576).toFixed(1)}MB`,
);
if (!APPLY) console.log("\nDry run only. Re-run with --apply to overwrite (originals backed up locally first).");
