import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentHousehold } from "@/lib/household";
import { ItemsView } from "@/components/items-view";

type ItemRow = {
  id: string;
  canonical_fi: string;
  canonical_sv: string;
  unit: string;
  default_qty: number;
  category: { key: string; name_fi: string; name_sv: string; icon: string | null } | null;
};

export default async function ItemsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const household = await getCurrentHousehold();
  if (!household) redirect("/");

  const { data: items } = await supabase
    .from("items")
    .select(
      "id, canonical_fi, canonical_sv, unit, default_qty, category:categories(key, name_fi, name_sv, icon)",
    )
    .eq("household_id", household.id)
    .order("canonical_fi");

  return (
    <ItemsView
      householdName={household.name}
      items={(items ?? []) as unknown as ItemRow[]}
    />
  );
}
