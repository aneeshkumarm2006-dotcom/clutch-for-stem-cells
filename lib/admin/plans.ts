/**
 * Plans (listing tiers) read-layer (PRD §8.9 / Stage 6.11).
 */
import "server-only";

import { dbConnect } from "@/lib/db";
import { id } from "@/lib/admin/serialize";
import { Plan } from "@/models";
import type { PlanKey } from "@/lib/enums";

export interface AdminPlanRow {
  id: string;
  key: PlanKey;
  name: string;
  description?: string;
  priceMonthly?: number;
  priceYearly?: number;
  currency: string;
  features: string[];
  badge?: string;
  highlighted: boolean;
  isActive: boolean;
  ctaLabel?: string;
  order: number;
}

export async function getAdminPlans(): Promise<AdminPlanRow[]> {
  await dbConnect();
  const docs = await Plan.find({}).sort({ order: 1 }).lean();
  return docs.map((p) => ({
    id: id(p._id),
    key: p.key,
    name: p.name,
    description: p.description ?? "",
    priceMonthly: p.priceMonthly,
    priceYearly: p.priceYearly,
    currency: p.currency,
    features: p.features ?? [],
    badge: p.badge ?? "",
    highlighted: p.highlighted,
    isActive: p.isActive,
    ctaLabel: p.ctaLabel ?? "",
    order: p.order ?? 0,
  }));
}
