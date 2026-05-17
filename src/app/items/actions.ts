"use server";

import { revalidatePath } from "next/cache";
import { resolveItem } from "@/lib/categorize";
import { getCurrentHousehold } from "@/lib/household";
import { createClient } from "@/lib/supabase/server";

export type AddItemResult =
  | { ok: true; canonical_fi: string; canonical_sv: string; wasCreated: boolean }
  | { ok: false; error: "empty" | "no_household" | "generic" };

export async function addItem(formData: FormData): Promise<AddItemResult> {
  const raw = String(formData.get("text") ?? "").trim();
  if (!raw) return { ok: false, error: "empty" };

  const household = await getCurrentHousehold();
  if (!household) return { ok: false, error: "no_household" };

  try {
    const resolved = await resolveItem(household.id, raw);
    revalidatePath("/items");
    return {
      ok: true,
      canonical_fi: resolved.canonical_fi,
      canonical_sv: resolved.canonical_sv,
      wasCreated: resolved.wasCreated,
    };
  } catch (e) {
    console.error("addItem error:", e);
    return { ok: false, error: "generic" };
  }
}

export async function deleteItem(itemId: string) {
  const supabase = await createClient();
  await supabase.from("items").delete().eq("id", itemId);
  revalidatePath("/items");
}
