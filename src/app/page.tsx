import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { OnboardingShell } from "@/components/onboarding-shell";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch the user's first household (Phase 4: a user only has one).
  const { data: memberships } = await supabase
    .from("household_members")
    .select("households(id, name)")
    .order("joined_at", { ascending: true })
    .limit(1);

  const household = memberships?.[0]?.households as
    | { id: string; name: string }
    | undefined;

  const email = user.email ?? "";

  if (!household) {
    return <OnboardingShell userEmail={email} />;
  }

  return <AppShell householdName={household.name} userEmail={email} />;
}
