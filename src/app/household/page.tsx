import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentHousehold } from "@/lib/household";
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

  const { data: members } = await supabase
    .from("household_members")
    .select("user_id, role, profile:profiles(email, display_name)")
    .eq("household_id", household.id)
    .order("joined_at");

  const memberRows: MemberRow[] = ((members ?? []) as unknown as {
    user_id: string;
    role: "owner" | "member";
    profile: { email: string | null; display_name: string | null } | null;
  }[]).map((m) => ({
    user_id: m.user_id,
    role: m.role,
    email: m.profile?.email ?? null,
    display_name: m.profile?.display_name ?? null,
  }));

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
