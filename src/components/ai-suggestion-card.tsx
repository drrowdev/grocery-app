"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Sparkles } from "lucide-react";
import { useLang } from "@/components/lang-provider";
import { createClient } from "@/lib/supabase/client";
import { capitalizeFirst } from "@/lib/utils";
import { getItemEmoji } from "@/lib/item-emoji";

export type AiSuggestion = {
  item_id: string;
  canonical_fi: string;
  canonical_sv: string;
  unit: string;
  default_qty: number;
  category_key: string | null;
  avg_cycle_days: number | null;
  last_purchased_at: string | null;
};

export function AiSuggestionCard({
  suggestions,
  currentListId,
}: {
  suggestions: AiSuggestion[];
  currentListId: string;
}) {
  const router = useRouter();
  const { lang, t } = useLang();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const visible = suggestions.filter((s) => !dismissed.has(s.item_id));
  if (visible.length === 0) return null;

  async function handleAdd(s: AiSuggestion) {
    setAdding((prev) => new Set(prev).add(s.item_id));
    const supabase = createClient();
    const { error } = await supabase.from("list_items").insert({
      list_id: currentListId,
      item_id: s.item_id,
      qty: s.default_qty,
      unit: s.unit,
    });
    if (!error) {
      setDismissed((prev) => new Set(prev).add(s.item_id));
      startTransition(() => router.refresh());
    }
    setAdding((prev) => {
      const next = new Set(prev);
      next.delete(s.item_id);
      return next;
    });
  }

  return (
    <aside className="hidden md:block mt-4 w-52 shrink-0">
      <div className="relative overflow-hidden rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50 via-white to-violet-50 p-3 shadow-sm dark:border-emerald-900/40 dark:from-emerald-950/40 dark:via-zinc-900 dark:to-violet-950/30">
        {/* Subtle shimmer */}
        <div
          className="pointer-events-none absolute inset-0 -inset-y-2 bg-[radial-gradient(ellipse_at_top_left,rgba(16,185,129,0.10),transparent_60%),radial-gradient(ellipse_at_bottom_right,rgba(139,92,246,0.10),transparent_60%)]"
          aria-hidden="true"
        />
        <div className="relative">
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles
              className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 animate-pulse"
              aria-hidden
            />
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              {t("aiSuggests")}
            </h3>
          </div>
          <ul className="flex flex-col gap-0.5">
            {visible.map((s) => {
              const label =
                lang === "fi" ? s.canonical_fi : s.canonical_sv;
              const emoji = getItemEmoji(s.canonical_fi, s.category_key);
              const isAdding = adding.has(s.item_id);
              return (
                <li key={s.item_id} className="group flex items-center">
                  <button
                    type="button"
                    onClick={() => void handleAdd(s)}
                    disabled={isAdding || pending}
                    className="flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-zinc-800 transition hover:bg-white/70 active:scale-[0.98] dark:text-zinc-100 dark:hover:bg-zinc-800/60 disabled:opacity-50"
                  >
                    <span aria-hidden>{emoji}</span>
                    <span className="flex-1 truncate">
                      {capitalizeFirst(label)}
                    </span>
                    {isAdding ? (
                      <Loader2 className="h-3 w-3 animate-spin text-emerald-600" />
                    ) : (
                      <Plus className="h-3 w-3 text-emerald-600 opacity-60 group-hover:opacity-100" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-[10px] text-zinc-500 dark:text-zinc-500">
            {t("aiSuggestHint")}
          </p>
        </div>
      </div>
    </aside>
  );
}
