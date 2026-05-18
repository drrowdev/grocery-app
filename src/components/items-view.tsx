"use client";

import { useRef, useState, useTransition } from "react";
import { Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { useLang } from "@/components/lang-provider";
import { AppHeader } from "@/components/app-header";
import { addItem, deleteItem } from "@/app/items/actions";
import { capitalizeFirst } from "@/lib/utils";

type ItemRow = {
  id: string;
  canonical_fi: string;
  canonical_sv: string;
  unit: string;
  default_qty: number;
  category: {
    key: string;
    name_fi: string;
    name_sv: string;
    icon: string | null;
  } | null;
};

export function ItemsView({
  householdName,
  items,
}: {
  householdName: string;
  items: ItemRow[];
}) {
  const { lang, t } = useLang();
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Group by category
  const grouped = new Map<string, { label: string; icon: string; rows: ItemRow[] }>();
  for (const item of items) {
    const key = item.category?.key ?? "other";
    const label =
      lang === "fi"
        ? (item.category?.name_fi ?? "Muut")
        : (item.category?.name_sv ?? "Övrigt");
    const icon = item.category?.icon ?? "📦";
    if (!grouped.has(key)) grouped.set(key, { label, icon, rows: [] });
    grouped.get(key)!.rows.push(item);
  }

  return (
    <div className="flex flex-col flex-1 min-h-dvh bg-zinc-50 dark:bg-zinc-950">
      <main className="flex-1 px-5 py-5 mx-auto w-full max-w-2xl">
        <AppHeader
          title={t("itemsTitle")}
          subtitle={householdName}
          backHref="/list"
        />
        <form
          action={(fd) =>
            startTransition(async () => {
              setError(null);
              setToast(null);
              const res = await addItem(fd);
              if (res.ok) {
                const name = lang === "fi" ? res.canonical_fi : res.canonical_sv;
                setToast(
                  res.wasCreated
                    ? `${t("itemAdded")}: ${name}`
                    : `${t("itemMatched")}: ${name}`,
                );
                if (inputRef.current) inputRef.current.value = "";
              } else {
                setError(
                  res.error === "empty"
                    ? t("errorEmpty")
                    : t("errorGeneric"),
                );
              }
            })
          }
          className="flex flex-col gap-2 mb-6"
        >
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {t("addItemLabel")}
          </label>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              name="text"
              required
              autoComplete="off"
              placeholder={t("addItemPlaceholder")}
              className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base text-zinc-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            />
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {t("add")}
            </button>
          </div>
          <p className="text-xs text-zinc-500 flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-violet-500" />
            {t("addItemHint")}
          </p>
          {toast && (
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              {toast}
            </p>
          )}
          {error && <p className="text-sm text-rose-600">{error}</p>}
        </form>

        {grouped.size === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/50 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/50">
            {t("itemsEmpty")}
          </div>
        ) : (
          <div className="space-y-5">
            {[...grouped.entries()].map(([key, group]) => (
              <section key={key}>
                <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  <span className="text-base">{group.icon}</span>
                  {group.label}
                  <span className="text-zinc-400">· {group.rows.length}</span>
                </h2>
                <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white shadow-sm dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
                  {group.rows.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-3 px-4 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50 truncate">
                          {capitalizeFirst(
                            lang === "fi"
                              ? item.canonical_fi
                              : item.canonical_sv,
                          )}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {lang === "fi" ? item.canonical_sv : item.canonical_fi}
                          {" · "}
                          {formatQty(item.default_qty)} {item.unit}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          startTransition(async () => {
                            await deleteItem(item.id);
                          })
                        }
                        className="rounded-md p-1.5 text-zinc-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function formatQty(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2).replace(/\.?0+$/, "");
}
