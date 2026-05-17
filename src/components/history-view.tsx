"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, History, Loader2, Plus } from "lucide-react";
import { useLang } from "@/components/lang-provider";
import { LangToggle } from "@/components/lang-toggle";
import { SignOutButton } from "@/components/sign-out-button";
import { capitalizeFirst } from "@/lib/utils";
import { reorderFromList } from "@/app/history/actions";
import type { HistoryList } from "@/app/history/page";

function formatDate(iso: string | null, lang: "fi" | "sv"): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(lang === "fi" ? "fi-FI" : "sv-FI", {
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

export function HistoryView({
  householdName,
  lists,
}: {
  householdName: string;
  lists: HistoryList[];
}) {
  const router = useRouter();
  const { lang, t } = useLang();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col flex-1 min-h-dvh bg-gradient-to-b from-emerald-50 to-white dark:from-zinc-950 dark:to-black">
      <header className="flex items-center justify-between px-5 py-4 border-b border-zinc-200/60 dark:border-zinc-800/60 bg-white/70 dark:bg-zinc-950/70 backdrop-blur">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/list"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-base font-semibold leading-none text-zinc-900 dark:text-zinc-50 truncate">
              {t("history")}
            </h1>
            <p className="text-[11px] text-zinc-500 mt-0.5 truncate">
              {householdName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <LangToggle />
          <SignOutButton />
        </div>
      </header>

      <main className="flex-1 px-5 py-6 mx-auto w-full max-w-2xl">
        {lists.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/50 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/50">
            <History className="mx-auto mb-2 h-6 w-6 text-zinc-400" />
            {t("historyEmpty")}
          </div>
        ) : (
          <ul className="space-y-3">
            {lists.map((list) => (
              <li
                key={list.id}
                className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 truncate">
                      {formatDate(list.completed_at, lang)}
                    </p>
                    <p className="text-xs text-zinc-500 truncate">
                      {t("itemsCount", { n: list.items.length })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      startTransition(async () => {
                        const res = await reorderFromList(list.id);
                        if (res.ok) router.push("/list");
                      })
                    }
                    disabled={pending}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {pending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                    {t("reorderFromList")}
                  </button>
                </div>
                <ul className="px-4 py-2 text-sm flex flex-wrap gap-x-3 gap-y-1 text-zinc-600 dark:text-zinc-400">
                  {list.items.slice(0, 12).map((it, i) => (
                    <li key={i} className="truncate">
                      {capitalizeFirst(
                        lang === "fi"
                          ? (it.item?.canonical_fi ?? "—")
                          : (it.item?.canonical_sv ?? "—"),
                      )}{" "}
                      <span className="text-xs text-zinc-400 tabular-nums">
                        {it.qty} {it.unit}
                      </span>
                    </li>
                  ))}
                  {list.items.length > 12 && (
                    <li className="text-xs text-zinc-400">
                      +{list.items.length - 12}
                    </li>
                  )}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </main>

      <footer className="px-5 py-4 text-center text-xs text-zinc-400">
        Ostoslista · v0.1
      </footer>
    </div>
  );
}
