"use client";

/**
 * LeadForm — the consultation/quote/contact form (PRD §6.3, §6.8, §6.9, §7).
 *
 * Reused by the consultation `Dialog` (5.12), the clinic profile contact section,
 * and the contact page. POSTs to `/api/leads`, then swaps to a confirmation
 * state. Carries the consent + 18+ gate required on every lead form (PRD §14,
 * §8.6) and the persistent medical-disclaimer tone.
 */
import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { TextField, TextareaField, SelectField } from "@/components/ui/form-field";
import type { LeadType } from "@/lib/enums";

const leadFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(160),
  email: z.string().email("Enter a valid email address"),
  phone: z.string().max(40).optional(),
  country: z.string().max(120).optional(),
  conditionId: z.string().optional(),
  message: z.string().max(5000).optional(),
  agree: z.literal(true, {
    errorMap: () => ({ message: "Please confirm to continue" }),
  }),
});

type LeadFormValues = z.infer<typeof leadFormSchema>;

export interface LeadFormProps {
  type?: LeadType;
  clinicId?: string;
  clinicName?: string;
  source?: string;
  /** Optional condition picker (omit to hide). */
  conditions?: { id: string; name: string }[];
  submitLabel?: string;
  /** Prefill the message field (e.g. contact-page topic). */
  defaultMessage?: string;
  onSuccess?: () => void;
}

export function LeadForm({
  type = "consultation",
  clinicId,
  clinicName,
  source = "lead-form",
  conditions,
  submitLabel = "Request a consultation",
  defaultMessage,
  onSuccess,
}: LeadFormProps) {
  const [sent, setSent] = React.useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: { name: "", email: "", message: defaultMessage ?? "" },
  });

  async function onSubmit(values: LeadFormValues) {
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        clinicId,
        source,
        name: values.name,
        email: values.email,
        phone: values.phone || undefined,
        country: values.country || undefined,
        conditionId: values.conditionId || undefined,
        message: values.message || undefined,
        consentGiven: true,
        ageConfirmed: true,
      }),
    });

    if (res.ok) {
      setSent(true);
      onSuccess?.();
      return;
    }
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    toast.error(data?.error ?? "Something went wrong. Please try again.");
  }

  if (sent) {
    return (
      <div className="rounded-xl border border-success-bg bg-success-bg/40 p-5 text-center">
        <span className="mb-3 inline-flex size-11 items-center justify-center rounded-full bg-success-bg text-success">
          <CheckCircle2 className="size-5" aria-hidden="true" />
        </span>
        <h3 className="font-display text-base font-semibold text-text-primary">
          Request sent
        </h3>
        <p className="mt-1 text-sm text-text-secondary">
          {clinicName ? `${clinicName} and ` : "The "}our team will be in touch
          by email. We never share your details publicly.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Full name"
          required
          autoComplete="name"
          placeholder="Your name"
          error={errors.name?.message}
          {...register("name")}
        />
        <TextField
          label="Email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@email.com"
          error={errors.email?.message}
          {...register("email")}
        />
        <TextField
          label="Phone"
          type="tel"
          autoComplete="tel"
          placeholder="Optional"
          error={errors.phone?.message}
          {...register("phone")}
        />
        <TextField
          label="Country"
          autoComplete="country-name"
          placeholder="Where you're based"
          error={errors.country?.message}
          {...register("country")}
        />
      </div>

      {conditions?.length ? (
        <SelectField
          label="Condition"
          placeholder="Select a condition (optional)"
          options={conditions.map((c) => ({ value: c.id, label: c.name }))}
          onValueChange={(v) => setValue("conditionId", v)}
        />
      ) : null}

      <TextareaField
        label="Message"
        rows={4}
        placeholder="Tell the clinic about your condition, goals, and any questions."
        error={errors.message?.message}
        {...register("message")}
      />

      <label className="flex items-start gap-2.5 text-[12.5px] text-text-secondary">
        <input
          type="checkbox"
          className="mt-0.5 size-4 shrink-0 rounded border-border-strong accent-primary focus-visible:outline-none"
          {...register("agree")}
        />
        <span>
          I&apos;m 18 or older and agree to the{" "}
          <Link href="/terms" className="font-medium text-text-link hover:underline">
            terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="font-medium text-text-link hover:underline">
            privacy policy
          </Link>
          . I understand {clinicName ? `${clinicName} is` : "clinics are"} not
          endorsed and this is not medical advice.
        </span>
      </label>
      {errors.agree ? (
        <p className="-mt-2 text-[12.5px] text-danger">{errors.agree.message}</p>
      ) : null}

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Sending…" : submitLabel}
      </Button>
    </form>
  );
}
