/**
 * Users & providers read-layer (PRD §8.8 / Stage 6.10).
 *
 * Provider self-serve is Phase 2; in MVP a "pending claim" is a clinic an admin
 * assigned an owner to (`ownerUserId` set) that isn't yet confirmed
 * (`isClaimed: false`). // PRD-ASSUMPTION
 */
import "server-only";
import type { FilterQuery } from "mongoose";

import { dbConnect } from "@/lib/db";
import {
  id,
  initials,
  iso,
  paginate,
  type Paginated,
} from "@/lib/admin/serialize";
import { Clinic, User } from "@/models";
import type { IUser } from "@/models";
import type { UserRole, UserStatus } from "@/lib/enums";

export interface AdminUserRow {
  id: string;
  name?: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  provider: string;
  emailVerified: boolean;
  lastLoginAt?: string;
  createdAt?: string;
}

export interface UsersQuery {
  q?: string;
  role?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function getAdminUsers(
  query: UsersQuery = {},
): Promise<Paginated<AdminUserRow>> {
  await dbConnect();
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;

  const filter: FilterQuery<IUser> = { isDeleted: false };
  if (query.role) filter.role = query.role as UserRole;
  if (query.status) filter.status = query.status as UserStatus;
  if (query.q) {
    const rx = new RegExp(escapeRegex(query.q), "i");
    filter.$or = [{ name: rx }, { email: rx }];
  }

  const [docs, total] = await Promise.all([
    User.find(filter)
      .select("name email role status provider emailVerified lastLoginAt createdAt")
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    User.countDocuments(filter),
  ]);

  const rows: AdminUserRow[] = docs.map((u) => ({
    id: id(u._id),
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    provider: u.provider,
    emailVerified: u.emailVerified != null,
    lastLoginAt: iso(u.lastLoginAt),
    createdAt: iso(u.createdAt),
  }));

  return paginate(rows, total, page, pageSize);
}

export interface ProviderRow {
  id: string;
  name?: string;
  email: string;
  status: UserStatus;
  clinicId?: string;
  clinicName?: string;
}

export async function getAdminProviders(): Promise<ProviderRow[]> {
  await dbConnect();
  const providers = await User.find({ role: "provider", isDeleted: false })
    .select("name email status")
    .sort({ name: 1, email: 1 })
    .lean();

  const owned = await Clinic.find({
    ownerUserId: { $in: providers.map((p) => p._id) },
    isDeleted: false,
  })
    .select("name ownerUserId")
    .lean();
  const byOwner = new Map(owned.map((c) => [String(c.ownerUserId), c]));

  return providers.map((p) => {
    const clinic = byOwner.get(id(p._id));
    return {
      id: id(p._id),
      name: p.name,
      email: p.email,
      status: p.status,
      clinicId: clinic ? id(clinic._id) : undefined,
      clinicName: clinic?.name,
    };
  });
}

export interface PendingClaim {
  clinicId: string;
  clinicName: string;
  initials: string;
  ownerEmail?: string;
  assignedAt?: string;
}

export async function getPendingClaims(): Promise<PendingClaim[]> {
  await dbConnect();
  const clinics = await Clinic.find({
    ownerUserId: { $ne: null },
    isClaimed: false,
    isDeleted: false,
  })
    .select("name ownerUserId updatedAt")
    .sort({ updatedAt: -1 })
    .lean();

  const owners = await User.find({
    _id: { $in: clinics.map((c) => c.ownerUserId).filter(Boolean) },
  })
    .select("email")
    .lean();
  const emailMap = new Map(owners.map((o) => [id(o._id), o.email]));

  return clinics.map((c) => ({
    clinicId: id(c._id),
    clinicName: c.name,
    initials: initials(c.name),
    ownerEmail: c.ownerUserId ? emailMap.get(String(c.ownerUserId)) : undefined,
    assignedAt: iso(c.updatedAt),
  }));
}
