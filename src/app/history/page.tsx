import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentHousehold } from "@/lib/household";
import { HistoryView } from "@/components/history-view";

export const dynamic = "force-dynamic";

export type HistoryListItem = {
  qty: number;
  unit: string;
  item: { canonical_fi: string; canonical_sv: string } | null;
};

export type HistoryList = {
  id: string;
  name: string;
  completed_at: string | null;
  items: HistoryListItem[];
};

export default async function HistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const household = await getCurrentHousehold();
  if (!household) redirect("/");

  const { data: lists } = await supabase
    .from("shopping_lists")
    .select(
      "id, name, completed_at, list_items(qty, unit, item:items(canonical_fi, canonical_sv))",
    )
    .eq("household_id", household.id)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(20);

  const rows: HistoryList[] = ((lists ?? []) as unknown as {
    id: string;
    name: string;
    completed_at: string | null;
    list_items: HistoryListItem[] | null;
  }[]).map((r) => ({
    id: r.id,
    name: r.name,
    completed_at: r.completed_at,
    items: r.list_items ?? [],
  }));

  return (
    <HistoryView
      isOwner={household.role === "owner"}
      lists={rows}
    />
  );
}
