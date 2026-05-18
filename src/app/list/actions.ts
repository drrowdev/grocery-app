"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentHousehold } from "@/lib/household";
import { getOrCreateActiveList } from "@/lib/list";
import { resolveItem } from "@/lib/categorize";
import { parseBulkInput } from "@/lib/parse-bulk";

export type QuickAddResult =
  | {
      ok: true;
      added: string[];
      merged: string[];
      conflicts: { name: string; existingQty: number; existingUnit: string }[];
    }
  | { ok: false; error: "empty" | "no_household" | "generic"; message?: string };

export async function quickAdd(formData: FormData): Promise<QuickAddResult> {
  const raw = String(formData.get("text") ?? "").trim();
  if (!raw) return { ok: false, error: "empty" };

  const household = await getCurrentHousehold();
  if (!household) return { ok: false, error: "no_household" };

  try {
    const parsed = await parseBulkInput(raw);
    if (parsed.length === 0) return { ok: false, error: "empty" };

    const list = await getOrCreateActiveList(household.id);
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const added: string[] = [];
    const merged: string[] = [];
    const conflicts: {
      name: string;
      existingQty: number;
      existingUnit: string;
    }[] = [];

    for (const p of parsed) {
      const resolved = await resolveItem(household.id, p.name);
      const qty = p.qty ?? resolved.default_qty;
      const unit = p.unit ?? resolved.unit;

      const { data: existing } = await supabase
        .from("list_items")
        .select("id, qty, unit, checked")
        .eq("list_id", list.id)
        .eq("item_id", resolved.id)
        .maybeSingle();

      if (existing) {
        const sameUnit = existing.unit === unit;
        if (!sameUnit && !existing.checked) {
          conflicts.push({
            name: resolved.canonical_fi,
            existingQty: Number(existing.qty),
            existingUnit: existing.unit,
          });
          continue;
        }
        const newQty = existing.checked
          ? qty
          : Number(existing.qty) + qty;
        await supabase
          .from("list_items")
          .update({
            qty: newQty,
            unit: existing.checked ? unit : existing.unit,
            checked: false,
            checked_at: null,
            added_by: user?.id,
            added_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        merged.push(resolved.canonical_fi);
      } else {
        await supabase.from("list_items").insert({
          list_id: list.id,
          item_id: resolved.id,
          qty,
          unit,
          added_by: user?.id,
        });
        added.push(resolved.canonical_fi);
      }
    }

    revalidatePath("/list");
    return { ok: true, added, merged, conflicts };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("quickAdd error:", e);
    return { ok: false, error: "generic", message };
  }
}

export async function updateListItem(
  listItemId: string,
  patch: { qty?: number; unit?: string; note?: string | null },
) {
  const supabase = await createClient();
  const update: Record<string, unknown> = {};
  if (typeof patch.qty === "number" && patch.qty > 0) update.qty = patch.qty;
  if (typeof patch.unit === "string") update.unit = patch.unit;
  if (patch.note !== undefined) update.note = patch.note;
  if (Object.keys(update).length === 0) return;

  await supabase.from("list_items").update(update).eq("id", listItemId);
  revalidatePath("/list");
}

export async function editListItem(
  listItemId: string,
  patch: { name?: string; qty?: number; unit?: string; note?: string | null },
): Promise<
  | { ok: true; canonical_fi: string; canonical_sv: string; swapped: boolean }
  | { ok: false; error: string; message?: string }
> {
  const supabase = await createClient();

  const { data: row, error: loadErr } = await supabase
    .from("list_items")
    .select(
      "id, list_id, qty, unit, item_id, items!inner(household_id, canonical_fi, canonical_sv)",
    )
    .eq("id", listItemId)
    .single();

  if (loadErr || !row) {
    return { ok: false, error: "not_found", message: loadErr?.message };
  }

  type ItemMini = {
    household_id: string;
    canonical_fi: string;
    canonical_sv: string;
  };
  const currentItem = row.items as unknown as ItemMini;

  let nextItemId = row.item_id as string;
  let canonical_fi = currentItem.canonical_fi;
  let canonical_sv = currentItem.canonical_sv;
  let swapped = false;

  if (patch.name && patch.name.trim()) {
    const trimmed = patch.name.trim();
    const currentMatch =
      trimmed.toLowerCase() === currentItem.canonical_fi.toLowerCase() ||
      trimmed.toLowerCase() === currentItem.canonical_sv.toLowerCase();

    if (!currentMatch) {
      try {
        const resolved = await resolveItem(currentItem.household_id, trimmed);
        if (resolved.id !== row.item_id) {
          nextItemId = resolved.id;
          swapped = true;
        }
        canonical_fi = resolved.canonical_fi;
        canonical_sv = resolved.canonical_sv;
      } catch (e) {
        return {
          ok: false,
          error: "categorize_failed",
          message: e instanceof Error ? e.message : String(e),
        };
      }
    }
  }

  const update: Record<string, unknown> = {};
  if (swapped) update.item_id = nextItemId;
  if (typeof patch.qty === "number" && patch.qty > 0) update.qty = patch.qty;
  if (typeof patch.unit === "string") update.unit = patch.unit;
  if (patch.note !== undefined) update.note = patch.note;

  if (Object.keys(update).length > 0) {
    if (swapped) {
      const { data: existing } = await supabase
        .from("list_items")
        .select("id, qty, unit")
        .eq("list_id", row.list_id as string)
        .eq("item_id", nextItemId)
        .neq("id", listItemId)
        .maybeSingle();

      if (existing) {
        const sameUnit = existing.unit === (patch.unit ?? row.unit);
        const finalQty = sameUnit
          ? Number(existing.qty) + (patch.qty ?? Number(row.qty))
          : (patch.qty ?? Number(row.qty));
        await supabase
          .from("list_items")
          .update({
            qty: finalQty,
            unit: patch.unit ?? row.unit,
            checked: false,
            checked_at: null,
          })
          .eq("id", existing.id);
        await supabase.from("list_items").delete().eq("id", listItemId);
        revalidatePath("/list");
        return { ok: true, canonical_fi, canonical_sv, swapped: true };
      }
    }

    const { error: updateErr } = await supabase
      .from("list_items")
      .update(update)
      .eq("id", listItemId);
    if (updateErr) {
      return { ok: false, error: "update_failed", message: updateErr.message };
    }
  }

  revalidatePath("/list");
  return { ok: true, canonical_fi, canonical_sv, swapped };
}

export async function toggleListItem(listItemId: string, checked: boolean) {
  const supabase = await createClient();
  await supabase
    .from("list_items")
    .update({
      checked,
      checked_at: checked ? new Date().toISOString() : null,
    })
    .eq("id", listItemId);
}

export async function removeListItem(listItemId: string) {
  const supabase = await createClient();
  await supabase.from("list_items").delete().eq("id", listItemId);
}

/**
 * Remove all checked items from the active list. For each removed item we
 * also log a purchase row so the recurrence engine keeps learning.
 * Unlike the old `completeList`, this does NOT archive the list — the same
 * list stays active, just without the cleared items.
 */
export async function removeCheckedItems(listId: string): Promise<{
  ok: boolean;
  count: number;
  message?: string;
}> {
  const supabase = await createClient();
  const household = await getCurrentHousehold();
  if (!household) return { ok: false, count: 0, message: "no_household" };

  const { data: checked, error: fetchErr } = await supabase
    .from("list_items")
    .select("id, item_id, qty, unit")
    .eq("list_id", listId)
    .eq("checked", true);

  if (fetchErr) return { ok: false, count: 0, message: fetchErr.message };
  if (!checked || checked.length === 0) return { ok: true, count: 0 };

  // Log purchases so consumption_profiles learns
  await supabase.from("purchases").insert(
    checked.map((c) => ({
      household_id: household.id,
      item_id: c.item_id,
      qty: c.qty,
      unit: c.unit,
      list_id: listId,
    })),
  );

  // Delete the checked rows
  await supabase
    .from("list_items")
    .delete()
    .in(
      "id",
      checked.map((c) => c.id),
    );

  revalidatePath("/list");
  return { ok: true, count: checked.length };
}

/**
 * @deprecated Use removeCheckedItems instead. Kept for /history reorder flow.
 */
export async function completeList(listId: string) {
  return removeCheckedItems(listId);
}

export async function addSuggested(itemId: string) {
  const household = await getCurrentHousehold();
  if (!household) return;

  const supabase = await createClient();
  const list = await getOrCreateActiveList(household.id);

  const { data: profile } = await supabase
    .from("consumption_profiles")
    .select("avg_qty")
    .eq("item_id", itemId)
    .maybeSingle();

  const { data: item } = await supabase
    .from("items")
    .select("default_qty, unit")
    .eq("id", itemId)
    .single();

  if (!item) return;

  const qty = profile?.avg_qty
    ? Math.max(1, Math.round(Number(profile.avg_qty)))
    : item.default_qty;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase
    .from("list_items")
    .upsert(
      {
        list_id: list.id,
        item_id: itemId,
        qty,
        unit: item.unit,
        added_by: user?.id,
      },
      { onConflict: "list_id,item_id" },
    );

  revalidatePath("/list");
  revalidatePath("/");
}
