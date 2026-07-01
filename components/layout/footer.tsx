import * as React from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import {
  SITE_NAME,
  SITE_TAGLINE,
  MEDICAL_DISCLAIMER,
  SOCIAL_LINKS,
} from "@/config/site";

export interface FooterLink {
  label: string;
  href: string;
}
export interface FooterColumn {
  title: string;
  links: FooterLink[];
}

/** Default footer columns (Design §10.9 / Homepage mockup). */
export const DEFAULT_FOOTER_COLUMNS: FooterColumn[] = [
  {
    title: "For patients",
    links: [
      { label: "Browse clinics", href: "/clinics" },
      { label: "Find a clinic", href: "/find-a-clinic" },
      { label: "Write a review", href: "/reviews/new" },
      { label: "Blog", href: "/blog" },
    ],
  },
  {
    title: "For clinics",
    links: [
      { label: "Get listed", href: "/for-clinics" },
      { label: "Verification", href: "/methodology" },
      { label: "Pricing", href: "/for-clinics" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Methodology", href: "/methodology" },
      { label: "Contact", href: "/contact" },
      { label: "Medical disclaimer", href: "/medical-disclaimer" },
    ],
  },
];

const LEGAL_LINKS: FooterLink[] = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Editorial policy", href: "/editorial-policy" },
];

type SocialPlatform = keyof typeof SOCIAL_LINKS;

const SOCIAL_LABELS: Record<SocialPlatform, string> = {
  twitter: "X (Twitter)",
  linkedin: "LinkedIn",
  facebook: "Facebook",
  instagram: "Instagram",
};

const SOCIAL_PATHS: Record<SocialPlatform, React.ReactNode> = {
  twitter: (
    <path d="M18.9 2H22l-7.5 8.6L23 22h-6.8l-5.3-7-6.1 7H1l8-9.2L1 2h7l4.8 6.3L18.9 2Zm-2.4 18h1.9L7.6 4H5.6l10.9 16Z" />
  ),
  linkedin: (
    <path d="M4.98 3.5A2.5 2.5 0 1 0 5 8.5a2.5 2.5 0 0 0 0-5ZM3 9h4v12H3V9Zm6 0h3.8v1.7h.05c.53-1 1.83-2.05 3.77-2.05C20.3 8.65 21 11 21 14.1V21h-4v-6.1c0-1.45-.03-3.3-2-3.3-2 0-2.3 1.57-2.3 3.2V21H9V9Z" />
  ),
  facebook: (
    <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.45 2.9h-2.35v7A10 10 0 0 0 22 12Z" />
  ),
  instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17" cy="7" r="1" />
    </>
  ),
};

function SocialLink({
  platform,
  href,
}: {
  platform: SocialPlatform;
  href: string;
}) {
  const isOutline = platform === "instagram";
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={SOCIAL_LABELS[platform]}
      className="text-slate-400 transition-colors hover:text-white focus-visible:outline-none"
    >
      <svg
        viewBox="0 0 24 24"
        className="size-[18px]"
        fill={isOutline ? "none" : "currentColor"}
        stroke={isOutline ? "currentColor" : "none"}
        strokeWidth={isOutline ? 2 : undefined}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {SOCIAL_PATHS[platform]}
      </svg>
    </a>
  );
}

export interface FooterProps {
  columns?: FooterColumn[];
  className?: string;
}

/**
 * Footer — Design §10.9. Dark `ink` surface, brand lockup + tagline, link
 * columns, social icons, and the **persistent medical disclaimer** (Compliance
 * §8.1 / PRD §14) above the copyright line.
 */
export function Footer({
  columns = DEFAULT_FOOTER_COLUMNS,
  className,
}: FooterProps) {
  const year = new Date().getFullYear();
  const socials = (Object.keys(SOCIAL_LINKS) as SocialPlatform[]).filter(
    (key) => SOCIAL_LINKS[key],
  );

  return (
    <footer className={cn("bg-ink text-slate-200", className)}>
      <div className="container py-11">
        <div className="grid grid-cols-2 gap-8 border-b border-white/10 pb-7 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div className="col-span-2 md:col-span-1">
            <Logo size="md" href="/" mono="white" />
            <p className="mt-3 max-w-[32ch] text-[13.5px] leading-relaxed text-slate-400">
              {SITE_TAGLINE}.
            </p>
            {socials.length > 0 ? (
              <div className="mt-4 flex items-center gap-4">
                {socials.map((platform) => (
                  <SocialLink
                    key={platform}
                    platform={platform}
                    href={SOCIAL_LINKS[platform]}
                  />
                ))}
              </div>
            ) : null}
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h2 className="mb-3 font-display text-sm font-semibold text-white">
                {col.title}
              </h2>
              <ul className="grid gap-2.5 text-[13.5px]">
                {col.links.map((link) => (
                  <li key={`${col.title}-${link.label}-${link.href}`}>
                    <Link
                      href={link.href}
                      className="text-slate-300 transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Persistent medical disclaimer — Compliance §8.1 */}
        <p className="mt-5 text-xs leading-relaxed text-slate-500">
          {MEDICAL_DISCLAIMER}
        </p>

        <div className="mt-3.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
          <span>
            © {year} {SITE_NAME}
          </span>
          {LEGAL_LINKS.map((link) => (
            <React.Fragment key={link.href}>
              <span aria-hidden="true">·</span>
              <Link
                href={link.href}
                className="transition-colors hover:text-white"
              >
                {link.label}
              </Link>
            </React.Fragment>
          ))}
        </div>
      </div>
    </footer>
  );
}
