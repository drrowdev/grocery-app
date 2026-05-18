import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentHousehold } from "@/lib/household";
import { getOrCreateActiveList } from "@/lib/list";
import { ListView } from "@/components/list-view";
import Link from "next/link";
import type { RunningLowItem } from "@/components/running-low-panel";

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
  let runningLow: RunningLowItem[] = [];

  try {
    const list = await getOrCreateActiveList(household.id);
    listId = list.id;

    const { data, error } = await supabase
      .from("list_items")
      .select(
        "id, qty, unit, checked, note, item:items(id, canonical_fi, canonical_sv, category:categories(key, name_fi, name_sv, icon, sort_order))",
      )
      .eq("list_id", list.id)
      .order("checked")
      .order("added_at");

    if (error) throw error;
    rows = (data ?? []) as unknown as ListItemRow[];

    // Quick-add chip strip: pulls from the household's items catalog
    // (everything you've ever added). Sorted by purchase count when
    // consumption_profile exists, otherwise by recency. Items already on
    // the active list are filtered out.
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

    const sorted = ((catalogRaw ?? []) as unknown as CatalogRow[])
      .filter((r) => !onListIds.has(r.id))
      .map((r) => {
        const p = Array.isArray(r.profile) ? r.profile[0] : r.profile;
        return { row: r, count: p?.sample_count ?? 0 };
      })
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.row.created_at < b.row.created_at ? 1 : -1;
      });

    quickSuggestions = sorted.slice(0, 8).map(({ row: r }) => ({
      item_id: r.id,
      canonical_fi: r.canonical_fi,
      canonical_sv: r.canonical_sv,
      unit: r.unit,
      default_qty: Number(r.default_qty),
      category: r.category,
    }));

    // Running low predictions for items not yet on the active list.
    const horizon = new Date(Date.now() + 3 * 86400000).toISOString();
    const { data: lowRaw } = await supabase
      .from("consumption_profiles")
      .select(
        "item_id, avg_cycle_days, avg_qty, last_purchased_at, item:items(canonical_fi, canonical_sv, unit, default_qty, category:categories(key, name_fi, name_sv, icon, sort_order))",
      )
      .eq("household_id", household.id)
      .eq("is_recurring", true)
      .lte("next_predicted_date", horizon)
      .order("next_predicted_date", { ascending: true })
      .limit(6);

    type LowRow = {
      item_id: string;
      avg_cycle_days: number | null;
      avg_qty: number | null;
      last_purchased_at: string | null;
      item: {
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
      } | null;
    };
    runningLow = ((lowRaw ?? []) as unknown as LowRow[])
      .filter((r) => r.item && !onListIds.has(r.item_id))
      .map((r) => ({
        item_id: r.item_id,
        canonical_fi: r.item!.canonical_fi,
        canonical_sv: r.item!.canonical_sv,
        avg_cycle_days: r.avg_cycle_days,
        avg_qty: r.avg_qty,
        unit: r.item!.unit,
        default_qty: Number(r.item!.default_qty),
        category: r.item!.category,
        last_purchased_at: r.last_purchased_at,
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
      runningLow={runningLow}
    />
  );
}
