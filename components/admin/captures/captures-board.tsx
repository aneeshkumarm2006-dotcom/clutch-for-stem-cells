"use client";

/**
 * CapturesBoard — the guide-signup queue.
 *
 * Table on the left, full context on the right, like the leads and reports
 * modules. Everything the capture endpoint recorded is reachable from here:
 * which trigger produced the address, the shortlist as it stood (resolved to
 * clinic links, with any dead slug called out rather than silently dropped),
 * the page and campaign it came from, and whether the promised email left.
 *
 * The funnel strip carries its caveat inline. `Submitted` is exact because it
 * comes from these records; impressions ride the consent-gated analytics
 * beacon, so the rate is a floor and is labelled as one.
 */
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertTriangle,
  ExternalLink,
  Mail,
  RotateCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableCard,
  TableFooter,
  Td,
  Th,
  THead,
  Tr,
} from "@/components/admin/table";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { FilterSelect } from "@/components/admin/filter-select";
import { ListSearch } from "@/components/admin/list-search";
import {
  CaptureDeliveryBadge,
  CaptureStatusBadge,
} from "@/components/admin/status-badge";
import { useQueryParams } from "@/components/admin/use-query-params";
import { adminFetch } from "@/lib/admin/client";
import {
  CAPTURE_DELIVERY_STATES,
  CAPTURE_DELIVERY_LABELS,
  CAPTURE_TRIGGERS,
  CAPTURE_TRIGGER_LABELS,
  type CaptureStatus,
} from "@/lib/enums";
import type {
  AdminCaptureRow,
  CaptureFunnel,
} from "@/lib/admin/email-captures";

function formatDate(iso?: string): string {
  return iso ? new Date(iso).toLocaleString() : "–";
}

function formatRelative(iso?: string): string {
  if (!iso) return "–";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days >= 1) return `${days}d ago`;
  const hours = Math.floor(diff / 3_600_000);
  if (hours >= 1) return `${hours}h ago`;
  const mins = Math.max(1, Math.floor(diff / 60_000));
  return `${mins}m ago`;
}

const STATUS_ACTIONS: { status: CaptureStatus; label: string }[] = [
  { status: "new", label: "Mark new" },
  { status: "archived", label: "Archive" },
  { status: "unsubscribed", label: "Unsubscribe" },
  { status: "spam", label: "Mark spam" },
];

