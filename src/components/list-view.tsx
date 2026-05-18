"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { Loader2, Minus, Plus, ShoppingCart, Trash2, X } from "lucide-react";
import { useLang } from "@/components/lang-provider";
import { AppHeader } from "@/components/app-header";
import { VoiceButton } from "@/components/voice-button";
import { createClient } from "@/lib/supabase/client";
import { capitalizeFirst } from "@/lib/utils";
import { categoryDot } from "@/lib/category-colors";
import { getItemEmoji } from "@/lib/item-emoji";
import {
  editListItem,
  quickAdd,
  removeCheckedItems,
  removeListItem,
  toggleListItem,
  updateListItem,
} from "@/app/list/actions";
import type { ListItemRow, ListSummary, QuickSuggestion } from "@/app/list/page";
import { ListPicker } from "@/components/list-picker";
import { ListRail } from "@/components/list-rail";
import {
  AiSuggestionCard,
  type AiSuggestion,
} from "@/components/ai-suggestion-card";

const LIST_ITEM_SELECT =
  "id, qty, unit, checked, note, item:items(id, canonical_fi, canonical_sv, category:categories(key, name_fi, name_sv, icon, sort_order))";

let tempCounter = 0;
function nextTempId(): string {
  tempCounter = (tempCounter + 1) % 1_000_000;
  return `temp-${tempCounter}`;
}

function formatQty(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return Number(n).toFixed(2).replace(/\.?0+$/, "");
}

