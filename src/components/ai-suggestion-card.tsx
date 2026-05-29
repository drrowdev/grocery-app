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
  typical_weekday: number | null;
  runout_in_days: number | null;
};

export type AiStatus = {
  tracked: number;
  recurring: number;
  dueNow: number;
};

type Mode = "active" | "watching" | "learning" | "idle";

function modeFor(status: AiStatus, visibleCount: number): Mode {
  if (visibleCount > 0) return "active";
  if (status.recurring > 0) return "watching";
  if (status.tracked > 0) return "learning";
  return "idle";
}

const DOT_COLORS: Record<Mode, string> = {
  active: "bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.18)]",
  watching: "bg-sky-500 shadow-[0_0_0_4px_rgba(14,165,233,0.18)]",
  learning: "bg-amber-500 shadow-[0_0_0_4px_rgba(245,158,11,0.18)]",
  idle: "bg-zinc-400 shadow-[0_0_0_4px_rgba(161,161,170,0.18)]",
};

export function AiSuggestionCard({
  suggestions,
  status,
  currentListId,
}: {
  suggestions: AiSuggestion[];
  status: AiStatus;
  currentListId: string;
}) {
  const router = useRouter();
  const { lang, t } = useLang();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const visible = suggestions.filter((s) => !dismissed.has(s.item_id));
  const mode = modeFor(status, visible.length);

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

  const headline =
    mode === "active"
      ? t("aiModeActive")
      : mode === "watching"
        ? t("aiModeWatching")
        : mode === "learning"
          ? t("aiModeLearning")
          : t("aiModeIdle");

  const subline =
    mode === "active"
      ? t("aiSubActive")
      : mode === "watching"
        ? t("aiSubWatching", { n: status.recurring })
        : mode === "learning"
          ? t("aiSubLearning", { n: status.tracked })
          : t("aiSubIdle");

  return (
    <aside className="w-full">
      <div className="relative overflow-hidden rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50 via-white to-violet-50 p-3 shadow-sm dark:border-emerald-900/40 dark:from-emerald-950/40 dark:via-zinc-900 dark:to-violet-950/30">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(16,185,129,0.10),transparent_60%),radial-gradient(ellipse_at_bottom_right,rgba(139,92,246,0.10),transparent_60%)]"
          aria-hidden="true"
        />
        <div className="relative">
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-block h-2 w-2 rounded-full ${DOT_COLORS[mode]} animate-pulse`}
              aria-hidden
            />
            <Sparkles
              className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400"
              aria-hidden
            />
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              {headline}
            </h3>
          </div>
          <p className="mt-1 text-[11px] leading-snug text-zinc-600 dark:text-zinc-400">
            {subline}
          </p>

          {visible.length > 0 && (
            <ul className="mt-2 flex flex-col gap-0.5">
              {visible.map((s) => {
                const label =
                  lang === "fi" ? s.canonical_fi : s.canonical_sv;
                const emoji = getItemEmoji(s.canonical_fi, s.category_key);
                const isAdding = adding.has(s.item_id);
                const hint = predictionHint(s, lang);
                return (
                  <li key={s.item_id} className="group flex items-center">
                    <button
                      type="button"
                      onClick={() => void handleAdd(s)}
                      disabled={isAdding || pending}
                      className="flex flex-1 items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm text-zinc-800 transition hover:bg-white/70 active:scale-[0.98] dark:text-zinc-100 dark:hover:bg-zinc-800/60 disabled:opacity-50"
                    >
                      <span aria-hidden className="mt-0.5">
                        {emoji}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block truncate">
                          {capitalizeFirst(label)}
                        </span>
                        {hint && (
                          <span className="block text-[10px] leading-tight text-zinc-500 truncate">
                            {hint}
                          </span>
                        )}
                      </span>
                      {isAdding ? (
                        <Loader2 className="mt-1 h-3 w-3 animate-spin text-emerald-600" />
                      ) : (
                        <Plus className="mt-1 h-3 w-3 text-emerald-600 opacity-60 group-hover:opacity-100" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </aside>
  );
}

const WEEKDAY_FI = [
  "sunnuntaisin",
  "maanantaisin",
  "tiistaisin",
  "keskiviikkoisin",
  "torstaisin",
  "perjantaisin",
  "lauantaisin",
];
const WEEKDAY_SV = [
  "söndagar",
  "måndagar",
  "tisdagar",
  "onsdagar",
  "torsdagar",
  "fredagar",
  "lördagar",
];

/** Build a short prediction subtitle: runout estimate + weekday hint. */
function predictionHint(s: AiSuggestion, lang: "fi" | "sv"): string | null {
  const parts: string[] = [];
  if (s.runout_in_days !== null) {
    if (s.runout_in_days <= 0) {
      parts.push(lang === "fi" ? "Loppunut" : "Slut");
    } else if (s.runout_in_days === 1) {
      parts.push(lang === "fi" ? "Loppuu pian" : "Tar slut snart");
    } else {
      parts.push(
        lang === "fi"
          ? `Loppuu noin ${s.runout_in_days} päivässä`
          : `Tar slut om ca ${s.runout_in_days} dagar`,
      );
    }
  }
  if (s.typical_weekday !== null) {
    const day =
      lang === "fi"
        ? WEEKDAY_FI[s.typical_weekday]
        : WEEKDAY_SV[s.typical_weekday];
    if (day) {
      parts.push(
        lang === "fi" ? `yleensä ${day}` : `vanligen på ${day}`,
      );
    }
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}
