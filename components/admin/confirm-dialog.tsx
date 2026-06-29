"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/form-field";

/**
 * Confirmation dialog for irreversible/important admin actions (soft-delete,
 * reject-with-reason, decline). Optionally captures a free-text reason that is
 * passed to `onConfirm`. Controlled via `open`/`onOpenChange`.
 */
export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** Show a reason textarea; its value is passed to `onConfirm`. */
  withReason?: boolean;
  reasonLabel?: string;
  reasonRequired?: boolean;
  reasonPlaceholder?: string;
  onConfirm: (reason?: string) => void | Promise<void>;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive,
  withReason,
  reasonLabel = "Reason",
  reasonRequired,
  reasonPlaceholder,
  onConfirm,
}: ConfirmDialogProps) {
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) setReason("");
  }, [open]);

  const handle = async () => {
    if (withReason && reasonRequired && !reason.trim()) return;
    setBusy(true);
    try {
      await onConfirm(withReason ? reason.trim() : undefined);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>

        {withReason ? (
          <div className="space-y-1.5">
            <Label htmlFor="confirm-reason" required={reasonRequired}>
              {reasonLabel}
            </Label>
            <Textarea
              id="confirm-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={reasonPlaceholder}
              rows={3}
            />
          </div>
        ) : null}

        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "destructive" : "primary"}
            onClick={handle}
            disabled={busy || (withReason && reasonRequired && !reason.trim())}
          >
            {busy ? "Working…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