export function ListView({
  isOwner,
  lists,
  currentListId,
  currentListName,
  currentListType,
  initialItems,
  initialSuggestions,
  aiSuggestions,
}: {
  isOwner: boolean;
  lists: ListSummary[];
  currentListId: string;
  currentListName: string;
  currentListType: "grocery" | "general";
  initialItems: ListItemRow[];
  initialSuggestions: QuickSuggestion[];
  aiSuggestions: AiSuggestion[];
}) {
  const { lang, t } = useLang();
  const [items, setItems] = useState<ListItemRow[]>(initialItems);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = currentListId;

  const onListIds = useMemo(
    () => new Set(items.map((r) => r.item.id)),
    [items],
  );
  const suggestions = useMemo(
    () => initialSuggestions.filter((s) => !onListIds.has(s.item_id)),
    [initialSuggestions, onListIds],
  );

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("list_items")
      .select(LIST_ITEM_SELECT)
      .eq("list_id", listId)
      .order("added_at");
    if (data) setItems(data as unknown as ListItemRow[]);
  }, [listId]);

  // Realtime sync for multi-device updates
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

  // Group by category (checked items stay in their category)
  const grouped = useMemo(() => {
    const map = new Map<
      string,
      {
        label: string;
        dotClass: string;
        sort: number;
        emoji: string;
        rows: ListItemRow[];
      }
    >();
    for (const item of items) {
      const key = item.item.category?.key ?? "other";
      const label =
        lang === "fi"
          ? (item.item.category?.name_fi ?? "Muut")
          : (item.item.category?.name_sv ?? "Övrigt");
      const dotClass = categoryDot(item.item.category?.key);
      const emoji = item.item.category?.icon ?? "📦";
      const sort = item.item.category?.sort_order ?? 999;
      if (!map.has(key)) map.set(key, { label, dotClass, sort, emoji, rows: [] });
      map.get(key)!.rows.push(item);
    }
    return [...map.entries()].sort((a, b) => a[1].sort - b[1].sort);
  }, [items, lang]);

  const checkedCount = items.filter((r) => r.checked).length;
  const totalCount = items.length;
  const progress = totalCount === 0 ? 0 : (checkedCount / totalCount) * 100;

  const filteredGroups = useMemo(() => {
    if (filter === "all") return grouped;
    return grouped.filter(([key]) => key === filter);
  }, [grouped, filter]);

  async function submitQuickAdd(text: string) {
    const fd = new FormData();
    fd.set("text", text);
    setError(null);
    const res = await quickAdd(fd);
    if (res.ok) {
      if (inputRef.current) inputRef.current.value = "";
      await refresh();
    } else {
      setError(`${t("errorGeneric")}${res.message ? ` (${res.message})` : ""}`);
    }
  }

  async function handleToggle(rowId: string, nextChecked: boolean) {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(nextChecked ? 20 : 10);
      } catch {
        // ignore
      }
    }
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
    setItems((prev) => prev.filter((r) => r.id !== rowId));
    try {
      await removeListItem(rowId);
    } catch {
      await refresh();
    }
  }

  async function handleQtyDelta(row: ListItemRow, delta: number) {
    const newQty = Math.max(1, Number(row.qty) + delta);
    if (newQty === Number(row.qty)) return;
    setItems((prev) =>
      prev.map((r) => (r.id === row.id ? { ...r, qty: newQty } : r)),
    );
    try {
      await updateListItem(row.id, { qty: newQty });
    } catch {
      await refresh();
    }
  }

  async function handleRenameSave(row: ListItemRow, newName: string) {
    if (!newName.trim() || newName.trim() === (lang === "fi" ? row.item.canonical_fi : row.item.canonical_sv)) {
      return;
    }
    const res = await editListItem(row.id, {
      name: newName.trim(),
      qty: Number(row.qty),
      unit: row.unit,
    });
    if (!res.ok) {
      setError(`${t("errorGeneric")}${res.message ? ` (${res.message})` : ""}`);
    }
    await refresh();
  }

  /**
   * Instant chip-tap path: optimistic insert + direct browser write.
   */
  function addByItemFast(s: QuickSuggestion) {
    if (items.some((r) => r.item.id === s.item_id)) return;
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(10);
      } catch {
        // ignore
      }
    }
    const tempId = nextTempId();
    const optimisticRow: ListItemRow = {
      id: tempId,
      qty: s.default_qty,
      unit: s.unit,
      checked: false,
      note: null,
      item: {
        id: s.item_id,
        canonical_fi: s.canonical_fi,
        canonical_sv: s.canonical_sv,
        category: s.category,
      },
    };
    setItems((prev) => [...prev, optimisticRow]);

    void (async () => {
      const supabase = createClient();
      const { error: insertErr } = await supabase.from("list_items").insert({
        list_id: listId,
        item_id: s.item_id,
        qty: s.default_qty,
        unit: s.unit,
      });
      if (insertErr) {
        setItems((prev) => prev.filter((r) => r.id !== tempId));
        setError(`${t("errorGeneric")} (${insertErr.message})`);
        return;
      }
      await refresh();
    })();
  }

  return (
    <div className="flex flex-col flex-1 min-h-dvh bg-zinc-50 dark:bg-zinc-950">
      <div className="px-4 pt-5 pb-2 mx-auto w-full max-w-5xl">
        <AppHeader
          title={
            <span className="md:hidden">
              <ListPicker
                currentId={currentListId}
                currentName={currentListName}
                lists={lists}
              />
            </span>
          }
          isOwner={isOwner}
          rightExtra={
            <span className="text-sm tabular-nums text-zinc-500">
              {checkedCount}/{totalCount}
            </span>
          }
        />
      </div>
      <div className="flex-1 px-4 pb-5 mx-auto w-full max-w-5xl flex gap-4">
        <div className="hidden md:flex flex-col shrink-0 w-52 self-start">
          <ListRail currentId={currentListId} lists={lists} />
          {currentListType === "grocery" && (
            <AiSuggestionCard
              suggestions={aiSuggestions}
              currentListId={currentListId}
            />
          )}
        </div>
        <main className="flex-1 min-w-0">

        {/* Input + Add button */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const text = String(fd.get("text") ?? "").trim();
            if (text) startTransition(() => submitQuickAdd(text));
          }}
          className="flex gap-2 mb-1.5"
        >
          <input
            ref={inputRef}
            name="text"
            required
            autoComplete="off"
            placeholder={t("quickAddPlaceholderShort")}
            className="flex-1 rounded-xl border border-zinc-200 bg-white px-3.5 py-3 text-base text-zinc-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
          />
          <VoiceButton
            onResult={(text) => {
              if (inputRef.current) inputRef.current.value = text;
              startTransition(() => submitQuickAdd(text));
            }}
          />
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 shadow-sm transition hover:bg-zinc-50 active:scale-95 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
            aria-label={t("add")}
          >
            {pending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Plus className="h-5 w-5" />
            )}
          </button>
        </form>

        {/* Progress bar */}
        <div className="h-0.5 mb-4 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {error && (
          <p className="mb-3 text-sm text-rose-600 break-words">{error}</p>
        )}

        {/* Quick-add chips: most-used household items, instant tap */}
        {suggestions.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3 -mx-5 px-5 scrollbar-none">
            {suggestions.map((s) => {
              const label = lang === "fi" ? s.canonical_fi : s.canonical_sv;
              const emoji = getItemEmoji(s.canonical_fi, s.category?.key);
              return (
                <button
                  key={s.item_id}
                  type="button"
                  onClick={() => addByItemFast(s)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 active:scale-95 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/30"
                >
                  <span aria-hidden="true">{emoji}</span>
                  {capitalizeFirst(label)}
                  <Plus className="h-3 w-3 text-zinc-400" />
                </button>
              );
            })}
          </div>
        )}

        {/* Category filter tabs (grocery lists only) */}
        {currentListType === "grocery" && totalCount > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 mb-4 -mx-5 px-5 scrollbar-none">
            <FilterChip
              active={filter === "all"}
              onClick={() => setFilter("all")}
              label={t("all")}
              count={totalCount}
              dotClass=""
            />
            {grouped.map(([key, group]) => (
              <FilterChip
                key={key}
                active={filter === key}
                onClick={() => setFilter(key)}
                label={group.label}
                count={group.rows.length}
                dotClass={group.dotClass}
              />
            ))}
          </div>
        )}

        {/* List */}
        {totalCount === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/50 p-10 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
            <ShoppingCart className="mx-auto h-8 w-8 text-zinc-300 dark:text-zinc-700" />
            <p className="mt-2 text-sm text-zinc-500">{t("listEmpty")}</p>
          </div>
        ) : currentListType === "general" ? (
          <ul className="space-y-1.5">
            {items.map((row) => (
              <ListItemRowComp
                key={row.id}
                row={row}
                lang={lang}
                showEmoji={false}
                onToggle={() => handleToggle(row.id, !row.checked)}
                onRemove={() => handleRemove(row.id)}
                onDelta={(d) => handleQtyDelta(row, d)}
                onRenameSave={(name) => handleRenameSave(row, name)}
              />
            ))}
          </ul>
        ) : (
          <div className="space-y-5">
            {filteredGroups.map(([key, group]) => (
              <section key={key}>
                <h2 className="mb-2 flex items-center gap-2 text-xs font-medium text-zinc-500">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${group.dotClass}`}
                  />
                  {group.label}
                </h2>
                <ul className="space-y-1.5">
                  {group.rows.map((row) => (
                    <ListItemRowComp
                      key={row.id}
                      row={row}
                      lang={lang}
                      showEmoji
                      onToggle={() => handleToggle(row.id, !row.checked)}
                      onRemove={() => handleRemove(row.id)}
                      onDelta={(d) => handleQtyDelta(row, d)}
                      onRenameSave={(name) => handleRenameSave(row, name)}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        {/* Remove checked items */}
        {checkedCount > 0 && (
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={() =>
                startTransition(async () => {
                  setError(null);
                  const res = await removeCheckedItems(listId);
                  if (!res.ok) {
                    setError(
                      `${t("errorGeneric")}${res.message ? ` (${res.message})` : ""}`,
                    );
                  } else {
                    await refresh();
                  }
                })
              }
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 active:scale-95 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              {t("removeChecked", { n: checkedCount })}
            </button>
          </div>
        )}
        </main>
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  count,
  dotClass,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  dotClass: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition active:scale-95 ${
        active
          ? "border-zinc-300 bg-white text-zinc-900 shadow-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
          : "border-zinc-200 bg-transparent text-zinc-600 hover:bg-white dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900"
      }`}
    >
      {dotClass && (
        <span className={`inline-block h-2 w-2 rounded-full ${dotClass}`} />
      )}
      {label}
      <span className="text-zinc-400">{count}</span>
    </button>
  );
}

function ListItemRowComp({
  row,
  lang,
  showEmoji = true,
  onToggle,
  onRemove,
  onDelta,
  onRenameSave,
}: {
  row: ListItemRow;
  lang: "fi" | "sv";
  showEmoji?: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onDelta: (delta: number) => void;
  onRenameSave: (name: string) => void;
}) {
  const name = lang === "fi" ? row.item.canonical_fi : row.item.canonical_sv;
  const emoji = getItemEmoji(row.item.canonical_fi, row.item.category?.key);

  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(name);

  return (
    <li className="flex items-center gap-2 rounded-xl bg-white px-2.5 py-2 shadow-sm dark:bg-zinc-900">
      {/* Checkbox */}
      <button
        type="button"
        onClick={onToggle}
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition ${
          row.checked
            ? "border-emerald-600 bg-emerald-600 text-white"
            : "border-zinc-300 bg-white hover:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-950"
        }`}
        aria-label={row.checked ? "Uncheck" : "Check"}
      >
        {row.checked && <CheckIcon />}
      </button>

      {/* Emoji */}
      {showEmoji && (
        <span className="text-lg shrink-0 select-none" aria-hidden="true">
          {emoji}
        </span>
      )}

      {/* Name (editable inline) */}
      <div className="min-w-0 flex-1">
        {editingName ? (
          <input
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={() => {
              setEditingName(false);
              onRenameSave(draftName);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              } else if (e.key === "Escape") {
                setDraftName(name);
                setEditingName(false);
              }
            }}
            autoFocus
            className="w-full rounded-md bg-zinc-100 px-2 py-0.5 text-sm font-medium text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-500/20 dark:bg-zinc-800 dark:text-zinc-50"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraftName(name);
              setEditingName(true);
            }}
            className={`block w-full text-left text-sm font-medium truncate ${
              row.checked
                ? "text-zinc-400 line-through dark:text-zinc-500"
                : "text-zinc-900 dark:text-zinc-50"
            }`}
          >
            {capitalizeFirst(name)}
          </button>
        )}
        {row.note && !editingName && (
          <p className="text-[11px] text-zinc-500 truncate">{row.note}</p>
        )}
      </div>

      {/* Qty stepper */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => onDelta(-1)}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-600 transition hover:bg-zinc-50 active:scale-95 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
          disabled={Number(row.qty) <= 1}
          aria-label="Decrease"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="min-w-[3rem] text-center text-sm tabular-nums text-zinc-700 dark:text-zinc-200">
          {formatQty(row.qty)} {row.unit}
        </span>
        <button
          type="button"
          onClick={() => onDelta(1)}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-600 transition hover:bg-zinc-50 active:scale-95 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
          aria-label="Increase"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Remove */}
      <button
        type="button"
        onClick={onRemove}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-400 transition hover:bg-rose-50 hover:text-rose-600 active:scale-95 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-rose-950/30"
        aria-label="Remove"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
