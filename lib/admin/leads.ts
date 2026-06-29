/**
 * Leads admin read-layer (PRD §8.4 / Stage 6.6).
 */
import "server-only";
import type { FilterQuery } from "mongoose";

import { dbConnect } from "@/lib/db";
import { id, iso } from "@/lib/admin/serialize";
import { Clinic, Condition, Lead, Treatment, User } from "@/models";
import type { ILead } from "@/models";
import type { LeadStatus, LeadType, LeadTimeframe } from "@/lib/enums";

export interface AdminLeadRow {
  id: string;
  type: LeadType;
  status: LeadStatus;
  source?: string;
  name: string;
  email: string;
  phone?: string;
  country?: string;
  clinicId?: string;
  clinicName?: string;
  matchedCount: number;
  conditionName?: string;
  treatmentNames: string[];
  budgetRange?: string;
  timeframe?: LeadTimeframe;
  message?: string;
  assignedToId?: string;
  assignedToName?: string;
  internalNotes: { note: string; byName?: string; at?: string }[];
  createdAt?: string;
}

export interface LeadsQuery {
  status?: string;
  type?: string;
  page?: number;
  pageSize?: number;
}

export interface LeadsResult {
  rows: AdminLeadRow[];
  total: number;
  counts: Record<
    "new" | "contacted" | "qualified" | "closed" | "spam" | "all",
    number
  >;
}

export async function getAdminLeads(
  query: LeadsQuery = {},
): Promise<LeadsResult> {
  await dbConnect();
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 100;

  const filter: FilterQuery<ILead> = {};
  if (query.status && query.status !== "all") {
    filter.status = query.status as LeadStatus;
  }
  if (query.type) filter.type = query.type as LeadType;

  const [docs, total, countsAgg] = await Promise.all([
    Lead.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    Lead.countDocuments(filter),
    Lead.aggregate<{ _id: LeadStatus; count: number }>([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
  ]);

  // Batch-resolve referenced names.
  const clinicIds = new Set<string>();
  const conditionIds = new Set<string>();
  const treatmentIds = new Set<string>();
  const userIds = new Set<string>();
  for (const d of docs) {
    if (d.clinicId) clinicIds.add(String(d.clinicId));
    if (d.conditionId) conditionIds.add(String(d.conditionId));
    (d.treatmentInterest ?? []).forEach((t) => treatmentIds.add(String(t)));
    if (d.assignedTo) userIds.add(String(d.assignedTo));
    (d.internalNotes ?? []).forEach(
      (n) => n.byUserId && userIds.add(String(n.byUserId)),
    );
  }

  const [clinics, conditions, treatments, users] = await Promise.all([
    Clinic.find({ _id: { $in: [...clinicIds] } }).select("name").lean(),
    Condition.find({ _id: { $in: [...conditionIds] } }).select("name").lean(),
    Treatment.find({ _id: { $in: [...treatmentIds] } }).select("name").lean(),
    User.find({ _id: { $in: [...userIds] } }).select("name email").lean(),
  ]);
  const clinicMap = new Map(clinics.map((c) => [id(c._id), c.name]));
  const conditionMap = new Map(conditions.map((c) => [id(c._id), c.name]));
  const treatmentMap = new Map(treatments.map((t) => [id(t._id), t.name]));
  const userMap = new Map(users.map((u) => [id(u._id), u.name || u.email]));

  const rows: AdminLeadRow[] = docs.map((d) => ({
    id: id(d._id),
    type: d.type,
    status: d.status,
    source: d.source,
    name: d.name,
    email: d.email,
    phone: d.phone,
    country: d.country,
    clinicId: d.clinicId ? String(d.clinicId) : undefined,
    clinicName: d.clinicId ? clinicMap.get(String(d.clinicId)) : undefined,
    matchedCount: d.matchedClinicIds?.length ?? 0,
    conditionName: d.conditionId
      ? conditionMap.get(String(d.conditionId))
      : undefined,
    treatmentNames: (d.treatmentInterest ?? [])
      .map((t) => treatmentMap.get(String(t)))
      .filter(Boolean) as string[],
    budgetRange: d.budgetRange,
    timeframe: d.timeframe,
    message: d.message,
    assignedToId: d.assignedTo ? String(d.assignedTo) : undefined,
    assignedToName: d.assignedTo ? userMap.get(String(d.assignedTo)) : undefined,
    internalNotes: (d.internalNotes ?? []).map((n) => ({
      note: n.note,
      byName: n.byUserId ? userMap.get(String(n.byUserId)) : undefined,
      at: iso(n.at),
    })),
    createdAt: iso(d.createdAt),
  }));

  const counts = {
    new: 0,
    contacted: 0,
    qualified: 0,
    closed: 0,
    spam: 0,
    all: 0,
  };
  for (const row of countsAgg) {
    if (row._id in counts) counts[row._id as keyof typeof counts] = row.count;
    counts.all += row.count;
  }

  return { rows, total, counts };
}

export async function getLeadsForExport(
  query: LeadsQuery = {},
): Promise<AdminLeadRow[]> {
  const { rows } = await getAdminLeads({ ...query, page: 1, pageSize: 5000 });
  return rows;
}
