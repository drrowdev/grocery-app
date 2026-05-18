"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, X } from "lucide-react";
import { useLang } from "@/components/lang-provider";
import { createList, deleteList, renameList } from "@/app/list/actions";
import type { ListSummary } from "@/app/list/page";

export function ListRail({
  currentId,
  lists,
}: {
  currentId: string;
  lists: ListSummary[];
}) {
  const router = useRouter();
  const { t } = useLang();
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftType, setDraftType] = useState<"grocery" | "general">("grocery");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [pending, startTransition] = useTransition();

  // Prefetch every list so taps switch instantly
  useEffect(() => {
    for (const list of lists) {
      if (list.id !== currentId) router.prefetch(`/list?id=${list.id}`);
    }
  }, [lists, currentId, router]);

  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setCreating(false);
        setRenamingId(null);
      }
    }
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, []);

  return (
    <aside className="hidden md:flex flex-col w-52 shrink-0 self-start rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
        {t("listsLabel")}
      </p>
      <ul className="flex flex-col gap-0.5">
        {lists.map((list) => {
          const isCurrent = list.id === currentId;
          const isRenaming = renamingId === list.id;

          if (isRenaming) {
            return (
              <li key={list.id} className="flex items-center gap-1 px-1 py-1">
                <input
                  value={renameDraft}
                  onChange={(e) => setRenameDraft(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      startTransition(async () => {
                        await renameList(list.id, renameDraft);
                        setRenamingId(null);
                        router.refresh();
                      });
                    } else if (e.key === "Escape") {
                      setRenamingId(null);
                    }
                  }}
                  className="flex-1 min-w-0 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                />
                <button
                  type="button"
                  onClick={() =>
                    startTransition(async () => {
                      await renameList(list.id, renameDraft);
                      setRenamingId(null);
                      router.refresh();
                    })
                  }
                  className="rounded-md bg-emerald-600 p-1 text-white"
                  aria-label={t("save")}
                >
                  <Check className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setRenamingId(null)}
                  className="rounded-md p-1 text-zinc-500"
                  aria-label={t("cancel")}
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            );
          }

          return (
            <li key={list.id} className="group relative">
              <Link
                href={`/list?id=${list.id}`}
                prefetch
                onDoubleClick={(e) => {
                  e.preventDefault();
                  setRenameDraft(list.name);
                  setRenamingId(list.id);
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition ${
                  isCurrent
                    ? "bg-emerald-50 text-emerald-900 font-semibold dark:bg-emerald-950/40 dark:text-emerald-200"
                    : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                }`}
                title={list.name}
              >
                <span
                  className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                    isCurrent ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700"
                  }`}
                />
                <span className="flex-1 truncate">{list.name}</span>
                {list.itemCount > 0 && (
                  <span
                    className={`text-xs tabular-nums ${
                      isCurrent ? "text-emerald-700 dark:text-emerald-300" : "text-zinc-400"
                    }`}
                  >
                    {list.itemCount}
                  </span>
                )}
              </Link>

              {/* Hover-revealed actions */}
              <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden gap-0.5 group-hover:flex">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRenameDraft(list.name);
                    setRenamingId(list.id);
                  }}
                  className="rounded p-1 text-[10px] text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                  aria-label={t("rename")}
                  title={t("rename")}
                >
                  ⋯
                </button>
                {lists.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (
                        !window.confirm(
                          t("deleteListConfirm", { name: list.name }),
                        )
                      )
                        return;
                      startTransition(async () => {
                        await deleteList(list.id);
                        if (isCurrent) {
                          const other = lists.find((l) => l.id !== list.id);
                          if (other) router.push(`/list?id=${other.id}`);
                          else router.push("/list");
                        } else {
                          router.refresh();
                        }
                      });
                    }}
                    className="rounded p-1 text-zinc-400 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-950/40"
                    aria-label={t("remove")}
                    title={t("remove")}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-1 border-t border-zinc-100 pt-1 dark:border-zinc-800">
        {creating ? (
          <div className="flex flex-col gap-1 px-1 py-1">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
              placeholder={t("newListPlaceholder")}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (!draft.trim()) return;
                  startTransition(async () => {
                    const res = await createList(draft, draftType);
                    if (res.ok) {
                      router.push(`/list?id=${res.id}`);
                      setCreating(false);
                      setDraft("");
                      setDraftType("grocery");
                    }
                  });
                } else if (e.key === "Escape") {
                  setCreating(false);
                  setDraft("");
                  setDraftType("grocery");
                }
              }}
              className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            />
            <div className="flex items-center gap-1 text-[11px]">
              <button
                type="button"
                onClick={() => setDraftType("grocery")}
                className={`flex-1 rounded px-2 py-1 transition ${
                  draftType === "grocery"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                🛒 {t("listTypeGrocery")}
              </button>
              <button
                type="button"
                onClick={() => setDraftType("general")}
                className={`flex-1 rounded px-2 py-1 transition ${
                  draftType === "general"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                📋 {t("listTypeGeneral")}
              </button>
            </div>
            <div className="flex items-center justify-end gap-1">
              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setDraft("");
                  setDraftType("grocery");
                }}
                className="rounded-md px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                disabled={pending || !draft.trim()}
                onClick={() => {
                  if (!draft.trim()) return;
                  startTransition(async () => {
                    const res = await createList(draft, draftType);
                    if (res.ok) {
                      router.push(`/list?id=${res.id}`);
                      setCreating(false);
                      setDraft("");
                      setDraftType("grocery");
                    }
                  });
                }}
                className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-60"
              >
                {pending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
                {t("create")}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
          >
            <Plus className="h-4 w-4" />
            {t("newList")}
          </button>
        )}
      </div>
    </aside>
  );
}
