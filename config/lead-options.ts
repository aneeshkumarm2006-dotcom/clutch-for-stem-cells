/**
 * The option lists the public lead forms can emit.
 *
 * Shared deliberately. `budgetRange` is a free string in `leadCreateSchema`
 * (the admin can hold anything), so the spam guard treats a value outside this
 * list as evidence the payload was hand-built rather than submitted by the
 * form. That rule is only safe while the form and the guard read the *same*
 * list — a duplicated literal here would flag every genuine wizard lead the
 * moment someone edited one copy and not the other.
 *
 * If you add a budget option, add it here and nowhere else.
 */

export const BUDGETS = [
  { value: "under-5000", label: "Under $5,000", priceMax: 5000 },
  { value: "5000-10000", label: "$5,000 – $10,000", priceMax: 10000 },
  { value: "10000-20000", label: "$10,000 – $20,000", priceMax: 20000 },
  { value: "20000-plus", label: "$20,000+", priceMax: undefined },
  { value: "flexible", label: "Flexible / not sure", priceMax: undefined },
] as const;

/** The `budgetRange` strings a submitted form can actually contain. */
export const BUDGET_LABELS: readonly string[] = BUDGETS.map((b) => b.label);

export const TIMEFRAMES = [
  { value: "asap", label: "As soon as possible" },
  { value: "1-3mo", label: "Within 1–3 months" },
  { value: "3-6mo", label: "Within 3–6 months" },
  { value: "researching", label: "Just researching" },
] as const;
