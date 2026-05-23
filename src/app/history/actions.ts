"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentHousehold } from "@/lib/household";
import { getOrCreateActiveList } from "@/lib/list";

const VALID_UNITS = new Set(["kpl", "kg", "g", "l", "dl", "ml", "pkt"]);

/**
 * Re-add a single purchase back to the active grocery list. Useful when a
 * user wants to buy the same thing again from the history view.
 */
export async function reorderFromPurchase(purchaseId: string): Promise<{
  ok: boolean;
  message?: string;
}> {
  const supabase = await createClient();
  const household = await getCurrentHousehold();
  if (!household) return { ok: false, message: "no_household" };

  const { data: purchase } = await supabase
    .from("purchases")
    .select("id, item_id, qty, unit, household_id")
    .eq("id", purchaseId)
    .maybeSingle();
  if (!purchase || purchase.household_id !== household.id) {
    return { ok: false, message: "not_found" };
  }

  const active = await getOrCreateActiveList(household.id);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: existing } = await supabase
    .from("list_items")
    .select("id, qty, unit, checked")
    .eq("list_id", active.id)
    .eq("item_id", purchase.item_id)
    .maybeSingle();

  if (existing) {
    const sameUnit = existing.unit === purchase.unit;
    const newQty = sameUnit
      ? Number(existing.qty) + Number(purchase.qty)
      : Number(purchase.qty);
    await supabase
      .from("list_items")
      .update({
        qty: newQty,
        unit: existing.unit,
        checked: false,
        checked_at: null,
        purchase_id: null,
        added_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("list_items").insert({
      list_id: active.id,
      item_id: purchase.item_id,
      qty: purchase.qty,
      unit: purchase.unit,
      added_by: user?.id,
    });
  }

  revalidatePath("/list");
  return { ok: true };
}

/**
 * Remove a purchase from history. If a checked list_item is still linked
 * to it, the DELETE cascade clears that link. The recompute trigger fires
 * so the consumption profile stays in sync.
 */
export async function deletePurchase(purchaseId: string): Promise<{
  ok: boolean;
  message?: string;
}> {
  const supabase = await createClient();
  const household = await getCurrentHousehold();
  if (!household) return { ok: false, message: "no_household" };

  const { data: purchase } = await supabase
    .from("purchases")
    .select("id, household_id")
    .eq("id", purchaseId)
    .maybeSingle();
  if (!purchase || purchase.household_id !== household.id) {
    return { ok: false, message: "not_found" };
  }

  const { error } = await supabase
    .from("purchases")
    .delete()
    .eq("id", purchaseId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/history");
  revalidatePath("/list");
  return { ok: true };
}

/**
 * Update qty and/or unit on a purchase row. The DB trigger that listens
 * for purchases changes will recompute consumption_profiles, so the AI
 * predictions stay in sync.
 */
export async function updatePurchase(
  purchaseId: string,
  patch: { qty?: number; unit?: string },
): Promise<{ ok: boolean; message?: string }> {
  const supabase = await createClient();
  const household = await getCurrentHousehold();
  if (!household) return { ok: false, message: "no_household" };

  const { data: purchase } = await supabase
    .from("purchases")
    .select("id, item_id, household_id")
    .eq("id", purchaseId)
    .maybeSingle();
  if (!purchase || purchase.household_id !== household.id) {
    return { ok: false, message: "not_found" };
  }

  const update: Record<string, unknown> = {};
  if (typeof patch.qty === "number" && Number.isFinite(patch.qty) && patch.qty > 0) {
    update.qty = patch.qty;
  }
  if (typeof patch.unit === "string" && VALID_UNITS.has(patch.unit)) {
    update.unit = patch.unit;
  }
  if (Object.keys(update).length === 0) return { ok: true };

  const { error } = await supabase
    .from("purchases")
    .update(update)
    .eq("id", purchaseId);
  if (error) return { ok: false, message: error.message };

  // Trigger handle_new_purchase only fires on INSERT. Manually recompute
  // so the consumption profile reflects the new qty/unit immediately.
  await supabase.rpc("recompute_consumption", { p_item_id: purchase.item_id });

  revalidatePath("/history");
  revalidatePath("/list");
  return { ok: true };
}
