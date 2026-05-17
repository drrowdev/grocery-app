"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentHousehold } from "@/lib/household";
import { getOrCreateActiveList } from "@/lib/list";

/**
 * Copy all purchases from a completed list onto the active list (or create one).
 * Used by the "re-add" button on the history page.
 */
export async function reorderFromList(completedListId: string): Promise<{
  ok: boolean;
  added: number;
  merged: number;
}> {
  const supabase = await createClient();
  const household = await getCurrentHousehold();
  if (!household) return { ok: false, added: 0, merged: 0 };

  const { data: source } = await supabase
    .from("list_items")
    .select("item_id, qty, unit")
    .eq("list_id", completedListId);

  if (!source) return { ok: false, added: 0, merged: 0 };

  const active = await getOrCreateActiveList(household.id);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let added = 0;
  let merged = 0;
  for (const s of source) {
    const { data: existing } = await supabase
      .from("list_items")
      .select("id, qty, unit, checked")
      .eq("list_id", active.id)
      .eq("item_id", s.item_id as string)
      .maybeSingle();

    if (existing) {
      const sameUnit = existing.unit === s.unit;
      const newQty = sameUnit
        ? Number(existing.qty) + Number(s.qty)
        : Number(s.qty);
      await supabase
        .from("list_items")
        .update({
          qty: newQty,
          unit: existing.unit,
          checked: false,
          checked_at: null,
          added_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      merged += 1;
    } else {
      await supabase.from("list_items").insert({
        list_id: active.id,
        item_id: s.item_id as string,
        qty: s.qty,
        unit: s.unit,
        added_by: user?.id,
      });
      added += 1;
    }
  }

  revalidatePath("/list");
  return { ok: true, added, merged };
}
