"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Table, TableCard, Td, Th, THead, Tr } from "@/components/admin/table";
import { Button } from "@/components/ui/button";
import { InitialsAvatar } from "@/components/admin/initials-avatar";
import { UserStatusBadge } from "@/components/admin/status-badge";
import { adminFetch } from "@/lib/admin/client";
import type { PendingClaim, ProviderRow } from "@/lib/admin/users";

export function ProvidersView({
  providers,
  claims,
}: {
  providers: ProviderRow[];
  claims: PendingClaim[];
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);

  const handleClaim = async (clinicId: string, action: "approve" | "decline") => {
    setBusy(clinicId);
    try {
      await adminFetch(`/api/admin/providers/claims/${clinicId}`, {
        method: "POST",
        body: { action },
      });
      toast.success(action === "approve" ? "Claim approved" : "Claim declined");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6 p-5 lg:p-7">
      <section>
        <h2 className="mb-3 font-display text-base font-semibold">
          Provider accounts
        </h2>
        <TableCard>
          <Table>
            <THead>
              <Th>Provider</Th>
              <Th>Email</Th>
              <Th>Clinic</Th>
              <Th>Status</Th>
            </THead>
            <tbody>
              {providers.length === 0 ? (
                <tr>
                  <Td colSpan={4} className="py-10 text-center text-text-muted">
                    No provider accounts yet.
                  </Td>
                </tr>
              ) : (
                providers.map((p) => (
                  <Tr key={p.id}>
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <InitialsAvatar
                          name={p.name || p.email}
                          shape="circle"
                        />
                        <span className="font-semibold">{p.name || "—"}</span>
                      </div>
                    </Td>
                    <Td className="text-text-secondary">{p.email}</Td>
                    <Td className="text-text-secondary">
                      {p.clinicId ? (
                        <Link
                          href={`/admin/clinics/${p.clinicId}`}
                          className="text-text-link hover:underline"
                        >
                          {p.clinicName}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td>
                      <UserStatusBadge status={p.status} />
                    </Td>
                  </Tr>
                ))
              )}
            </tbody>
          </Table>
        </TableCard>
      </section>

      <section>
        <h2 className="mb-3 font-display text-base font-semibold">
          Pending profile claims
        </h2>
        {claims.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-8 text-center text-sm text-text-muted">
            No pending claims.
          </div>
        ) : (
          <div className="grid gap-3">
            {claims.map((c) => (
              <div
                key={c.clinicId}
                className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:gap-3.5"
              >
                <InitialsAvatar name={c.clinicName} initials={c.initials} />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{c.clinicName}</div>
                  <div className="truncate text-[12.5px] text-text-muted">
                    Claimed by {c.ownerEmail ?? "a provider"}
                  </div>
                </div>
                <Button
                  size="sm"
                  className="bg-success hover:brightness-95"
                  disabled={busy === c.clinicId}
                  onClick={() => handleClaim(c.clinicId, "approve")}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="border-[#F3C7C6] text-[#97231F]"
                  disabled={busy === c.clinicId}
                  onClick={() => handleClaim(c.clinicId, "decline")}
                >
                  Decline
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
