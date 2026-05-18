import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Household = {
  id: string;
  name: string;
  role: "owner" | "member";
};

/**
 * Returns the authenticated user's first household (by joined_at), including
 * their role. For MVP a user has exactly one household.
 */
export async function getCurrentHousehold(): Promise<Household | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("household_members")
    .select("role, households(id, name)")
    .order("joined_at", { ascending: true })
    .limit(1);
  const row = data?.[0];
  if (!row?.households) return null;
  const h = row.households as unknown as { id: string; name: string };
  return { id: h.id, name: h.name, role: row.role as "owner" | "member" };
}
