import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentHousehold } from "@/lib/household";
import { getOrCreateActiveList } from "@/lib/list";
import { ListView } from "@/components/list-view";

export const dynamic = "force-dynamic";

export type ListItemRow = {
  id: string;
  qty: number;
  unit: string;
  checked: boolean;
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

export default async function ListPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const household = await getCurrentHousehold();
  if (!household) redirect("/");

  const list = await getOrCreateActiveList(household.id);

  const { data: rows } = await supabase
    .from("list_items")
    .select(
      "id, qty, unit, checked, item:items(id, canonical_fi, canonical_sv, category:categories(key, name_fi, name_sv, icon, sort_order))",
    )
    .eq("list_id", list.id)
    .order("checked")
    .order("added_at");

  return (
    <ListView
      householdName={household.name}
      listId={list.id}
      initialItems={(rows ?? []) as unknown as ListItemRow[]}
    />
  );
}
