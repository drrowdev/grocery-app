"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * If profile rows are missing for current users (e.g. signups before the
 * profiles trigger was installed), backfill them so display works.
 */
export async function backfillMyProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        email: user.email,
        display_name:
          (user.user_metadata?.display_name as string | undefined) ??
          (user.email ? user.email.split("@")[0] : null),
      },
      { onConflict: "id", ignoreDuplicates: true },
    );
}

export async function inviteToHousehold(
  householdId: string,
  email: string,
): Promise<{ ok: true } | { ok: false; error: string; message?: string }> {
  const cleaned = email.trim().toLowerCase();
  if (!cleaned || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleaned)) {
    return { ok: false, error: "invalid_email" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data: existing } = await supabase
    .from("household_members")
    .select("user_id, profile:profiles(email)")
    .eq("household_id", householdId);

  if (
    (existing ?? []).some(
      (m) =>
        (m.profile as unknown as { email?: string } | null)?.email?.toLowerCase() ===
        cleaned,
    )
  ) {
    return { ok: false, error: "already_member" };
  }

  const { error } = await supabase
    .from("household_invitations")
    .upsert(
      {
        household_id: householdId,
        email: cleaned,
        invited_by: user.id,
        accepted_at: null,
      },
      { onConflict: "household_id,email" },
    );

  if (error) {
    return { ok: false, error: "generic", message: error.message };
  }

  revalidatePath("/household");
  return { ok: true };
}

export async function revokeInvitation(invitationId: string) {
  const supabase = await createClient();
  await supabase.from("household_invitations").delete().eq("id", invitationId);
  revalidatePath("/household");
}

export async function removeMember(householdId: string, userId: string) {
  const supabase = await createClient();
  await supabase
    .from("household_members")
    .delete()
    .eq("household_id", householdId)
    .eq("user_id", userId);
  revalidatePath("/household");
}

export async function leaveHousehold(householdId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("household_members")
    .delete()
    .eq("household_id", householdId)
    .eq("user_id", user.id);
  revalidatePath("/");
}
