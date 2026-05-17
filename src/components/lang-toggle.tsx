"use client";

import { useLang } from "./lang-provider";
import { cn } from "@/lib/utils";

export function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <div className="inline-flex items-center rounded-full border border-zinc-200 bg-white p-0.5 text-xs font-medium shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <button
        type="button"
        onClick={() => setLang("fi")}
        className={cn(
          "rounded-full px-3 py-1 transition",
          lang === "fi"
            ? "bg-emerald-600 text-white"
            : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
        )}
        aria-pressed={lang === "fi"}
      >
        FI
      </button>
      <button
        type="button"
        onClick={() => setLang("sv")}
        className={cn(
          "rounded-full px-3 py-1 transition",
          lang === "sv"
            ? "bg-emerald-600 text-white"
            : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
        )}
        aria-pressed={lang === "sv"}
      >
        SV
      </button>
    </div>
  );
}
