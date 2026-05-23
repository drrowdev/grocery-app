"use client";

import { useEffect, useRef, useState } from "react";
import { unitLabel, type Lang } from "@/lib/i18n";

const UNITS = ["kpl", "kg", "g", "l", "dl", "ml", "pkt"] as const;
export type UnitKey = (typeof UNITS)[number];

function formatQty(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return Number(n).toFixed(2).replace(/\.?0+$/, "");
}

/**
 * Compact editable qty + unit cell. Click the qty to type a new number;
 * click the unit to open a small popover with the seven supported units.
 * Both call `onChange` independently so callers can persist whatever
 * subset changed.
 */
export function QtyUnitEditor({
  qty,
  unit,
  lang,
  onChange,
  align = "right",
}: {
  qty: number;
  unit: string;
  lang: Lang;
  onChange: (patch: { qty?: number; unit?: string }) => void;
  align?: "left" | "right";
}) {
  const [editingQty, setEditingQty] = useState(false);
  const [draftQty, setDraftQty] = useState(formatQty(qty));
  const [unitOpen, setUnitOpen] = useState(false);
  const unitBtnRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraftQty(formatQty(qty));
  }, [qty]);

  useEffect(() => {
    if (!unitOpen) return;
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (
        popoverRef.current?.contains(t) ||
        unitBtnRef.current?.contains(t)
      ) {
        return;
      }
      setUnitOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setUnitOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [unitOpen]);

  function commitQty() {
    setEditingQty(false);
    const parsed = Number(draftQty.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setDraftQty(formatQty(qty));
      return;
    }
    if (parsed === qty) return;
    onChange({ qty: parsed });
  }

  return (
    <div
      className={`flex items-center gap-1 shrink-0 ${
        align === "left" ? "justify-start" : "justify-end"
      }`}
    >
      {editingQty ? (
        <input
          type="text"
          inputMode="decimal"
          value={draftQty}
          onChange={(e) => setDraftQty(e.target.value)}
          onBlur={commitQty}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            else if (e.key === "Escape") {
              setDraftQty(formatQty(qty));
              setEditingQty(false);
            }
          }}
          autoFocus
          onFocus={(e) => e.currentTarget.select()}
          className="w-14 rounded-md border border-emerald-400 bg-white px-1 py-0.5 text-right text-sm tabular-nums text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-500/30 dark:bg-zinc-950 dark:text-zinc-50"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setDraftQty(formatQty(qty));
            setEditingQty(true);
          }}
          className="min-w-[2.5rem] rounded-md px-2 py-1 text-right text-sm tabular-nums text-zinc-700 transition hover:bg-zinc-100 active:scale-95 dark:text-zinc-200 dark:hover:bg-zinc-800"
          aria-label="Edit quantity"
        >
          {formatQty(qty)}
        </button>
      )}
      <div className="relative">
        <button
          ref={unitBtnRef}
          type="button"
          onClick={() => setUnitOpen((v) => !v)}
          className="rounded-md px-1.5 py-1 text-xs text-zinc-500 transition hover:bg-zinc-100 active:scale-95 dark:hover:bg-zinc-800"
          aria-label="Change unit"
        >
          {unitLabel(unit, lang)}
        </button>
        {unitOpen && (
          <div
            ref={popoverRef}
            className="absolute right-0 top-full mt-1 z-30 w-44 grid grid-cols-3 gap-1 rounded-lg border border-zinc-200 bg-white p-1.5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
          >
            {UNITS.map((u) => {
              const active = u === unit;
              return (
                <button
                  key={u}
                  type="button"
                  onClick={() => {
                    setUnitOpen(false);
                    if (u !== unit) onChange({ unit: u });
                  }}
                  className={`rounded-md px-2 py-1.5 text-xs text-center transition ${
                    active
                      ? "bg-emerald-600 text-white"
                      : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  }`}
                >
                  {unitLabel(u, lang)}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
