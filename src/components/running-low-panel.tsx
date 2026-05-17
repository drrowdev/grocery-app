"use client";

import { useState, useTransition } from "react";
import { TrendingDown, Plus, Loader2 } from "lucide-react";
import { useLang } from "@/components/lang-provider";
import { addSuggested } from "@/app/list/actions";
import { capitalizeFirst } from "@/lib/utils";

export type RunningLowItem = {
  item_id: string;
  canonical_fi: string;
  canonical_sv: string;
  avg_cycle_days: number | null;
  avg_qty: number | null;
  unit: string;
  default_qty: number;
  category: {
    key: string;
    name_fi: string;
    name_sv: string;
    icon: string | null;
    sort_order: number;
  } | null;
  last_purchased_at: string | null;
};

export function RunningLowPanel({ items }: { items: RunningLowItem[] }) {
  const { lang, t } = useLang();
  const [pending, startTransition] = useTransition();
  // Lock "now" once at mount to keep render pure across re-renders.
  const [now] = useState<number>(() => Date.now());

  return (
    <section className="mb-6 rounded-2xl border border-orange-200 bg-orange-50/60 p-4 shadow-sm dark:border-orange-900/40 dark:bg-orange-950/20">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-orange-900 dark:text-orange-200">
        <TrendingDown className="h-4 w-4" />
        {t("runningLowSoon")}
      </h2>

      {items.length === 0 ? (
        <p className="text-xs text-orange-800/70 dark:text-orange-200/60">
          {t("runningLowEmpty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.map((it) => {
            const daysAgo = it.last_purchased_at
              ? Math.max(
                  0,
                  Math.floor(
                    (now - new Date(it.last_purchased_at).getTime()) /
                      86400000,
                  ),
                )
              : null;
            return (
              <li
                key={it.item_id}
                className="flex items-center justify-between gap-3 rounded-lg bg-white/70 px-3 py-2 dark:bg-zinc-900/40"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50 truncate">
                    {capitalizeFirst(
                      lang === "fi" ? it.canonical_fi : it.canonical_sv,
                    )}
                  </p>
                  <p className="text-xs text-zinc-500 truncate">
                    {it.avg_cycle_days
                      ? t("usuallyEvery", {
                          n: Math.round(it.avg_cycle_days),
                        })
                      : null}
                    {it.avg_cycle_days && daysAgo !== null ? " · " : ""}
                    {daysAgo !== null
                      ? t("daysAgo", { n: daysAgo })
                      : null}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    startTransition(async () => {
                      await addSuggested(it.item_id);
                    })
                  }
                  disabled={pending}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md bg-orange-600 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-orange-700 disabled:opacity-60"
                >
                  {pending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  {t("add")}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
