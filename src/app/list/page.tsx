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
      .order("checked")
      .order("added_at");

    if (error) throw error;
    rows = (data ?? []) as unknown as ListItemRow[];

    // Top frequent items for the quick-add chip strip.
    const onListIds = new Set(rows.map((r) => r.item.id));
    const { data: topRaw } = await supabase
      .from("consumption_profiles")
      .select(
        "item_id, sample_count, item:items(canonical_fi, canonical_sv)",
      )
      .eq("household_id", household.id)
      .order("sample_count", { ascending: false })
      .limit(20);

    type TopRow = {
      item_id: string;
      sample_count: number;
      item: { canonical_fi: string; canonical_sv: string } | null;
    };

    quickSuggestions = ((topRaw ?? []) as unknown as TopRow[])
      .filter((r) => r.item && !onListIds.has(r.item_id))
      .slice(0, 8)
      .map((r) => ({
        item_id: r.item_id,
        canonical_fi: r.item!.canonical_fi,
        canonical_sv: r.item!.canonical_sv,
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
