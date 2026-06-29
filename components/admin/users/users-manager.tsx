"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import {
  Table,
  TableCard,
  TableFooter,
  Td,
  Th,
  THead,
  Tr,
} from "@/components/admin/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TextField, SelectField } from "@/components/ui/form-field";
import { ListSearch } from "@/components/admin/list-search";
import { FilterSelect } from "@/components/admin/filter-select";
import { InitialsAvatar } from "@/components/admin/initials-avatar";
import { UserRoleBadge, UserStatusBadge } from "@/components/admin/status-badge";
import { RowMenu } from "@/components/admin/row-menu";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Pagination } from "@/components/ui/pagination";
import { adminFetch } from "@/lib/admin/client";
import { USER_ROLES } from "@/lib/enums";
import type { AdminUserRow } from "@/lib/admin/users";
import type { Option } from "@/lib/admin/lookups";

const ROLE_OPTS = USER_ROLES.map((r) => ({
  value: r,
  label: r.charAt(0).toUpperCase() + r.slice(1),
}));

function relTime(iso?: string): string {
  if (!iso) return "never";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function UsersManager({
  rows,
  page,
  totalPages,
  total,
  pageSize,
  clinicOptions,
}: {
  rows: AdminUserRow[];
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  clinicOptions: Option[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const { searchParams, setParams } = useQueryParamsLocal();

  const [invite, setInvite] = React.useState(false);
  const [roleFor, setRoleFor] = React.useState<AdminUserRow | null>(null);
  const [suspendFor, setSuspendFor] = React.useState<AdminUserRow | null>(null);
  const [deleteFor, setDeleteFor] = React.useState<AdminUserRow | null>(null);

  const patch = async (id: string, body: Record<string, unknown>, msg: string) => {
    try {
      await adminFetch(`/api/admin/users/${id}`, { method: "PATCH", body });
      toast.success(msg);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed.");
    }
  };

  const hrefFor = (p: number) => {
    const params = new URLSearchParams(sp.toString());
    if (p > 1) params.set("page", String(p));
    else params.delete("page");
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <>
      <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
        <ListSearch placeholder="Search users" />
        <FilterSelect
          value={searchParams.get("role") ?? undefined}
          onChange={(v) => setParams({ role: v ?? null }, { resetPage: true })}
          options={ROLE_OPTS}
          allLabel="All roles"
        />
        <FilterSelect
          value={searchParams.get("status") ?? undefined}
          onChange={(v) => setParams({ status: v ?? null }, { resetPage: true })}
          options={[
            { value: "active", label: "Active" },
            { value: "suspended", label: "Suspended" },
          ]}
          allLabel="All statuses"
        />
        <Button size="sm" className="ml-auto" onClick={() => setInvite(true)}>
          Invite user
        </Button>
      </div>

      <TableCard>
        <Table>
          <THead>
            <Th>User</Th>
            <Th>Email</Th>
            <Th>Role</Th>
            <Th>Status</Th>
            <Th>Last login</Th>
            <Th className="w-10" />
          </THead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <Td colSpan={6} className="py-12 text-center text-text-muted">
                  No users match these filters.
                </Td>
              </tr>
            ) : (
              rows.map((u) => (
                <Tr key={u.id}>
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <InitialsAvatar
                        name={u.name || u.email}
                        shape="circle"
                      />
                      <span className="font-semibold">{u.name || "—"}</span>
                    </div>
                  </Td>
                  <Td className="text-text-secondary">{u.email}</Td>
                  <Td>
                    <UserRoleBadge role={u.role} />
                  </Td>
                  <Td>
                    <UserStatusBadge status={u.status} />
                  </Td>
                  <Td className="text-text-muted">{relTime(u.lastLoginAt)}</Td>
                  <Td>
                    <RowMenu
                      label={`Actions for ${u.email}`}
                      items={[
                        { label: "Change role", onSelect: () => setRoleFor(u) },
                        u.status === "active"
                          ? {
                              label: "Suspend",
                              destructive: true,
                              onSelect: () => setSuspendFor(u),
                            }
                          : {
                              label: "Activate",
                              onSelect: () =>
                                patch(u.id, { action: "activate" }, "Activated"),
                            },
                        {
                          label: "Send password reset",
                          onSelect: () =>
                            patch(
                              u.id,
                              { action: "resetPassword" },
                              "Reset link sent",
                            ),
                        },
                        {
                          label: "Delete",
                          destructive: true,
                          onSelect: () => setDeleteFor(u),
                        },
                      ]}
                    />
                  </Td>
                </Tr>
              ))
            )}
          </tbody>
        </Table>
        <TableFooter>
          <span>
            {total === 0 ? "No results" : `Showing ${start}–${end} of ${total}`}
          </span>
          <Pagination page={page} totalPages={totalPages} hrefFor={hrefFor} />
        </TableFooter>
      </TableCard>

      <InviteDialog
        open={invite}
        onOpenChange={setInvite}
        clinicOptions={clinicOptions}
        onCreated={() => router.refresh()}
      />
      <RoleDialog
        user={roleFor}
        onOpenChange={(o) => !o && setRoleFor(null)}
        onSaved={() => router.refresh()}
      />
      <ConfirmDialog
        open={suspendFor !== null}
        onOpenChange={(o) => !o && setSuspendFor(null)}
        title="Suspend user"
        description={suspendFor ? `Suspend ${suspendFor.email}? They won't be able to sign in.` : ""}
        confirmLabel="Suspend"
        destructive
        onConfirm={() => {
          if (suspendFor) {
            void patch(suspendFor.id, { action: "suspend" }, "Suspended");
          }
        }}
      />
      <ConfirmDialog
        open={deleteFor !== null}
        onOpenChange={(o) => !o && setDeleteFor(null)}
        title="Delete user"
        description={deleteFor ? `Delete ${deleteFor.email}? This anonymizes the account.` : ""}
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!deleteFor) return;
          try {
            await adminFetch(`/api/admin/users/${deleteFor.id}`, {
              method: "DELETE",
            });
            toast.success("User deleted");
            router.refresh();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Could not delete.");
          }
        }}
      />
    </>
  );
}

