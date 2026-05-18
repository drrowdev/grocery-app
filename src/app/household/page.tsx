import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentHousehold } from "@/lib/household";
import { backfillMyProfile } from "@/app/household/actions";
import { HouseholdView } from "@/components/household-view";

export const dynamic = "force-dynamic";

export type MemberRow = {
  user_id: string;
  role: "owner" | "member";
  email: string | null;
  display_name: string | null;
};

export type InvitationRow = {
  id: string;
  email: string;
  invited_at: string;
};

export default async function HouseholdPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const household = await getCurrentHousehold();
  if (!household) redirect("/");
  // Only owners can access this page
  if (household.role !== "owner") redirect("/list");

  // Make sure profile rows exist for the current user (early signups
  // might have skipped the trigger).
  await backfillMyProfile();

  // Fetch members and profiles separately to avoid an inner-join filter
  // when a member's profile row hasn't been backfilled.
  const { data: members } = await supabase
    .from("household_members")
    .select("user_id, role")
    .eq("household_id", household.id)
    .order("joined_at");

  const userIds = (members ?? []).map((m) => m.user_id as string);
  const { data: profiles } = userIds.length
    ? await supabase
        .from("profiles")
        .select("id, email, display_name")
        .in("id", userIds)
    : { data: [] };

  const profileMap = new Map<
    string,
    { email: string | null; display_name: string | null }
  >();
  for (const p of profiles ?? []) {
    profileMap.set(p.id as string, {
      email: (p.email as string | null) ?? null,
      display_name: (p.display_name as string | null) ?? null,
    });
  }

  const memberRows: MemberRow[] = (members ?? []).map((m) => {
    const p = profileMap.get(m.user_id as string);
    return {
      user_id: m.user_id as string,
      role: m.role as "owner" | "member",
      email: p?.email ?? null,
      display_name: p?.display_name ?? null,
    };
  });

  const isOwner =
    memberRows.find((m) => m.user_id === user.id)?.role === "owner";

  const { data: invites } = await supabase
    .from("household_invitations")
    .select("id, email, invited_at")
    .eq("household_id", household.id)
    .is("accepted_at", null)
    .order("invited_at", { ascending: false });

  return (
    <HouseholdView
      householdName={household.name}
      householdId={household.id}
      members={memberRows}
      invitations={(invites ?? []) as InvitationRow[]}
      currentUserId={user.id}
      isOwner={isOwner}
    />
  );
}
