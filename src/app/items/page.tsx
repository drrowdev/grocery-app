import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentHousehold } from "@/lib/household";
import { ItemsAdminView } from "@/components/items-admin-view";

export const dynamic = "force-dynamic";

export type AdminItem = {
  id: string;
  canonical_fi: string;
  canonical_sv: string;
  unit: string;
  default_qty: number;
  category_key: string | null;
  category_name_fi: string | null;
  category_name_sv: string | null;
  list_count: number;
  purchase_count: number;
  aliases: { alias: string; lang: "fi" | "sv" }[];
};

export type AdminCategory = {
  key: string;
  name_fi: string;
  name_sv: string;
  icon: string | null;
  sort_order: number;
};

export default async function ItemsAdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const household = await getCurrentHousehold();
  if (!household) redirect("/");
  if (household.role !== "owner") redirect("/list");

  const [itemsRes, categoriesRes, listItemsRes, purchasesRes, aliasesRes] =
    await Promise.all([
      supabase
        .from("items")
        .select(
          "id, canonical_fi, canonical_sv, unit, default_qty, category:categories(key, name_fi, name_sv)",
        )
        .eq("household_id", household.id)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("categories")
        .select("key, name_fi, name_sv, icon, sort_order")
        .order("sort_order"),
      supabase
        .from("list_items")
        .select("item_id, shopping_lists!inner(household_id)")
        .eq("shopping_lists.household_id", household.id),
      supabase
        .from("purchases")
        .select("item_id")
        .eq("household_id", household.id),
      supabase
        .from("item_aliases")
        .select("item_id, alias, lang"),
    ]);

  type ItemRow = {
    id: string;
    canonical_fi: string;
    canonical_sv: string;
    unit: string;
    default_qty: number;
    category: {
      key: string;
      name_fi: string;
      name_sv: string;
    } | null;
  };

  const listCounts = new Map<string, number>();
  for (const r of listItemsRes.data ?? []) {
    const id = r.item_id as string;
    listCounts.set(id, (listCounts.get(id) ?? 0) + 1);
  }
  const purchaseCounts = new Map<string, number>();
  for (const r of purchasesRes.data ?? []) {
    const id = r.item_id as string;
    purchaseCounts.set(id, (purchaseCounts.get(id) ?? 0) + 1);
  }
  const aliasesByItem = new Map<string, { alias: string; lang: "fi" | "sv" }[]>();
  for (const a of aliasesRes.data ?? []) {
    const id = a.item_id as string;
    if (!aliasesByItem.has(id)) aliasesByItem.set(id, []);
    aliasesByItem.get(id)!.push({
      alias: a.alias as string,
      lang: a.lang as "fi" | "sv",
    });
  }

  const items: AdminItem[] = ((itemsRes.data ?? []) as unknown as ItemRow[]).map(
    (i) => ({
      id: i.id,
      canonical_fi: i.canonical_fi,
      canonical_sv: i.canonical_sv,
      unit: i.unit,
      default_qty: Number(i.default_qty),
      category_key: i.category?.key ?? null,
      category_name_fi: i.category?.name_fi ?? null,
      category_name_sv: i.category?.name_sv ?? null,
      list_count: listCounts.get(i.id) ?? 0,
      purchase_count: purchaseCounts.get(i.id) ?? 0,
      aliases: aliasesByItem.get(i.id) ?? [],
    }),
  );

  const categories: AdminCategory[] = (categoriesRes.data ?? []).map((c) => ({
    key: c.key as string,
    name_fi: c.name_fi as string,
    name_sv: c.name_sv as string,
    icon: (c.icon as string | null) ?? null,
    sort_order: c.sort_order as number,
  }));

  return <ItemsAdminView items={items} categories={categories} />;
}
