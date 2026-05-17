"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useLang } from "@/components/lang-provider";
import { LangToggle } from "@/components/lang-toggle";
import { SignOutButton } from "@/components/sign-out-button";
import { VoiceButton } from "@/components/voice-button";
import { createClient } from "@/lib/supabase/client";
import {
  completeList,
  quickAdd,
  removeListItem,
  toggleListItem,
} from "@/app/list/actions";
import type { ListItemRow } from "@/app/list/page";

export function ListView({
  householdName,
  listId,
  initialItems,
}: {
  householdName: string;
  listId: string;
  initialItems: ListItemRow[];
}) {
  const { lang, t } = useLang();
  const [items, setItems] = useState<ListItemRow[]>(initialItems);
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Realtime sync — listen to list_items changes for this list
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`list:${listId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "list_items",
          filter: `list_id=eq.${listId}`,
        },
        async (payload) => {
          if (payload.eventType === "DELETE") {
            setItems((prev) =>
              prev.filter((r) => r.id !== (payload.old as { id: string }).id),
            );
            return;
          }
          // INSERT or UPDATE → refetch the affected row with joined item+category
          const id = (payload.new as { id: string }).id;
          const { data: fresh } = await supabase
            .from("list_items")
            .select(
              "id, qty, unit, checked, item:items(id, canonical_fi, canonical_sv, category:categories(key, name_fi, name_sv, icon, sort_order))",
            )
            .eq("id", id)
            .single();
          if (!fresh) return;
          setItems((prev) => {
            const row = fresh as unknown as ListItemRow;
            const idx = prev.findIndex((r) => r.id === row.id);
            if (idx === -1) return [...prev, row];
            const copy = [...prev];
            copy[idx] = row;
            return copy;
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [listId]);

  // Group by category, with unchecked first
  const { unchecked, checked } = useMemo(() => {
    const u: ListItemRow[] = [];
    const c: ListItemRow[] = [];
    for (const r of items) (r.checked ? c : u).push(r);
    return { unchecked: u, checked: c };
  }, [items]);

  const grouped = useMemo(() => {
    const map = new Map<
      string,
      { label: string; icon: string; sort: number; rows: ListItemRow[] }
    >();
    for (const item of unchecked) {
      const key = item.item.category?.key ?? "other";
      const label =
        lang === "fi"
          ? (item.item.category?.name_fi ?? "Muut")
          : (item.item.category?.name_sv ?? "Övrigt");
      const icon = item.item.category?.icon ?? "📦";
      const sort = item.item.category?.sort_order ?? 999;
      if (!map.has(key)) map.set(key, { label, icon, sort, rows: [] });
      map.get(key)!.rows.push(item);
    }
    return [...map.entries()].sort((a, b) => a[1].sort - b[1].sort);
  }, [unchecked, lang]);

  async function submitQuickAdd(text: string) {
    const fd = new FormData();
    fd.set("text", text);
    startTransition(async () => {
      setError(null);
      setToast(null);
      const res = await quickAdd(fd);
      if (res.ok) {
        const total = res.added.length + res.merged.length;
        setToast(
          total === 1
            ? `${t("itemAdded")}: ${res.added[0] ?? res.merged[0]}`
            : `${t("itemsAdded", { n: total })}`,
        );
        if (inputRef.current) inputRef.current.value = "";
      } else {
        setError(`${t("errorGeneric")}${res.message ? ` (${res.message})` : ""}`);
      }
    });
  }

  return (
    <div className="flex flex-col flex-1 min-h-dvh bg-gradient-to-b from-emerald-50 to-white dark:from-zinc-950 dark:to-black">
      <header className="flex items-center justify-between px-5 py-4 border-b border-zinc-200/60 dark:border-zinc-800/60 bg-white/70 dark:bg-zinc-950/70 backdrop-blur">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-base font-semibold leading-none text-zinc-900 dark:text-zinc-50 truncate">
              {t("myList")}
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
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const text = String(fd.get("text") ?? "");
            if (text.trim()) submitQuickAdd(text);
          }}
          className="flex flex-col gap-2 mb-5"
        >
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {t("quickAddLabel")}
          </label>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              name="text"
              required
              autoComplete="off"
              placeholder={t("quickAddPlaceholder")}
              className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base text-zinc-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            />
            <VoiceButton
              onResult={(text) => {
                if (inputRef.current) inputRef.current.value = text;
                submitQuickAdd(text);
              }}
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
            {t("quickAddHint")}
          </p>
          {toast && (
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              {toast}
            </p>
          )}
          {error && <p className="text-sm text-rose-600 break-words">{error}</p>}
        </form>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/50 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/50">
            {t("listEmpty")}
          </div>
        ) : (
          <div className="space-y-5">
            {grouped.map(([key, group]) => (
              <section key={key}>
                <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  <span className="text-base">{group.icon}</span>
                  {group.label}
                  <span className="text-zinc-400">· {group.rows.length}</span>
                </h2>
                <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white shadow-sm dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
                  {group.rows.map((row) => (
                    <ListRow
                      key={row.id}
                      row={row}
                      lang={lang}
                      onToggle={() => toggleListItem(row.id, true)}
                      onRemove={() => removeListItem(row.id)}
                    />
                  ))}
                </ul>
              </section>
            ))}

            {checked.length > 0 && (
              <section>
                <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {t("inCart", { n: checked.length })}
                </h2>
                <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white/60 shadow-sm dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900/60">
                  {checked.map((row) => (
                    <ListRow
                      key={row.id}
                      row={row}
                      lang={lang}
                      checkedStyle
                      onToggle={() => toggleListItem(row.id, false)}
                      onRemove={() => removeListItem(row.id)}
                    />
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() =>
                    startTransition(async () => {
                      setError(null);
                      const res = await completeList(listId);
                      if (!res.ok) {
                        setError(
                          `${t("errorGeneric")}${"message" in res && res.message ? ` (${res.message})` : ""}`,
                        );
                      }
                    })
                  }
                  disabled={pending}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
                >
                  {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  {t("completeShopping", { n: checked.length })}
                </button>
              </section>
            )}
          </div>
        )}
      </main>

      <footer className="px-5 py-4 text-center text-xs text-zinc-400">
        Ostoslista · v0.1
      </footer>
    </div>
  );
}

function ListRow({
  row,
  lang,
  onToggle,
  onRemove,
  checkedStyle = false,
}: {
  row: ListItemRow;
  lang: "fi" | "sv";
  onToggle: () => Promise<void> | void;
  onRemove: () => Promise<void> | void;
  checkedStyle?: boolean;
}) {
  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <button
        type="button"
        onClick={() => void onToggle()}
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition ${
          checkedStyle
            ? "border-emerald-600 bg-emerald-600 text-white"
            : "border-zinc-300 bg-white hover:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-950"
        }`}
        aria-label={checkedStyle ? "Uncheck" : "Check"}
      >
        {checkedStyle && <Check className="h-4 w-4" />}
      </button>
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-medium ${
            checkedStyle
              ? "text-zinc-400 line-through dark:text-zinc-500"
              : "text-zinc-900 dark:text-zinc-50"
          }`}
        >
          {lang === "fi" ? row.item.canonical_fi : row.item.canonical_sv}
        </p>
        <p className="text-xs text-zinc-500">
          {formatQty(row.qty)} {row.unit}
        </p>
      </div>
      <button
        type="button"
        onClick={() => void onRemove()}
        className="rounded-md p-1.5 text-zinc-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30"
        aria-label="Delete"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}

function formatQty(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return Number(n).toFixed(2).replace(/\.?0+$/, "");
}
