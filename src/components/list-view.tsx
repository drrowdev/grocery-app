"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  History,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  StickyNote,
  Trash2,
} from "lucide-react";
import { useLang } from "@/components/lang-provider";
import { LangToggle } from "@/components/lang-toggle";
import { SignOutButton } from "@/components/sign-out-button";
import { VoiceButton } from "@/components/voice-button";
import { SwipeableRow, buzz } from "@/components/swipeable-row";
import { createClient } from "@/lib/supabase/client";
import { capitalizeFirst, UNIT_OPTIONS } from "@/lib/utils";
import { getItemEmoji } from "@/lib/item-emoji";
import {
  completeList,
  editListItem,
  quickAdd,
  removeListItem,
  toggleListItem,
} from "@/app/list/actions";
import type { ListItemRow, QuickSuggestion } from "@/app/list/page";

const LIST_ITEM_SELECT =
  "id, qty, unit, checked, note, item:items(id, canonical_fi, canonical_sv, category:categories(key, name_fi, name_sv, icon, sort_order))";

const FALLBACK_SUGGESTIONS = ["maitoa", "ruisleipä", "kahvi", "kananmuna", "banaani"];

export function ListView({
  householdName,
  listId,
  initialItems,
  initialSuggestions,
}: {
  householdName: string;
  listId: string;
  initialItems: ListItemRow[];
  initialSuggestions: QuickSuggestion[];
}) {
  const { lang, t } = useLang();
  const [items, setItems] = useState<ListItemRow[]>(initialItems);
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("list_items")
      .select(LIST_ITEM_SELECT)
      .eq("list_id", listId)
      .order("checked")
      .order("added_at");
    if (data) setItems(data as unknown as ListItemRow[]);
  }, [listId]);

  // Realtime sync for multi-device updates (primary path is local refresh below)
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
        () => {
          void refresh();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [listId, refresh]);

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
        const parts: string[] = [];
        if (total > 0) {
          parts.push(
            total === 1
              ? `${t("itemAdded")}: ${res.added[0] ?? res.merged[0]}`
              : t("itemsAdded", { n: total }),
          );
        }
        if (res.conflicts.length > 0) {
          for (const c of res.conflicts) {
            parts.push(
              t("conflictKept", {
                name: c.name,
                qty: c.existingQty,
                unit: c.existingUnit,
              }),
            );
          }
        }
        setToast(parts.join(" · "));
        if (inputRef.current) inputRef.current.value = "";
        await refresh();
      } else {
        setError(`${t("errorGeneric")}${res.message ? ` (${res.message})` : ""}`);
      }
    });
  }

  const onListIds = useMemo(
    () => new Set(items.map((r) => r.item.id)),
    [items],
  );
  const suggestions = useMemo(() => {
    const filtered = initialSuggestions.filter((s) => !onListIds.has(s.item_id));
    if (filtered.length > 0) return filtered;
    // Fallback for brand-new households: hardcoded starter suggestions.
    return FALLBACK_SUGGESTIONS.map((s) => ({
      item_id: `fallback:${s}`,
      canonical_fi: s,
      canonical_sv: s,
    }));
  }, [initialSuggestions, onListIds]);

  async function handleToggle(rowId: string, nextChecked: boolean) {
    buzz(nextChecked ? 20 : 10);
    setItems((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, checked: nextChecked } : r)),
    );
    try {
      await toggleListItem(rowId, nextChecked);
    } catch {
      await refresh();
    }
  }

  async function handleRemove(rowId: string) {
    buzz(30);
    setItems((prev) => prev.filter((r) => r.id !== rowId));
    try {
      await removeListItem(rowId);
    } catch {
      await refresh();
    }
  }

  async function handleEdit(
    rowId: string,
    name: string,
    qty: number,
    unit: string,
    note: string | null,
  ) {
    const res = await editListItem(rowId, { name, qty, unit, note });
    if (!res.ok) {
      setError(`${t("errorGeneric")}${res.message ? ` (${res.message})` : ""}`);
    }
    await refresh();
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
        <div className="flex items-center justify-between mb-4 -mt-2">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {items.length === 0
              ? t("tagline")
              : `${unchecked.length} ${t("toBuy")} · ${checked.length} ${t("inCartShort")}`}
          </p>
          <Link
            href="/history"
            className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-emerald-700 dark:hover:text-emerald-400"
          >
            <History className="h-3.5 w-3.5" />
            {t("history")}
          </Link>
        </div>

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

        {suggestions.length > 0 && (
          <div className="mb-5 -mt-2">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {t("frequent")}
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => {
                const label =
                  lang === "fi" ? s.canonical_fi : s.canonical_sv;
                return (
                  <button
                    key={s.item_id}
                    type="button"
                    onClick={() => submitQuickAdd(s.canonical_fi)}
                    disabled={pending}
                    className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300"
                  >
                    <Plus className="h-3 w-3" />
                    {capitalizeFirst(label)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/50 p-6 text-center text-sm dark:border-zinc-700 dark:bg-zinc-900/50">
            <p className="text-zinc-500">{t("listEmpty")}</p>
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
                      onToggle={() => handleToggle(row.id, true)}
                      onRemove={() => handleRemove(row.id)}
                      onEdit={(name, qty, unit, note) =>
                        handleEdit(row.id, name, qty, unit, note)
                      }
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
                      onToggle={() => handleToggle(row.id, false)}
                      onRemove={() => handleRemove(row.id)}
                      onEdit={(name, qty, unit, note) =>
                        handleEdit(row.id, name, qty, unit, note)
                      }
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
                      } else {
                        await refresh();
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
  onEdit,
  checkedStyle = false,
}: {
  row: ListItemRow;
  lang: "fi" | "sv";
  onToggle: () => Promise<void> | void;
  onRemove: () => Promise<void> | void;
  onEdit: (
    name: string,
    qty: number,
    unit: string,
    note: string | null,
  ) => Promise<void> | void;
  checkedStyle?: boolean;
}) {
  const { t } = useLang();
  const [draft, setDraft] = useState<
    { name: string; qty: string; unit: string; note: string } | null
  >(null);
  const [busy, setBusy] = useState(false);

  const name =
    lang === "fi" ? row.item.canonical_fi : row.item.canonical_sv;
  const emoji = getItemEmoji(row.item.canonical_fi, row.item.category?.key);

  if (draft) {
    return (
      <li className="flex flex-col gap-2 px-3 py-3 bg-emerald-50/60 dark:bg-emerald-950/20">
        <input
          type="text"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          className="w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          autoFocus
          placeholder={t("addItemPlaceholder")}
        />
        <input
          type="text"
          value={draft.note}
          onChange={(e) => setDraft({ ...draft, note: e.target.value })}
          maxLength={120}
          className="w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          placeholder={t("notePlaceholder")}
        />
        <div className="flex items-center gap-2">
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={draft.qty}
            onChange={(e) => setDraft({ ...draft, qty: e.target.value })}
            className="w-24 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          />
          <select
            value={draft.unit}
            onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
            className="rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          >
            {UNIT_OPTIONS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setDraft(null)}
              disabled={busy}
              className="rounded-md px-2.5 py-1.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {t("cancel")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                const n = parseFloat(draft.qty.replace(",", "."));
                if (!(Number.isFinite(n) && n > 0)) return;
                setBusy(true);
                const noteToSave = draft.note.trim() || null;
                await onEdit(
                  draft.name.trim() || name,
                  n,
                  draft.unit,
                  noteToSave,
                );
                setBusy(false);
                setDraft(null);
              }}
              className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              {t("save")}
            </button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <SwipeableRow
      leftAction={{
        side: "left",
        bg: "bg-rose-600",
        icon: <Trash2 className="h-5 w-5" />,
        label: t("remove"),
        onTrigger: () => void onRemove(),
      }}
      rightAction={{
        side: "right",
        bg: checkedStyle ? "bg-zinc-500" : "bg-emerald-600",
        icon: <Check className="h-5 w-5" />,
        label: checkedStyle ? t("uncheck") : t("check"),
        onTrigger: () => void onToggle(),
      }}
    >
      <li className="flex items-center gap-2 px-3 py-2.5 bg-white dark:bg-zinc-900">
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
        <span className="text-xl shrink-0 select-none" aria-hidden="true">
          {emoji}
        </span>
        <button
          type="button"
          onClick={() =>
            setDraft({
              name,
              qty: String(row.qty),
              unit: row.unit,
              note: row.note ?? "",
            })
          }
          className="min-w-0 flex-1 text-left"
          aria-label={t("edit")}
        >
          <p
            className={`text-sm font-medium truncate ${
              checkedStyle
                ? "text-zinc-400 line-through dark:text-zinc-500"
                : "text-zinc-900 dark:text-zinc-50"
            }`}
          >
            {capitalizeFirst(name)}
          </p>
          {row.note && (
            <p
              className={`mt-0.5 flex items-center gap-1 text-xs truncate ${
                checkedStyle ? "text-zinc-400" : "text-zinc-500 dark:text-zinc-500"
              }`}
            >
              <StickyNote className="h-3 w-3 shrink-0" />
              {row.note}
            </p>
          )}
        </button>
        <button
          type="button"
          onClick={() =>
            setDraft({
              name,
              qty: String(row.qty),
              unit: row.unit,
              note: row.note ?? "",
            })
          }
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums transition ${
            checkedStyle
              ? "bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500"
              : "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-200 dark:hover:bg-emerald-900/60"
          }`}
          aria-label={t("edit")}
        >
          {formatQty(row.qty)} {row.unit}
          <Pencil className="h-3 w-3 opacity-60" />
        </button>
        <button
          type="button"
          onClick={() => void onRemove()}
          className="rounded-md p-1.5 text-zinc-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30"
          aria-label={t("remove")}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </li>
    </SwipeableRow>
  );
}

function formatQty(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return Number(n).toFixed(2).replace(/\.?0+$/, "");
}
