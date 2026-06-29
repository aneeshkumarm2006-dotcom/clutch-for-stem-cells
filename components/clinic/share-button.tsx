"use client";

import * as React from "react";
import { Check, Share2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/** ShareButton — Web Share API with a clipboard fallback (PRD §6.3 header). */
export function ShareButton({ title }: { title?: string }) {
  const [copied, setCopied] = React.useState(false);

  async function onShare() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        /* user cancelled — fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy the link");
    }
  }

  return (
    <Button variant="secondary" onClick={onShare}>
      {copied ? (
        <Check className="size-[18px]" aria-hidden="true" />
      ) : (
        <Share2 className="size-[18px]" aria-hidden="true" />
      )}
      Share
    </Button>
  );
}
