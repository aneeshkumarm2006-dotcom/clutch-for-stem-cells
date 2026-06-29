/**
 * Admin lookup lists (Stage 6) — option sets for form pickers and label
 * resolution. `cache()`-deduped per request. Admin pickers include inactive
 * taxonomy terms (so an existing assignment can still be displayed/removed).
 */
import "server-only";
import { cache } from "react";
import type { Model } from "mongoose";

import { dbConnect } from "@/lib/db";
import { id } from "@/lib/admin/serialize";
import type { UserRole } from "@/lib/enums";
import {
  Accreditation,
  CellSource,
  Clinic,
  Condition,
  Location,
  Treatment,
  User,
  type ITaxonomyBase,
} from "@/models";

export interface Option {
  value: string;
  label: string;
}

export interface TaxonomyOption extends Option {
  slug: string;
  category?: string;
  isActive: boolean;
}

async function termOptions<T extends ITaxonomyBase>(
  model: Model<T>,
): Promise<TaxonomyOption[]> {
  const docs = await model
    .find({})
    .select("name slug isActive category")
    .sort({ order: 1, name: 1 })
    .lean();
  return docs.map((d) => ({
    value: id(d._id),
    label: d.name,
    slug: d.slug,
    category: (d as { category?: string }).category,
    isActive: d.isActive,
  }));
}

/** All taxonomy option sets for the clinic & article forms. */
export const getTaxonomyOptions = cache(
  async (): Promise<{
    treatments: TaxonomyOption[];
    conditions: TaxonomyOption[];
    cellSources: TaxonomyOption[];
    accreditations: TaxonomyOption[];
    locations: TaxonomyOption[];
  }> => {
    await dbConnect();
    const [treatments, conditions, cellSources, accreditations, locations] =
      await Promise.all([
        termOptions(Treatment),
        termOptions(Condition),
        termOptions(CellSource),
        termOptions(Accreditation),
        termOptions(Location),
      ]);
    return { treatments, conditions, cellSources, accreditations, locations };
  },
);

/** Published clinics as {id,name} for featured-clinic / lead pickers. */
export const getClinicOptions = cache(async (): Promise<Option[]> => {
  await dbConnect();
  const docs = await Clinic.find({ isDeleted: false })
    .select("name")
    .sort({ name: 1 })
    .lean();
  return docs.map((d) => ({ value: id(d._id), label: d.name }));
});

export interface UserOption extends Option {
  email: string;
  role: UserRole;
}

/** Users (optionally filtered by role) for ownership/assignment pickers. */
export const getUserOptions = cache(
  async (role?: UserRole): Promise<UserOption[]> => {
    await dbConnect();
    const filter: Record<string, unknown> = { isDeleted: false };
    if (role) filter.role = role;
    const docs = await User.find(filter)
      .select("name email role")
      .sort({ name: 1, email: 1 })
      .lean();
    return docs.map((d) => ({
      value: id(d._id),
      label: d.name || d.email,
      email: d.email,
      role: d.role,
    }));
  },
);

/** Admin-panel staff (Editor/Admin/SuperAdmin) for lead assignment. */
export const getAdminStaffOptions = cache(async (): Promise<UserOption[]> => {
  await dbConnect();
  const docs = await User.find({
    isDeleted: false,
    role: { $in: ["editor", "admin", "superadmin"] },
  })
    .select("name email role")
    .sort({ name: 1, email: 1 })
    .lean();
  return docs.map((d) => ({
    value: id(d._id),
    label: d.name || d.email,
    email: d.email,
    role: d.role,
  }));
});
