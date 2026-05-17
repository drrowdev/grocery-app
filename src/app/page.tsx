"use client";

import { useLang } from "@/components/lang-provider";
import { LangToggle } from "@/components/lang-toggle";
import {
  ShoppingCart,
  Sparkles,
  Refrigerator,
  Store,
  Users,
  TrendingDown,
} from "lucide-react";

const tiles = [
  { key: "myList" as const, icon: ShoppingCart, color: "text-emerald-600" },
  { key: "quickAdd" as const, icon: Sparkles, color: "text-violet-600" },
  { key: "pantry" as const, icon: Refrigerator, color: "text-sky-600" },
  { key: "stores" as const, icon: Store, color: "text-amber-600" },
  { key: "household" as const, icon: Users, color: "text-rose-600" },
  { key: "runningLowSoon" as const, icon: TrendingDown, color: "text-orange-600" },
];

export default function Home() {
  const { t } = useLang();
  return (
    <div className="flex flex-col flex-1 min-h-dvh bg-gradient-to-b from-emerald-50 to-white dark:from-zinc-950 dark:to-black">
      <header className="flex items-center justify-between px-5 py-4 border-b border-zinc-200/60 dark:border-zinc-800/60 bg-white/70 dark:bg-zinc-950/70 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
            <ShoppingCart className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold leading-none text-zinc-900 dark:text-zinc-50">
              {t("appName")}
            </h1>
            <p className="text-[11px] text-zinc-500 mt-0.5">MVP scaffold</p>
          </div>
        </div>
        <LangToggle />
      </header>

      <main className="flex-1 px-5 py-6 mx-auto w-full max-w-2xl">
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
          {t("tagline")}
        </p>

        <div className="grid grid-cols-2 gap-3">
          {tiles.map(({ key, icon: Icon, color }) => (
            <div
              key={key}
              className="group flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
            >
              <Icon className={`h-6 w-6 ${color}`} />
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  {t(key)}
                </p>
                <p className="text-xs text-zinc-500 mt-1">{t("comingSoon")}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          {t("notConfigured")}
        </div>
      </main>

      <footer className="px-5 py-4 text-center text-xs text-zinc-400">
        Ostoslista · v0.1
      </footer>
    </div>
  );
}
