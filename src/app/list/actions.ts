"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentHousehold } from "@/lib/household";
import { getOrCreateActiveList } from "@/lib/list";
import { resolveItem } from "@/lib/categorize";
import { parseBulkInput } from "@/lib/parse-bulk";

export type QuickAddResult =
  | { ok: true; added: string[]; merged: string[] }
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
        const newQty = existing.checked || !sameUnit ? qty : existing.qty + qty;
        await supabase
          .from("list_items")
          .update({
            qty: newQty,
            unit,
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
    return { ok: true, added, merged };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("quickAdd error:", e);
    return { ok: false, error: "generic", message };
  }
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

export async function completeList(listId: string) {
  const supabase = await createClient();
  const household = await getCurrentHousehold();
  if (!household) return { ok: false as const, error: "no_household" as const };

  const { data: checked, error: fetchErr } = await supabase
    .from("list_items")
    .select("item_id, qty, unit")
    .eq("list_id", listId)
    .eq("checked", true);

  if (fetchErr) {
    return {
      ok: false as const,
      error: "generic" as const,
      message: fetchErr.message,
    };
  }
  if (!checked || checked.length === 0) {
    return { ok: false as const, error: "nothing_checked" as const };
  }

  const purchaseRows = checked.map((c) => ({
    household_id: household.id,
    item_id: c.item_id,
    qty: c.qty,
    unit: c.unit,
    list_id: listId,
  }));

  const { error: insertErr } = await supabase
    .from("purchases")
    .insert(purchaseRows);

  if (insertErr) {
    return {
      ok: false as const,
      error: "generic" as const,
      message: insertErr.message,
    };
  }

  await supabase
    .from("shopping_lists")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", listId);

  revalidatePath("/list");
  revalidatePath("/");
  return { ok: true as const, count: purchaseRows.length };
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
