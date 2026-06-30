"use client";

import * as React from "react";
import { Plus, Trash2, Link as LinkIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/form-field";
import { Toggle } from "@/components/admin/toggle";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KEYWORD_RELS, type KeywordRel } from "@/lib/enums";

export interface KeywordEntry {
  keyword: string;
  url: string;
  rel: KeywordRel;
}

const REL_LABELS: Record<KeywordRel, string> = {
  dofollow: "Dofollow",
  nofollow: "Nofollow",
  sponsored: "Sponsored",
};

/**
 * Manage a post's keyword backlinks (§4): keyword → target URL → rel. Occurrences
 * of each keyword in the body become links on the public page.
 */
export function KeywordManager({
  value,
  onChange,
  linkFirstOnly,
  onLinkFirstOnlyChange,
}: {
  value: KeywordEntry[];
  onChange: (next: KeywordEntry[]) => void;
  linkFirstOnly: boolean;
  onLinkFirstOnlyChange: (next: boolean) => void;
}) {
  const update = (i: number, patch: Partial<KeywordEntry>) =>
    onChange(value.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  const add = () =>
    onChange([...value, { keyword: "", url: "", rel: "dofollow" }]);

  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-lg bg-surface-alt p-3 text-[12.5px] leading-relaxed text-text-secondary">
        <LinkIcon className="mt-0.5 size-4 flex-none text-text-muted" />
        <span>
          Add the keywords you want to turn into backlinks. On the live post, each
          keyword links to its target URL.
        </span>
      </div>

      {value.length > 0 ? (
        <div className="space-y-2.5">
          {value.map((row, i) => (
            <div
              key={i}
              className="space-y-2 rounded-lg border border-border p-2.5"
            >
              <Input
                value={row.keyword}
                onChange={(e) => update(i, { keyword: e.target.value })}
                placeholder="Keyword phrase (e.g. stem cell therapy)"
                aria-label="Keyword"
              />
              <Input
                value={row.url}
                onChange={(e) => update(i, { url: e.target.value })}
                placeholder="https://target-url.com"
                aria-label="Target URL"
              />
              <div className="flex items-center gap-2">
                <Select
                  value={row.rel}
                  onValueChange={(rel) => update(i, { rel: rel as KeywordRel })}
                >
                  <SelectTrigger className="h-9 flex-1" aria-label="Link rel">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KEYWORD_RELS.map((rel) => (
                      <SelectItem key={rel} value={rel}>
                        {REL_LABELS[rel]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label="Remove keyword"
                  className="text-danger hover:bg-danger-bg"
                  onClick={() => remove(i)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[12.5px] text-text-muted">No keywords added yet.</p>
      )}

      <Button type="button" variant="secondary" size="sm" onClick={add}>
        <Plus className="size-4" />
        Add keyword
      </Button>

      <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
        <Label htmlFor="link-first-only" className="cursor-pointer">
          Link first occurrence only
          <span className="mt-0.5 block text-[11.5px] font-normal text-text-muted">
            Recommended — avoids over-optimization.
          </span>
        </Label>
        <Toggle
          id="link-first-only"
          checked={linkFirstOnly}
          onCheckedChange={onLinkFirstOnlyChange}
          label="Link first occurrence only"
        />
      </div>
    </div>
  );
}
