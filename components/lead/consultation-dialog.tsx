"use client";

/**
 * ConsultationDialog — Stage 5.12 / `Consultation dialog.dc.html`.
 *
 * Opens the {@link LeadForm} in a `Dialog` from a "Request a consultation"
 * trigger (clinic profile header, directory CTA). Routes to a `Lead` and emails
 * the clinic/admin via `/api/leads`. Pass `asChild` children to use a custom
 * trigger, or rely on the default primary button.
 */
import * as React from "react";
import { MessageSquareText } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LeadForm } from "@/components/lead/lead-form";

export interface ConsultationDialogProps {
  clinicId?: string;
  clinicName?: string;
  conditions?: { id: string; name: string }[];
  source?: string;
  /** Custom trigger (rendered via `asChild`). Defaults to a primary button. */
  trigger?: React.ReactNode;
  triggerLabel?: string;
}

export function ConsultationDialog({
  clinicId,
  clinicName,
  conditions,
  source = "consultation-dialog",
  trigger,
  triggerLabel = "Request a consultation",
}: ConsultationDialogProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <MessageSquareText className="size-[18px]" aria-hidden="true" />
            {triggerLabel}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {clinicName
              ? `Request a consultation with ${clinicName}`
              : "Request a consultation"}
          </DialogTitle>
          <DialogDescription>
            Share a few details and the clinic will reach out by email. Your
            information is never shown publicly.
          </DialogDescription>
        </DialogHeader>
        <LeadForm
          type="consultation"
          clinicId={clinicId}
          clinicName={clinicName}
          conditions={conditions}
          source={source}
          onSuccess={() => {
            // Keep the dialog open to show the confirmation state.
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
