"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Loader2, Plus, X } from "lucide-react";
import { useLang } from "@/components/lang-provider";
import { createList, deleteList, renameList } from "@/app/list/actions";

export type ListSummary = {
  id: string;
  name: string;
  itemCount: number;
};

export function ListPicker({
  currentId,
  currentName,
  lists,
}: {
  currentId: string;
  currentName: string;
  lists: ListSummary[];
}) {
  const router = useRouter();
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setCreating(false);
        setRenamingId(null);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setCreating(false);
        setRenamingId(null);
      }
    }
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-block min-w-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-left min-w-0"
      >
        <h1 className="text-2xl font-bold leading-tight text-zinc-900 dark:text-zinc-50 truncate">
          {currentName}
        </h1>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-zinc-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 z-30 min-w-[240px] max-w-[300px] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
          <ul className="max-h-[60vh] overflow-y-auto">
            {lists.map((list) => {
              const isCurrent = list.id === currentId;
              const isRenaming = renamingId === list.id;
              return (
                <li key={list.id} className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-800">
                  {isRenaming ? (
                    <div className="flex items-center gap-1 px-2 py-2">
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
                        className="flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
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
                        className="rounded-md bg-emerald-600 p-1.5 text-white"
                        aria-label={t("save")}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setRenamingId(null)}
                        className="rounded-md p-1.5 text-zinc-500"
                        aria-label={t("cancel")}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center group">
                      <button
                        type="button"
                        onClick={() => {
                          if (!isCurrent) {
                            router.push(`/list?id=${list.id}`);
                          }
                          setOpen(false);
                        }}
                        className={`flex-1 flex items-center gap-2 px-3 py-2.5 text-sm text-left transition ${
                          isCurrent
                            ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"
                            : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        }`}
                      >
                        {isCurrent ? (
                          <Check className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <span className="w-4" />
                        )}
                        <span className="flex-1 truncate">{list.name}</span>
                        <span className="text-xs text-zinc-400">
                          {list.itemCount}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenamingId(list.id);
                          setRenameDraft(list.name);
                        }}
                        className="px-2 py-2 text-xs text-zinc-400 opacity-0 transition group-hover:opacity-100 hover:text-zinc-700 dark:hover:text-zinc-200"
                        aria-label={t("rename")}
                      >
                        ⋯
                      </button>
                      {lists.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!window.confirm(t("deleteListConfirm", { name: list.name }))) return;
                            startTransition(async () => {
                              await deleteList(list.id);
                              if (isCurrent) {
                                const other = lists.find((l) => l.id !== list.id);
                                if (other) router.push(`/list?id=${other.id}`);
                                else router.push("/list");
                              } else {
                                router.refresh();
                              }
                              setOpen(false);
                            });
                          }}
                          className="px-2 py-2 text-zinc-400 opacity-0 transition group-hover:opacity-100 hover:text-rose-600"
                          aria-label={t("remove")}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {creating ? (
            <div className="flex items-center gap-1 px-2 py-2 border-t border-zinc-100 dark:border-zinc-800">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                autoFocus
                placeholder={t("newListPlaceholder")}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (!draft.trim()) return;
                    startTransition(async () => {
                      const res = await createList(draft);
                      if (res.ok) {
                        router.push(`/list?id=${res.id}`);
                        setOpen(false);
                        setCreating(false);
                        setDraft("");
                      }
                    });
                  } else if (e.key === "Escape") {
                    setCreating(false);
                    setDraft("");
                  }
                }}
                className="flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              />
              <button
                type="button"
                disabled={pending || !draft.trim()}
                onClick={() => {
                  if (!draft.trim()) return;
                  startTransition(async () => {
                    const res = await createList(draft);
                    if (res.ok) {
                      router.push(`/list?id=${res.id}`);
                      setOpen(false);
                      setCreating(false);
                      setDraft("");
                    }
                  });
                }}
                className="rounded-md bg-emerald-600 p-1.5 text-white disabled:opacity-60"
                aria-label={t("create")}
              >
                {pending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setDraft("");
                }}
                className="rounded-md p-1.5 text-zinc-500"
                aria-label={t("cancel")}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="flex w-full items-center gap-2 border-t border-zinc-100 bg-zinc-50 px-3 py-2.5 text-sm font-medium text-emerald-700 transition hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-emerald-400 dark:hover:bg-zinc-800"
            >
              <Plus className="h-4 w-4" />
              {t("newList")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
