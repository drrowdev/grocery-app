import { createClient } from "@/lib/supabase/server";

export type Household = { id: string; name: string };

/**
 * Returns the authenticated user's first household (by joined_at), or null.
 * For MVP a user has exactly one household.
 */
export async function getCurrentHousehold(): Promise<Household | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("household_members")
    .select("households(id, name)")
    .order("joined_at", { ascending: true })
    .limit(1);
  const row = data?.[0]?.households as Household | undefined;
  return row ?? null;
}
