import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { OnboardingShell } from "@/components/onboarding-shell";
import type { RunningLowItem } from "@/components/running-low-panel";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

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

  // Running low soon: recurring items predicted to need restocking within 3 days,
  // excluding items already on the active list.
  // eslint-disable-next-line react-hooks/purity -- server component, Date is fine per request
  const horizon = new Date(Date.now() + 3 * 86400000).toISOString();

  const { data: lowRaw } = await supabase
    .from("consumption_profiles")
    .select(
      "item_id, avg_cycle_days, avg_qty, last_purchased_at, next_predicted_date, item:items(canonical_fi, canonical_sv, unit)",
    )
    .eq("household_id", household.id)
    .eq("is_recurring", true)
    .lte("next_predicted_date", horizon)
    .order("next_predicted_date", { ascending: true })
    .limit(8);

  // Exclude items already on an active list
  const { data: activeList } = await supabase
    .from("shopping_lists")
    .select("id")
    .eq("household_id", household.id)
    .eq("status", "active")
    .maybeSingle();

  let onListSet = new Set<string>();
  if (activeList?.id) {
    const { data: existing } = await supabase
      .from("list_items")
      .select("item_id")
      .eq("list_id", activeList.id);
    onListSet = new Set((existing ?? []).map((r) => r.item_id as string));
  }

  type LowRow = {
    item_id: string;
    avg_cycle_days: number | null;
    avg_qty: number | null;
    last_purchased_at: string | null;
    item: {
      canonical_fi: string;
      canonical_sv: string;
      unit: string;
    } | null;
  };

  const runningLow: RunningLowItem[] = ((lowRaw ?? []) as unknown as LowRow[])
    .filter((r) => r.item && !onListSet.has(r.item_id))
    .map((r) => ({
      item_id: r.item_id,
      canonical_fi: r.item!.canonical_fi,
      canonical_sv: r.item!.canonical_sv,
      avg_cycle_days: r.avg_cycle_days,
      avg_qty: r.avg_qty,
      unit: r.item!.unit,
      last_purchased_at: r.last_purchased_at,
    }));

  return (
    <AppShell
      householdName={household.name}
      userEmail={email}
      runningLow={runningLow}
    />
  );
}
