import Image from "next/image";

import { cn } from "@/lib/utils";

/** Up-to-2-letter initials (client-safe; mirrors the server `initials`). */
function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/**
 * Logo/avatar cell for tables (Design §11): a `tint` square (clinics) or circle
 * (users) with `azure-700` initials, or the image when one exists. `initials`
 * defaults to deriving from `name`.
 */
export function InitialsAvatar({
  name,
  initials,
  src,
  shape = "square",
  className,
}: {
  name: string;
  initials?: string;
  src?: string;
  shape?: "square" | "circle";
  className?: string;
}) {
  const text = initials ?? deriveInitials(name);
  const base = cn(
    "flex size-[30px] flex-none items-center justify-center overflow-hidden bg-tint font-display text-[11px] font-bold text-azure-700",
    shape === "circle" ? "rounded-full" : "rounded-lg",
    className,
  );
  if (src) {
    return (
      <span className={cn(base, "bg-surface")}>
        <Image
          src={src}
          alt=""
          width={30}
          height={30}
          className="size-full object-cover"
          unoptimized
        />
      </span>
    );
  }
  return (
    <span className={base} aria-hidden="true" title={name}>
      {text}
    </span>
  );
}