export function CapturesBoard({
  rows,
  total,
  page,
  totalPages,
  funnel,
  failedDeliveries,
  unnotified,
}: {
  rows: AdminCaptureRow[];
  total: number;
  page: number;
  totalPages: number;
  funnel: CaptureFunnel;
  failedDeliveries: number;
  unnotified: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { searchParams, setParams } = useQueryParams();

  const [selectedId, setSelectedId] = React.useState<string | null>(
    rows[0]?.id ?? null,
  );
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const selected = rows.find((r) => r.id === selectedId) ?? rows[0] ?? null;

  // Reset the note editor whenever a different capture is selected, so an
  // unsaved draft can never be written onto the wrong record.
  React.useEffect(() => {
    setNote(selected?.internalNote ?? "");
  }, [selected?.id, selected?.internalNote]);

  const hrefFor = React.useCallback(
    (p: number) => {
      const sp = new URLSearchParams(searchParams.toString());
      if (p > 1) sp.set("page", String(p));
      else sp.delete("page");
      const qs = sp.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [pathname, searchParams],
  );

  async function run(
    fn: () => Promise<unknown>,
    okMsg: string,
  ): Promise<void> {
    setBusy(true);
    try {
      await fn();
      toast.success(okMsg);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  const setStatus = (id: string, status: CaptureStatus) =>
    run(
      () =>
        adminFetch(`/api/admin/email-captures/${id}`, {
          method: "PATCH",
          body: { status },
        }),
      "Status updated.",
    );

  const saveNote = (id: string) =>
    run(
      () =>
        adminFetch(`/api/admin/email-captures/${id}`, {
          method: "PATCH",
          body: { internalNote: note },
        }),
      "Note saved.",
    );

  const resend = (id: string) =>
    run(
      () =>
        adminFetch(`/api/admin/email-captures/${id}/resend`, {
          method: "POST",
        }),
      "Guide email sent.",
    );

  const remove = (id: string) =>
    run(async () => {
      await adminFetch(`/api/admin/email-captures/${id}`, { method: "DELETE" });
      setSelectedId(null);
    }, "Capture deleted.");

  return (
    <div className="p-5 lg:p-7">
      {/* Funnel */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FunnelStat
          label={`Modal shown (${funnel.windowDays}d)`}
          value={funnel.shown.toLocaleString()}
          hint="Consent-gated, so a floor"
        />
        <FunnelStat
          label="Dismissed"
          value={funnel.dismissed.toLocaleString()}
          hint="Closed without an address"
        />
        <FunnelStat
          label="Signups"
          value={funnel.submitted.toLocaleString()}
          hint="Exact count"
        />
        <FunnelStat
          label="Conversion"
          value={
            funnel.conversionRate === null
              ? "–"
              : `${(funnel.conversionRate * 100).toFixed(1)}%`
          }
          hint="Signups over impressions"
        />
      </div>

      {unnotified > 0 ? (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-warning-bg bg-warning-bg px-4 py-3 text-[13px] text-text-secondary">
          <AlertTriangle
            className="mt-0.5 size-4 shrink-0 text-[#8A5A00]"
            aria-hidden="true"
          />
          <span>
            {unnotified} signup{unnotified === 1 ? "" : "s"} the team was never
            emailed about. Check that LEADS_NOTIFY_EMAIL (or Settings, Contact
            email) is set, then verify SMTP under Settings.
          </span>
        </div>
      ) : null}

      {failedDeliveries > 0 ? (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-danger-bg bg-danger-bg px-4 py-3 text-[13px] text-text-secondary">
          <AlertTriangle
            className="mt-0.5 size-4 shrink-0 text-danger"
            aria-hidden="true"
          />
          <span>
            {failedDeliveries} guide{" "}
            {failedDeliveries === 1 ? "email" : "emails"} failed to send. Open
            each one and use Resend once SMTP is healthy.
          </span>
        </div>
      ) : null}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <ListSearch placeholder="Search by email" />
        <FilterSelect
          value={searchParams.get("trigger") ?? undefined}
          onChange={(v) => setParams({ trigger: v ?? null }, { resetPage: true })}
          allLabel="Any trigger"
          options={CAPTURE_TRIGGERS.map((t) => ({
            value: t,
            label: CAPTURE_TRIGGER_LABELS[t],
          }))}
        />
        <FilterSelect
          value={searchParams.get("delivery") ?? undefined}
          onChange={(v) =>
            setParams({ delivery: v ?? null }, { resetPage: true })
          }
          allLabel="Any delivery"
          options={CAPTURE_DELIVERY_STATES.map((d) => ({
            value: d,
            label: CAPTURE_DELIVERY_LABELS[d],
          }))}
        />
      </div>

      {rows.length === 0 ? (
        <TableCard>
          <div className="p-10 text-center text-sm text-text-muted">
            No signups in this view.
          </div>
        </TableCard>
      ) : (
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
          <TableCard className="min-w-0 flex-1">
            <Table>
              <THead>
                <Th>Email</Th>
                <Th>Trigger</Th>
                <Th className="text-right">Shortlist</Th>
                <Th>Delivery</Th>
                <Th>Status</Th>
                <Th>Captured</Th>
              </THead>
              <tbody>
                {rows.map((r) => (
                  <Tr
                    key={r.id}
                    interactive
                    selected={r.id === selected?.id}
                    onClick={() => setSelectedId(r.id)}
                  >
                    <Td className="max-w-[220px]">
                      <div className="truncate font-medium">{r.email}</div>
                      {r.priorCaptures > 0 ? (
                        <div className="text-[11.5px] text-text-muted">
                          {r.priorCaptures} earlier signup
                          {r.priorCaptures === 1 ? "" : "s"}
                        </div>
                      ) : null}
                    </Td>
                    <Td className="text-[12.5px] text-text-secondary">
                      {CAPTURE_TRIGGER_LABELS[r.trigger]}
                    </Td>
                    <Td className="text-right tabular-nums">
                      {r.shortlistCount}
                    </Td>
                    <Td>
                      <CaptureDeliveryBadge delivery={r.delivery} />
                    </Td>
                    <Td>
                      <CaptureStatusBadge status={r.status} />
                    </Td>
                    <Td
                      className="whitespace-nowrap text-[12.5px] text-text-muted"
                      title={formatDate(r.capturedAt)}
                    >
                      {formatRelative(r.capturedAt)}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <TableFooter>
              <span>
                {total} signup{total === 1 ? "" : "s"}
              </span>
              <Pagination
                page={page}
                totalPages={totalPages}
                hrefFor={hrefFor}
              />
            </TableFooter>
          </TableCard>

          {/* Detail */}
          {selected ? (
            <div className="w-full flex-none rounded-xl border border-border bg-surface p-5 xl:w-[400px]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Mail
                      className="size-4 shrink-0 text-text-muted"
                      aria-hidden="true"
                    />
                    <a
                      href={`mailto:${selected.email}`}
                      className="truncate font-display text-[15px] font-semibold text-text-link hover:underline"
                    >
                      {selected.email}
                    </a>
                  </div>
                  <div className="mt-0.5 text-[12px] text-text-muted">
                    {formatDate(selected.capturedAt)}
                  </div>
                </div>
                <CaptureStatusBadge status={selected.status} />
              </div>

              <dl className="mt-4 grid gap-2.5 rounded-lg bg-surface-alt p-4 text-[13px]">
                <Detail
                  label="Trigger"
                  value={CAPTURE_TRIGGER_LABELS[selected.trigger]}
                />
                <Detail
                  label="Profiles viewed"
                  value={selected.profileViewCount?.toString() ?? "Not recorded"}
                />
                <Detail
                  label="Captured on"
                  value={selected.path ?? "Not recorded"}
                />
                <Detail
                  label="Referrer"
                  value={selected.referrer ?? "Direct or internal"}
                />
                {selected.utm?.source ||
                selected.utm?.medium ||
                selected.utm?.campaign ? (
                  <Detail
                    label="Campaign"
                    value={[
                      selected.utm?.source,
                      selected.utm?.medium,
                      selected.utm?.campaign,
                    ]
                      .filter(Boolean)
                      .join(" / ")}
                  />
                ) : null}
              </dl>

              {/* Shortlist */}
              <div className="mt-4">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-azure-700">
                  Shortlist at capture ({selected.shortlistCount})
                </div>
                {selected.clinics.length === 0 &&
                selected.unresolvedSlugs.length === 0 ? (
                  <p className="mt-1.5 text-[13px] text-text-muted">
                    Nothing saved. This came from the profile-view trigger.
                  </p>
                ) : (
                  <ul className="mt-1.5 grid gap-1">
                    {selected.clinics.map((c) => (
                      <li key={c.slug}>
                        <Link
                          href={`/clinic/${c.slug}`}
                          target="_blank"
                          className="inline-flex items-center gap-1 text-[13px] text-text-link hover:underline"
                        >
                          {c.name}
                          <ExternalLink className="size-3" aria-hidden="true" />
                        </Link>
                      </li>
                    ))}
                    {selected.unresolvedSlugs.map((slug) => (
                      <li
                        key={slug}
                        className="text-[13px] text-text-muted"
                        title="No published clinic behind this slug any more"
                      >
                        {slug} (unavailable)
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Delivery */}
              <div className="mt-4 rounded-lg border border-border p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12.5px] font-semibold text-text-secondary">
                    Guide email
                  </span>
                  <CaptureDeliveryBadge delivery={selected.delivery} />
                </div>
                <div className="mt-1 text-[12px] text-text-muted">
                  {selected.sentAt
                    ? `Sent ${formatDate(selected.sentAt)}`
                    : "Not delivered yet"}
                  {selected.resendCount > 0
                    ? ` · resent ${selected.resendCount}x`
                    : ""}
                </div>
                <div className="mt-1 text-[12px] text-text-muted">
                  {selected.ownerNotifiedAt
                    ? `Team notified ${formatDate(selected.ownerNotifiedAt)}`
                    : "Team was not notified about this signup"}
                </div>
                {selected.deliveryError ? (
                  <p className="mt-1.5 break-words text-[12px] text-danger">
                    {selected.deliveryError}
                  </p>
                ) : null}
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-3 w-full"
                  disabled={busy || selected.status === "unsubscribed"}
                  onClick={() => resend(selected.id)}
                >
                  <RotateCw className="size-4" aria-hidden="true" />
                  {selected.delivery === "sent" ? "Send again" : "Resend"}
                </Button>
              </div>

              {/* Note */}
              <div className="mt-4">
                <label
                  htmlFor="capture-note"
                  className="text-[12.5px] font-semibold text-text-secondary"
                >
                  Internal note
                </label>
                <Textarea
                  id="capture-note"
                  rows={3}
                  className="mt-1.5"
                  maxLength={2000}
                  placeholder="Context for the team. Never sent to the subscriber."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-2"
                  disabled={busy || note === (selected.internalNote ?? "")}
                  onClick={() => saveNote(selected.id)}
                >
                  Save note
                </Button>
              </div>

              {/* Status */}
              <div className="mt-5 border-t border-slate-100 pt-4">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                  Move to
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {STATUS_ACTIONS.filter(
                    (a) => a.status !== selected.status,
                  ).map((a) => (
                    <Button
                      key={a.status}
                      variant="secondary"
                      size="sm"
                      disabled={busy}
                      onClick={() => setStatus(selected.id, a.status)}
                    >
                      {a.label}
                    </Button>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmDelete(true)}
                  className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-text-muted transition-colors hover:text-danger disabled:opacity-50"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  Delete permanently
                </button>
              </div>

              <ConfirmDialog
                open={confirmDelete}
                onOpenChange={setConfirmDelete}
                destructive
                title="Delete this signup?"
                description={
                  <>
                    This erases {selected.email} and everything captured with
                    it. Use this for an erasure request. To simply stop mailing
                    someone, mark them unsubscribed instead, which keeps the
                    record and blocks resends.
                  </>
                }
                confirmLabel="Delete permanently"
                onConfirm={() => remove(selected.id)}
              />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function FunnelStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="text-[12px] text-text-muted">{label}</div>
      <div className="mt-0.5 font-display text-[22px] font-bold tabular-nums text-text-primary">
        {value}
      </div>
      <div className="text-[11.5px] text-text-muted">{hint}</div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-[110px] shrink-0 text-text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-text-primary">{value}</dd>
    </div>
  );
}
