import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentHousehold } from "@/lib/household";
import { getOrCreateActiveList } from "@/lib/list";
import { ListView } from "@/components/list-view";
import type { AiSuggestion, AiStatus } from "@/components/ai-suggestion-card";
import Link from "next/link";

export const dynamic = "force-dynamic";

/**
 * Round a learned average qty to a unit-sensible step so suggestions read
 * naturally ("3 kpl", "0.5 kg", "200 g") rather than the raw decimal
 * coming out of avg(). Counts go to the nearest whole number, weights/
 * volumes round to two decimals.
 */
function roundForUnit(qty: number, unit: string): number {
  if (unit === "kpl" || unit === "pkt") {
    return Math.max(1, Math.round(qty));
  }
  if (unit === "g" || unit === "ml") {
    // Snap to 10g / 10ml increments — nobody asks for 137g of something.
    return Math.max(1, Math.round(qty / 10) * 10);
  }
  // kg / l / dl — keep one decimal place when fractional.
  const rounded = Math.round(qty * 10) / 10;
  return Math.max(0.1, rounded);
}

export type ListItemRow = {
  id: string;
  qty: number;
  unit: string;
  checked: boolean;
  checked_at: string | null;
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

export type ListSummary = {
  id: string;
  name: string;
  type: "grocery" | "general";
  itemCount: number;
  /** Items not yet checked off. Used to show an unread-style badge in
   *  the rail and the mobile picker so the user knows other lists need
   *  attention. */
  pendingCount: number;
};

export default async function ListPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id: requestedId } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const household = await getCurrentHousehold();
  if (!household) redirect("/");

  // Run independent queries in parallel
  const [allListsRes, catalogRes] = await Promise.all([
    supabase
      .from("shopping_lists")
      .select("id, name, type, status, created_at, list_items(id, checked)")
      .eq("household_id", household.id)
      .eq("status", "active")
      .order("created_at", { ascending: true }),
    supabase
      .from("items")
      .select(
        "id, canonical_fi, canonical_sv, unit, default_qty, created_at, category:categories(key, name_fi, name_sv, icon, sort_order), profile:consumption_profiles(sample_count)",
      )
      .eq("household_id", household.id)
      .order("created_at", { ascending: false })
      .limit(60),
  ]);

  const { data: allListsRaw } = allListsRes;
  const { data: catalogRaw } = catalogRes;

  type ListRow = {
    id: string;
    name: string;
    type: "grocery" | "general";
    status: string;
    created_at: string;
    list_items: { id: string; checked: boolean }[] | null;
  };
  let allLists = ((allListsRaw ?? []) as unknown as ListRow[]).map((l) => {
    const rows = l.list_items ?? [];
    const pendingCount = rows.filter((r) => !r.checked).length;
    return {
      id: l.id,
      name: l.name,
      type: l.type ?? "grocery",
      itemCount: rows.length,
      pendingCount,
    };
  }) as ListSummary[];

  // If no lists yet, lazily create one
  if (allLists.length === 0) {
    const created = await getOrCreateActiveList(household.id);
    allLists = [
      {
        id: created.id,
        name: created.name,
        type: "grocery",
        itemCount: 0,
        pendingCount: 0,
      },
    ];
  }

  const selected =
    (requestedId && allLists.find((l) => l.id === requestedId)) ||
    allLists[0];

  let errorDetail: string | null = null;
  let rows: ListItemRow[] = [];
  let quickSuggestions: QuickSuggestion[] = [];
  let aiSuggestions: AiSuggestion[] = [];
  let aiStatus: AiStatus = { tracked: 0, recurring: 0, dueNow: 0 };

  try {
    const { data, error } = await supabase
      .from("list_items")
      .select(
        "id, qty, unit, checked, checked_at, note, item:items(id, canonical_fi, canonical_sv, category:categories(key, name_fi, name_sv, icon, sort_order))",
      )
      .eq("list_id", selected.id)
      .order("added_at");

    if (error) throw error;
    rows = (data ?? []) as unknown as ListItemRow[];

    const onListIds = new Set(rows.map((r) => r.item.id));

    // Item ids that have ever appeared on a list of this same type in this
    // household. This is what makes the chip strip context-aware: a grocery
    // list never suggests medicine, a pharmacy list never suggests milk —
    // even if the item table has a category set for it.
    const { data: sameTypeRows } = await supabase
      .from("list_items")
      .select("item_id, shopping_lists!inner(type, household_id)")
      .eq("shopping_lists.household_id", household.id)
      .eq("shopping_lists.type", selected.type);
    const sameTypeIds = new Set(
      (sameTypeRows ?? []).map((r) => r.item_id as string),
    );

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
      .filter((r) => {
        if (onListIds.has(r.id)) return false;
        // Only suggest items the user has previously added to a list of
        // the same type as the one they're currently viewing.
        return sameTypeIds.has(r.id);
      })
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
    // AI proactive suggestions + status. We always show the card so the
    // user sees what the recurrence engine is doing, even before it has
    // anything to suggest.
    const horizon = new Date(Date.now() + 2 * 86400000).toISOString();
    const [profilesRes, onListsRes] = await Promise.all([
      supabase
        .from("consumption_profiles")
        .select(
          "item_id, avg_qty, avg_cycle_days, sample_count, is_recurring, last_purchased_at, next_predicted_date, item:items(canonical_fi, canonical_sv, unit, default_qty, category:categories(key))",
        )
        .eq("household_id", household.id),
      supabase
        .from("list_items")
        .select("item_id, shopping_lists!inner(household_id, status)")
        .eq("shopping_lists.household_id", household.id)
        .eq("shopping_lists.status", "active"),
    ]);

    type ProfileRow = {
      item_id: string;
      avg_qty: number | null;
      avg_cycle_days: number | null;
      sample_count: number | null;
      is_recurring: boolean | null;
      last_purchased_at: string | null;
      next_predicted_date: string | null;
      item: {
        canonical_fi: string;
        canonical_sv: string;
        unit: string;
        default_qty: number;
        category: { key: string } | null;
      } | null;
    };

    const onAnyList = new Set(
      (onListsRes.data ?? []).map((r) => r.item_id as string),
    );
    const profiles = (profilesRes.data ?? []) as unknown as ProfileRow[];

    aiSuggestions = profiles
      .filter(
        (r) =>
          r.item &&
          r.is_recurring &&
          r.next_predicted_date &&
          r.next_predicted_date <= horizon &&
          !onAnyList.has(r.item_id),
      )
      .sort((a, b) =>
        (a.next_predicted_date ?? "").localeCompare(b.next_predicted_date ?? ""),
      )
      .slice(0, 6)
      .map((r) => {
        // Use the LEARNED average qty from the recurrence engine when
        // available; fall back to the item table default (the qty the
        // user has been buying historically beats the first-add default).
        const learnedQty = r.avg_qty ? Number(r.avg_qty) : null;
        const suggestedQty =
          learnedQty && learnedQty > 0
            ? roundForUnit(learnedQty, r.item!.unit)
            : Number(r.item!.default_qty);
        return {
          item_id: r.item_id,
          canonical_fi: r.item!.canonical_fi,
          canonical_sv: r.item!.canonical_sv,
          unit: r.item!.unit,
          default_qty: suggestedQty,
          category_key: r.item!.category?.key ?? null,
          avg_cycle_days: r.avg_cycle_days,
          last_purchased_at: r.last_purchased_at,
        };
      });

    const tracked = profiles.length;
    const recurring = profiles.filter((p) => p.is_recurring).length;
    aiStatus = {
      tracked,
      recurring,
      dueNow: aiSuggestions.length,
    };
  } catch (e) {
    errorDetail =
      e instanceof Error
        ? `${e.name}: ${e.message}`
        : typeof e === "object" && e !== null
          ? JSON.stringify(e)
          : String(e);
    console.error("ListPage error:", e);
  }

  if (errorDetail) {
    return (
      <div className="flex flex-col flex-1 min-h-dvh items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-950">
        <div className="max-w-md rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-sm dark:border-rose-900/40 dark:bg-rose-950/30">
          <h2 className="text-sm font-semibold text-rose-900 dark:text-rose-200">
            Could not load list
          </h2>
          <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-rose-800 dark:text-rose-300">
            {errorDetail}
          </pre>
          <Link
            href="/"
            className="mt-4 inline-block rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700"
          >
            Back
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ListView
      key={selected.id}
      isOwner={household.role === "owner"}
      lists={allLists}
      currentListId={selected.id}
      currentListName={selected.name}
      currentListType={selected.type}
      initialItems={rows}
      initialSuggestions={quickSuggestions}
      aiSuggestions={aiSuggestions}
      aiStatus={aiStatus}
    />
  );
}
