import type { CategoryKey } from "@/lib/categorize";

/** Brand colors per category for the colored dots in the UI. */
export const CATEGORY_DOT: Record<CategoryKey, string> = {
  produce: "bg-emerald-500",
  meat: "bg-orange-500",
  fish: "bg-sky-500",
  dairy: "bg-blue-500",
  bakery: "bg-amber-500",
  frozen: "bg-cyan-500",
  dry_goods: "bg-stone-500",
  canned: "bg-slate-500",
  spices: "bg-red-500",
  drinks: "bg-pink-500",
  snacks: "bg-violet-500",
  household: "bg-teal-500",
  hygiene: "bg-fuchsia-500",
  other: "bg-zinc-500",
};

export function categoryDot(key: string | null | undefined): string {
  if (!key) return CATEGORY_DOT.other;
  return CATEGORY_DOT[key as CategoryKey] ?? CATEGORY_DOT.other;
}
