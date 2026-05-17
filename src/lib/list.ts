import "server-only";
import { createClient } from "@/lib/supabase/server";

export type ListRow = {
  id: string;
  household_id: string;
  name: string;
  status: "active" | "completed" | "archived";
};

/**
 * Returns the household's active shopping list, creating one if none exists.
 */
export async function getOrCreateActiveList(
  householdId: string,
): Promise<ListRow> {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("shopping_lists")
    .select("id, household_id, name, status")
    .eq("household_id", householdId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return existing as ListRow;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: created, error } = await supabase
    .from("shopping_lists")
    .insert({
      household_id: householdId,
      name: "Ostoslista",
      status: "active",
      created_by: user?.id,
    })
    .select("id, household_id, name, status")
    .single();

  if (error) throw error;
  return created as ListRow;
}
