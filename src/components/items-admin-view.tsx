"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Loader2, Plus, Trash2, X } from "lucide-react";
import type { TKey } from "@/lib/i18n";
import { useLang } from "@/components/lang-provider";
import { AppHeader } from "@/components/app-header";
import { capitalizeFirst } from "@/lib/utils";
import {
  adminAddAlias,
  adminDeleteItem,
  adminRemoveAlias,
  adminUpdateItem,
} from "@/app/items/actions";
import type { AdminCategory, AdminItem } from "@/app/items/page";

export function ItemsAdminView({
  items: initialItems,
  categories,
}: {
  items: AdminItem[];
  categories: AdminCategory[];
}) {
  const { lang, t } = useLang();
  const [items, setItems] = useState(initialItems);
  const [filter, setFilter] = useState<"all" | "uncategorized">(
    "uncategorized",
  );
  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return items.filter((i) => {
      // Always show an item the user is actively editing, regardless of
      // filter — otherwise setting a category makes the row vanish before
      // the user can rename / add aliases.
      const isOpen = expandedIds.has(i.id);
      if (!isOpen) {
        if (filter === "uncategorized" && i.category_key) return false;
      }
      if (needle) {
        const haystack = `${i.canonical_fi} ${i.canonical_sv} ${i.aliases
          .map((a) => a.alias)
          .join(" ")}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [items, filter, search, expandedIds]);

  const uncategorizedCount = items.filter((i) => !i.category_key).length;

  async function handleSetCategory(item: AdminItem, key: string | null) {
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? {
              ...i,
              category_key: key,
              category_name_fi:
                categories.find((c) => c.key === key)?.name_fi ?? null,
              category_name_sv:
                categories.find((c) => c.key === key)?.name_sv ?? null,
            }
          : i,
      ),
    );
    startTransition(async () => {
      await adminUpdateItem(item.id, { category_key: key });
    });
  }

  async function handleRename(
    item: AdminItem,
    canonical_fi: string,
    canonical_sv: string,
  ) {
    const fi = canonical_fi.trim();
    const sv = canonical_sv.trim();
    if (!fi || !sv) return;
    if (fi === item.canonical_fi && sv === item.canonical_sv) return;
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id ? { ...i, canonical_fi: fi, canonical_sv: sv } : i,
      ),
    );
    startTransition(async () => {
      await adminUpdateItem(item.id, {
        canonical_fi: fi,
        canonical_sv: sv,
      });
    });
  }

  async function handleAddAlias(item: AdminItem, alias: string) {
    const cleaned = alias.trim().toLowerCase();
    if (!cleaned) return;
    if (item.aliases.some((a) => a.alias === cleaned)) return;
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? { ...i, aliases: [...i.aliases, { alias: cleaned, lang: "fi" }] }
          : i,
      ),
    );
    startTransition(async () => {
      await adminAddAlias(item.id, cleaned, "fi");
    });
  }

  async function handleRemoveAlias(
    item: AdminItem,
    alias: string,
    aliasLang: "fi" | "sv",
  ) {
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? {
              ...i,
              aliases: i.aliases.filter(
                (a) => !(a.alias === alias && a.lang === aliasLang),
              ),
            }
          : i,
      ),
    );
    startTransition(async () => {
      await adminRemoveAlias(item.id, alias, aliasLang);
    });
  }

  async function handleDelete(item: AdminItem) {
    const name = lang === "fi" ? item.canonical_fi : item.canonical_sv;
    if (!window.confirm(t("deleteItemConfirm", { name }))) return;
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    startTransition(async () => {
      await adminDeleteItem(item.id);
    });
  }

  return (
    <div className="flex flex-col flex-1 min-h-dvh bg-zinc-50 dark:bg-zinc-950">
      <div className="px-4 pt-5 pb-2 mx-auto w-full max-w-5xl">
        <AppHeader
          title={t("itemsAdmin")}
          subtitle={t("itemsAdminSubtitle")}
          backHref="/list"
          isOwner
        />
      </div>

      <main className="flex-1 px-4 pb-10 mx-auto w-full max-w-5xl">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <button
            type="button"
            onClick={() => setFilter("uncategorized")}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
              filter === "uncategorized"
                ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
                : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                uncategorizedCount > 0 ? "bg-amber-500" : "bg-zinc-400"
              }`}
            />
            {t("filterUncategorized")}
            <span className="ml-1 text-xs opacity-70">
              {uncategorizedCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
              filter === "all"
                ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100"
                : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
            }`}
          >
            {t("filterAll")}
            <span className="ml-1 text-xs opacity-70">{items.length}</span>
          </button>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={lang === "fi" ? "Etsi…" : "Sök…"}
            className="ml-auto w-full sm:w-64 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>

        {pending && (
          <div className="mb-3 flex items-center gap-2 text-xs text-zinc-500">
            <Loader2 className="h-3 w-3 animate-spin" />
            {lang === "fi" ? "Tallennetaan…" : "Sparar…"}
          </div>
        )}

        {visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
            {filter === "uncategorized"
              ? lang === "fi"
                ? "Kaikki tuotteet on luokiteltu. 🎉"
                : "Alla varor är kategoriserade. 🎉"
              : lang === "fi"
                ? "Ei tuotteita."
                : "Inga varor."}
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {visible.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                categories={categories}
                lang={lang}
                expanded={expandedIds.has(item.id)}
                onToggleExpand={() => toggleExpanded(item.id)}
                onSetCategory={(k) => handleSetCategory(item, k)}
                onRename={(fi, sv) => handleRename(item, fi, sv)}
                onAddAlias={(a) => handleAddAlias(item, a)}
                onRemoveAlias={(a, l) => handleRemoveAlias(item, a, l)}
                onDelete={() => handleDelete(item)}
                t={t}
              />
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function ItemRow({
  item,
  categories,
  lang,
  expanded,
  onToggleExpand,
  onSetCategory,
  onRename,
  onAddAlias,
  onRemoveAlias,
  onDelete,
  t,
}: {
  item: AdminItem;
  categories: AdminCategory[];
  lang: "fi" | "sv";
  expanded: boolean;
  onToggleExpand: () => void;
  onSetCategory: (key: string | null) => void;
  onRename: (fi: string, sv: string) => void;
  onRemoveAlias: (alias: string, lang: "fi" | "sv") => void;
  onAddAlias: (alias: string) => void;
  onDelete: () => void;
  t: (k: TKey, params?: Record<string, string | number>) => string;
}) {
  const [fi, setFi] = useState(item.canonical_fi);
  const [sv, setSv] = useState(item.canonical_sv);
  const [newAlias, setNewAlias] = useState("");

  const label = lang === "fi" ? item.canonical_fi : item.canonical_sv;
  const categoryName =
    lang === "fi" ? item.category_name_fi : item.category_name_sv;

  return (
    <li className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <button
        type="button"
        onClick={onToggleExpand}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
              {capitalizeFirst(label)}
            </span>
            {!item.category_key && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                {t("uncategorized")}
              </span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-zinc-500">
            {categoryName ? `${categoryName} · ` : ""}
            {item.list_count + item.purchase_count > 0
              ? t("itemUsage", {
                  n: item.list_count,
                  p: item.purchase_count,
                })
              : t("itemNoUsage")}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-800 flex flex-col gap-3">
          {/* Canonical names */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                FI
              </span>
              <input
                value={fi}
                onChange={(e) => setFi(e.target.value)}
                onBlur={() => onRename(fi, sv)}
                className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                SV
              </span>
              <input
                value={sv}
                onChange={(e) => setSv(e.target.value)}
                onBlur={() => onRename(fi, sv)}
                className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
            </label>
          </div>

          {/* Category picker */}
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => onSetCategory(null)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition ${
                item.category_key === null
                  ? "border-amber-400 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
                  : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
              }`}
            >
              {t("uncategorized")}
            </button>
            {categories.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => onSetCategory(c.key)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition ${
                  item.category_key === c.key
                    ? "border-emerald-400 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100"
                    : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                }`}
              >
                <span aria-hidden>{c.icon ?? "📦"}</span>
                {lang === "fi" ? c.name_fi : c.name_sv}
                {item.category_key === c.key && (
                  <Check className="h-3 w-3" />
                )}
              </button>
            ))}
          </div>

          {/* Aliases */}
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
              {t("addAlias")}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {item.aliases.map((a) => (
                <span
                  key={`${a.alias}-${a.lang}`}
                  className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                >
                  {a.alias}
                  <button
                    type="button"
                    onClick={() => onRemoveAlias(a.alias, a.lang)}
                    className="ml-0.5 text-zinc-400 hover:text-rose-600"
                    aria-label="Remove alias"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newAlias.trim()) return;
                  onAddAlias(newAlias);
                  setNewAlias("");
                }}
                className="flex items-center gap-1"
              >
                <input
                  value={newAlias}
                  onChange={(e) => setNewAlias(e.target.value)}
                  placeholder={t("aliasPlaceholder")}
                  className="w-40 rounded-full border border-zinc-200 bg-white px-2.5 py-0.5 text-xs outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-950"
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white p-1 text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900"
                  aria-label={t("add")}
                >
                  <Plus className="h-3 w-3" />
                </button>
              </form>
            </div>
            <p className="mt-1.5 text-[10px] text-zinc-500">
              {t("aliasHint")}
            </p>
          </div>

          {/* Delete */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-white px-3 py-1 text-xs text-rose-700 hover:bg-rose-50 dark:border-rose-900/50 dark:bg-zinc-900 dark:text-rose-300 dark:hover:bg-rose-950/30"
            >
              <Trash2 className="h-3 w-3" />
              {t("deleteItem")}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