// Local wrapper to avoid importing the hook file into a server boundary check.
function useQueryParamsLocal() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const setParams = (
    updates: Record<string, string | null>,
    opts: { resetPage?: boolean } = {},
  ) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === "") params.delete(k);
      else params.set(k, v);
    }
    if (opts.resetPage) params.delete("page");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };
  return { searchParams, setParams };
}

function InviteDialog({
  open,
  onOpenChange,
  clinicOptions,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clinicOptions: Option[];
  onCreated: () => void;
}) {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState("member");
  const [password, setPassword] = React.useState("");
  const [ownerClinicId, setOwnerClinicId] = React.useState<string | undefined>();
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setName("");
      setEmail("");
      setRole("member");
      setPassword("");
      setOwnerClinicId(undefined);
    }
  }, [open]);

  const create = async () => {
    setBusy(true);
    try {
      await adminFetch("/api/admin/users", {
        method: "POST",
        body: {
          name: name || undefined,
          email,
          role,
          password: password || undefined,
          ownerClinicId: role === "provider" ? ownerClinicId : undefined,
        },
      });
      toast.success("User created");
      onOpenChange(false);
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create user.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite user</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <TextField
            label="Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <SelectField
            label="Role"
            options={ROLE_OPTS}
            value={role}
            onValueChange={setRole}
          />
          {role === "provider" ? (
            <SelectField
              label="Owns clinic"
              placeholder="None"
              options={clinicOptions}
              value={ownerClinicId}
              onValueChange={setOwnerClinicId}
            />
          ) : null}
          <TextField
            label="Temporary password"
            type="password"
            hint="Optional — leave blank to send a reset link instead."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={create} disabled={busy || !email.trim()}>
            Create user
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RoleDialog({
  user,
  onOpenChange,
  onSaved,
}: {
  user: AdminUserRow | null;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const [role, setRole] = React.useState(user?.role ?? "member");
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (user) setRole(user.role);
  }, [user]);

  return (
    <Dialog open={user !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Change role</DialogTitle>
        </DialogHeader>
        <SelectField
          label={user?.email}
          options={ROLE_OPTS}
          value={role}
          onValueChange={(v) => setRole(v as typeof role)}
        />
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            disabled={busy}
            onClick={async () => {
              if (!user) return;
              setBusy(true);
              try {
                await adminFetch(`/api/admin/users/${user.id}`, {
                  method: "PATCH",
                  body: { action: "setRole", role },
                });
                toast.success("Role updated");
                onOpenChange(false);
                onSaved();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Could not update.");
              } finally {
                setBusy(false);
              }
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
