"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentHousehold } from "@/lib/household";

export type ItemAdminPatch = {
  canonical_fi?: string;
  canonical_sv?: string;
  category_key?: string | null;
  unit?: string;
  default_qty?: number;
};

export async function adminUpdateItem(
  itemId: string,
  patch: ItemAdminPatch,
): Promise<{ ok: boolean; message?: string }> {
  const supabase = await createClient();
  const household = await getCurrentHousehold();
  if (!household || household.role !== "owner") {
    return { ok: false, message: "forbidden" };
  }

  const { data: existing } = await supabase
    .from("items")
    .select("id, household_id, canonical_fi, canonical_sv")
    .eq("id", itemId)
    .maybeSingle();
  if (!existing || existing.household_id !== household.id) {
    return { ok: false, message: "not_found" };
  }

  const update: Record<string, unknown> = {};
  if (typeof patch.canonical_fi === "string" && patch.canonical_fi.trim()) {
    update.canonical_fi = patch.canonical_fi.trim();
  }
  if (typeof patch.canonical_sv === "string" && patch.canonical_sv.trim()) {
    update.canonical_sv = patch.canonical_sv.trim();
  }
  if (typeof patch.unit === "string") update.unit = patch.unit;
  if (typeof patch.default_qty === "number" && patch.default_qty > 0) {
    update.default_qty = patch.default_qty;
  }

  if (patch.category_key !== undefined) {
    if (patch.category_key === null || patch.category_key === "") {
      update.category_id = null;
    } else {
      const { data: cat } = await supabase
        .from("categories")
        .select("id")
        .eq("key", patch.category_key)
        .maybeSingle();
      if (cat) update.category_id = cat.id;
    }
  }

  if (Object.keys(update).length === 0) return { ok: true };

  const { error } = await supabase
    .from("items")
    .update(update)
    .eq("id", itemId);
  if (error) return { ok: false, message: error.message };

  const seedAliases: { alias: string; lang: "fi" | "sv" }[] = [];
  if (
    update.canonical_fi &&
    existing.canonical_fi &&
    existing.canonical_fi.toLowerCase() !==
      String(update.canonical_fi).toLowerCase()
  ) {
    seedAliases.push({ alias: existing.canonical_fi.toLowerCase(), lang: "fi" });
  }
  if (
    update.canonical_sv &&
    existing.canonical_sv &&
    existing.canonical_sv.toLowerCase() !==
      String(update.canonical_sv).toLowerCase()
  ) {
    seedAliases.push({ alias: existing.canonical_sv.toLowerCase(), lang: "sv" });
  }
  if (seedAliases.length > 0) {
    await supabase
      .from("item_aliases")
      .upsert(
        seedAliases.map((a) => ({ item_id: itemId, ...a })),
        { onConflict: "item_id,alias,lang", ignoreDuplicates: true },
      );
  }

  revalidatePath("/items");
  revalidatePath("/list");
  return { ok: true };
}

export async function adminAddAlias(
  itemId: string,
  alias: string,
  lang: "fi" | "sv" = "fi",
): Promise<{ ok: boolean; message?: string }> {
  const supabase = await createClient();
  const household = await getCurrentHousehold();
  if (!household || household.role !== "owner") {
    return { ok: false, message: "forbidden" };
  }

  const cleaned = alias.trim().toLowerCase();
  if (!cleaned) return { ok: false, message: "empty" };

  const { data: existing } = await supabase
    .from("items")
    .select("id, household_id")
    .eq("id", itemId)
    .maybeSingle();
  if (!existing || existing.household_id !== household.id) {
    return { ok: false, message: "not_found" };
  }

  const { error } = await supabase
    .from("item_aliases")
    .upsert(
      { item_id: itemId, alias: cleaned, lang },
      { onConflict: "item_id,alias,lang", ignoreDuplicates: true },
    );
  if (error) return { ok: false, message: error.message };

  revalidatePath("/items");
  return { ok: true };
}

export async function adminRemoveAlias(
  itemId: string,
  alias: string,
  lang: "fi" | "sv",
): Promise<{ ok: boolean; message?: string }> {
  const supabase = await createClient();
  const household = await getCurrentHousehold();
  if (!household || household.role !== "owner") {
    return { ok: false, message: "forbidden" };
  }

  const { data: existing } = await supabase
    .from("items")
    .select("id, household_id")
    .eq("id", itemId)
    .maybeSingle();
  if (!existing || existing.household_id !== household.id) {
    return { ok: false, message: "not_found" };
  }

  await supabase
    .from("item_aliases")
    .delete()
    .eq("item_id", itemId)
    .eq("alias", alias.toLowerCase())
    .eq("lang", lang);

  revalidatePath("/items");
  return { ok: true };
}

export async function adminDeleteItem(
  itemId: string,
): Promise<{ ok: boolean; message?: string }> {
  const supabase = await createClient();
  const household = await getCurrentHousehold();
  if (!household || household.role !== "owner") {
    return { ok: false, message: "forbidden" };
  }

  const { data: existing } = await supabase
    .from("items")
    .select("id, household_id")
    .eq("id", itemId)
    .maybeSingle();
  if (!existing || existing.household_id !== household.id) {
    return { ok: false, message: "not_found" };
  }

  const { error } = await supabase.from("items").delete().eq("id", itemId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/items");
  revalidatePath("/list");
  return { ok: true };
}
