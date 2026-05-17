import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingShell } from "@/components/onboarding-shell";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Auto-accept any pending household invitations for this user's email.
  await supabase.rpc("accept_pending_invitations");

  const { data: memberships } = await supabase
    .from("household_members")
    .select("households(id, name)")
    .order("joined_at", { ascending: true })
    .limit(1);

  const household = memberships?.[0]?.households as
    | { id: string; name: string }
    | undefined;

  if (!household) {
    return <OnboardingShell userEmail={user.email ?? ""} />;
  }

  redirect("/list");
}
