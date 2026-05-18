import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentHousehold } from "@/lib/household";
import { getOrCreateActiveList } from "@/lib/list";
import { ListView } from "@/components/list-view";
import Link from "next/link";

export const dynamic = "force-dynamic";

export type ListItemRow = {
  id: string;
  qty: number;
  unit: string;
  checked: boolean;
  note: string | null;
  item: {
    id: string;
    canonical_fi: string;
    canonical_sv: string;
    category: {
      key: string;
      name_fi: string;
      name_sv: string;
      icon: string | null;
      sort_order: number;
    } | null;
  };
};

export type QuickSuggestion = {
  item_id: string;
  canonical_fi: string;
  canonical_sv: string;
  unit: string;
  default_qty: number;
  category: {
    key: string;
    name_fi: string;
    name_sv: string;
    icon: string | null;
    sort_order: number;
  } | null;
};

export default async function ListPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const household = await getCurrentHousehold();
  if (!household) redirect("/");

  let errorDetail: string | null = null;
  let listId: string | null = null;
  let rows: ListItemRow[] = [];
  let quickSuggestions: QuickSuggestion[] = [];

  try {
    const list = await getOrCreateActiveList(household.id);
    listId = list.id;

    const { data, error } = await supabase
      .from("list_items")
      .select(
        "id, qty, unit, checked, note, item:items(id, canonical_fi, canonical_sv, category:categories(key, name_fi, name_sv, icon, sort_order))",
      )
      .eq("list_id", list.id)
      .order("added_at");

    if (error) throw error;
    rows = (data ?? []) as unknown as ListItemRow[];

    // Quick-add chip strip: most-used items from the household catalog,
    // excluding those already on the active list.
    const onListIds = new Set(rows.map((r) => r.item.id));
    const { data: catalogRaw } = await supabase
      .from("items")
      .select(
        "id, canonical_fi, canonical_sv, unit, default_qty, created_at, category:categories(key, name_fi, name_sv, icon, sort_order), profile:consumption_profiles(sample_count)",
      )
      .eq("household_id", household.id)
      .order("created_at", { ascending: false })
      .limit(60);

    type CatalogRow = {
      id: string;
      canonical_fi: string;
      canonical_sv: string;
      unit: string;
      default_qty: number;
      created_at: string;
      category: {
        key: string;
        name_fi: string;
        name_sv: string;
        icon: string | null;
        sort_order: number;
      } | null;
      profile: { sample_count: number } | { sample_count: number }[] | null;
    };

    quickSuggestions = ((catalogRaw ?? []) as unknown as CatalogRow[])
      .filter((r) => !onListIds.has(r.id))
      .map((r) => {
        const p = Array.isArray(r.profile) ? r.profile[0] : r.profile;
        return { row: r, count: p?.sample_count ?? 0 };
      })
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.row.created_at < b.row.created_at ? 1 : -1;
      })
      .slice(0, 10)
      .map(({ row: r }) => ({
        item_id: r.id,
        canonical_fi: r.canonical_fi,
        canonical_sv: r.canonical_sv,
        unit: r.unit,
        default_qty: Number(r.default_qty),
        category: r.category,
      }));
  } catch (e) {
    errorDetail =
      e instanceof Error
        ? `${e.name}: ${e.message}`
        : typeof e === "object" && e !== null
          ? JSON.stringify(e)
          : String(e);
    console.error("ListPage error:", e);
  }

  if (errorDetail || !listId) {
    return (
      <div className="flex flex-col flex-1 min-h-dvh items-center justify-center p-6 bg-gradient-to-b from-emerald-50 to-white dark:from-zinc-950 dark:to-black">
        <div className="max-w-md rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-sm dark:border-rose-900/40 dark:bg-rose-950/30">
          <h2 className="text-sm font-semibold text-rose-900 dark:text-rose-200">
            Could not load list
          </h2>
          <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-rose-800 dark:text-rose-300">
            {errorDetail ?? "Unknown error"}
          </pre>
          <Link
            href="/"
            className="mt-4 inline-block rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700"
          >
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ListView
      householdName={household.name}
      listId={listId}
      initialItems={rows}
      initialSuggestions={quickSuggestions}
    />
  );
}
