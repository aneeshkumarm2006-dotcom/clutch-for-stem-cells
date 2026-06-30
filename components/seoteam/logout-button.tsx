"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { adminFetch } from "@/lib/admin/client";

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  const logout = async () => {
    setBusy(true);
    try {
      await adminFetch("/api/seoteam/login", { method: "DELETE" });
    } catch {
      /* ignore — clear-cookie either way */
    } finally {
      router.replace("/seoteam/login");
      router.refresh();
    }
  };

  return (
    <Button variant="ghost" size="sm" onClick={logout} disabled={busy}>
      <LogOut className="size-4" />
      Sign out
    </Button>
  );
}
