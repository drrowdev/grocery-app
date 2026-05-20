import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentHousehold } from "@/lib/household";
import { HistoryView } from "@/components/history-view";

export const dynamic = "force-dynamic";

export type HistoryPurchase = {
  id: string;
  qty: number;
  unit: string;
  purchased_at: string;
  list_name: string | null;
  list_id: string | null;
  item_id: string;
  canonical_fi: string;
  canonical_sv: string;
  category_key: string | null;
  category_name_fi: string | null;
  category_name_sv: string | null;
  category_icon: string | null;
};

export type HistoryDay = {
  date: string; // YYYY-MM-DD
  purchases: HistoryPurchase[];
};

export default async function HistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const household = await getCurrentHousehold();
  if (!household) redirect("/");

  const { data: rawPurchases } = await supabase
    .from("purchases")
    .select(
      "id, qty, unit, purchased_at, list_id, list:shopping_lists(name), item:items(id, canonical_fi, canonical_sv, category:categories(key, name_fi, name_sv, icon))",
    )
    .eq("household_id", household.id)
    .order("purchased_at", { ascending: false })
    .limit(500);

  type RawPurchase = {
    id: string;
    qty: number;
    unit: string;
    purchased_at: string;
    list_id: string | null;
    list: { name: string } | null;
    item: {
      id: string;
      canonical_fi: string;
      canonical_sv: string;
      category: {
        key: string;
        name_fi: string;
        name_sv: string;
        icon: string | null;
      } | null;
    } | null;
  };

  const purchases: HistoryPurchase[] = (
    (rawPurchases ?? []) as unknown as RawPurchase[]
  )
    .filter((p) => p.item)
    .map((p) => ({
      id: p.id,
      qty: Number(p.qty),
      unit: p.unit,
      purchased_at: p.purchased_at,
      list_name: p.list?.name ?? null,
      list_id: p.list_id,
      item_id: p.item!.id,
      canonical_fi: p.item!.canonical_fi,
      canonical_sv: p.item!.canonical_sv,
      category_key: p.item!.category?.key ?? null,
      category_name_fi: p.item!.category?.name_fi ?? null,
      category_name_sv: p.item!.category?.name_sv ?? null,
      category_icon: p.item!.category?.icon ?? null,
    }));

  // Group by YYYY-MM-DD in the user's local time.
  // We just use the ISO date portion of purchased_at — fine for the user
  // who lives in a single timezone. Cross-timezone households would need
  // mailbox-style timezone normalisation.
  const groups = new Map<string, HistoryPurchase[]>();
  for (const p of purchases) {
    const date = p.purchased_at.slice(0, 10);
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date)!.push(p);
  }
  const days: HistoryDay[] = [...groups.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, list]) => ({ date, purchases: list }));

  return <HistoryView isOwner={household.role === "owner"} days={days} />;
}
