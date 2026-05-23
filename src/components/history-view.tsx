"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { History, Loader2, Plus, X } from "lucide-react";
import { useLang } from "@/components/lang-provider";
import { AppHeader } from "@/components/app-header";
import { capitalizeFirst } from "@/lib/utils";
import { getItemEmoji } from "@/lib/item-emoji";
import { categoryDot } from "@/lib/category-colors";
import { QtyUnitEditor } from "@/components/qty-unit-editor";
import {
  deletePurchase,
  reorderFromPurchase,
  updatePurchase,
} from "@/app/history/actions";
import type { HistoryDay, HistoryPurchase } from "@/app/history/page";

function isToday(iso: string): boolean {
  const d = new Date();
  const todayIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return iso === todayIso;
}

function isYesterday(iso: string): boolean {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const ydayIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return iso === ydayIso;
}

function formatDay(iso: string, lang: "fi" | "sv"): string {
  if (isToday(iso)) return lang === "fi" ? "Tänään" : "Idag";
  if (isYesterday(iso)) return lang === "fi" ? "Eilen" : "Igår";
  try {
    return new Intl.DateTimeFormat(lang === "fi" ? "fi-FI" : "sv-FI", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(new Date(`${iso}T12:00:00`));
  } catch {
    return iso;
  }
}

export function HistoryView({
  isOwner,
  days: initialDays,
}: {
  isOwner: boolean;
  days: HistoryDay[];
}) {
  const router = useRouter();
  const { lang, t } = useLang();
  const [days, setDays] = useState(initialDays);
  const [pending, startTransition] = useTransition();

  function removePurchase(purchaseId: string) {
    setDays((prev) =>
      prev
        .map((d) => ({
          ...d,
          purchases: d.purchases.filter((p) => p.id !== purchaseId),
        }))
        .filter((d) => d.purchases.length > 0),
    );
    startTransition(async () => {
      await deletePurchase(purchaseId);
    });
  }

  function reorder(purchase: HistoryPurchase) {
    startTransition(async () => {
      const res = await reorderFromPurchase(purchase.id);
      if (res.ok) router.push("/list");
    });
  }

  function changePurchase(
    purchase: HistoryPurchase,
    patch: { qty?: number; unit?: string },
  ) {
    // Optimistic update
    setDays((prev) =>
      prev.map((d) => ({
        ...d,
        purchases: d.purchases.map((p) =>
          p.id === purchase.id ? { ...p, ...patch } : p,
        ),
      })),
    );
    startTransition(async () => {
      await updatePurchase(purchase.id, patch);
    });
  }

  return (
    <div className="flex flex-col flex-1 min-h-dvh bg-zinc-50 dark:bg-zinc-950">
      <main className="flex-1 px-5 py-5 mx-auto w-full max-w-2xl">
        <AppHeader
          title={t("history")}
          backHref="/list"
          isOwner={isOwner}
        />

        {days.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/50 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/50">
            <History className="mx-auto mb-2 h-6 w-6 text-zinc-400" />
            {t("historyEmpty")}
          </div>
        ) : (
          <ul className="space-y-5">
            {days.map((day) => (
              <li key={day.date}>
                <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                  {capitalizeFirst(formatDay(day.date, lang))}
                  <span className="text-xs font-normal text-zinc-400">
                    {day.purchases.length}
                  </span>
                </h2>
                <ul className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  {day.purchases.map((p, idx) => {
                    const name =
                      lang === "fi" ? p.canonical_fi : p.canonical_sv;
                    const emoji = getItemEmoji(p.canonical_fi, p.category_key);
                    const catName =
                      lang === "fi"
                        ? p.category_name_fi
                        : p.category_name_sv;
                    return (
                      <li
                        key={p.id}
                        className={`group flex items-center gap-2 px-3 py-2.5 ${
                          idx === 0 ? "" : "border-t border-zinc-100 dark:border-zinc-800"
                        }`}
                      >
                        <span
                          className={`inline-block h-2 w-2 rounded-full shrink-0 ${categoryDot(p.category_key ?? undefined)}`}
                          aria-hidden
                        />
                        <span className="text-lg shrink-0 select-none" aria-hidden>
                          {emoji}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50 truncate">
                            {capitalizeFirst(name)}
                          </p>
                          {catName && (
                            <p className="text-[11px] text-zinc-500 truncate">
                              {catName}
                            </p>
                          )}
                        </div>
                        <QtyUnitEditor
                          qty={p.qty}
                          unit={p.unit}
                          lang={lang}
                          onChange={(patch) => changePurchase(p, patch)}
                        />
                        <button
                          type="button"
                          onClick={() => reorder(p)}
                          disabled={pending}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white text-emerald-600 transition hover:bg-emerald-50 active:scale-95 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-emerald-950/30"
                          aria-label={t("reorderFromList")}
                          title={t("reorderFromList")}
                        >
                          {pending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Plus className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => removePurchase(p.id)}
                          disabled={pending}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-400 transition hover:bg-rose-50 hover:text-rose-600 active:scale-95 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-rose-950/30"
                          aria-label={t("remove")}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
