"use client";

import Link from "next/link";
import { useLang } from "@/components/lang-provider";
import { LangToggle } from "@/components/lang-toggle";
import { SignOutButton } from "@/components/sign-out-button";
import {
  RunningLowPanel,
  type RunningLowItem,
} from "@/components/running-low-panel";
import {
  ShoppingCart,
  Sparkles,
  Refrigerator,
  Store,
  Users,
  Tags,
} from "lucide-react";

const tiles = [
  {
    key: "myList" as const,
    icon: ShoppingCart,
    color: "text-emerald-600",
    href: "/list",
    enabled: true,
  },
  {
    key: "quickAdd" as const,
    icon: Sparkles,
    color: "text-violet-600",
    href: "/list",
    enabled: true,
  },
  {
    key: "catalog" as const,
    icon: Tags,
    color: "text-indigo-600",
    href: "/items",
    enabled: true,
  },
  {
    key: "pantry" as const,
    icon: Refrigerator,
    color: "text-sky-600",
    href: null,
    enabled: false,
  },
  {
    key: "stores" as const,
    icon: Store,
    color: "text-amber-600",
    href: null,
    enabled: false,
  },
  {
    key: "household" as const,
    icon: Users,
    color: "text-rose-600",
    href: null,
    enabled: false,
  },
];

export function AppShell({
  householdName,
  userEmail,
  runningLow,
}: {
  householdName: string;
  userEmail: string;
  runningLow: RunningLowItem[];
}) {
  const { t } = useLang();
  return (
    <div className="flex flex-col flex-1 min-h-dvh bg-gradient-to-b from-emerald-50 to-white dark:from-zinc-950 dark:to-black">
      <header className="flex items-center justify-between px-5 py-4 border-b border-zinc-200/60 dark:border-zinc-800/60 bg-white/70 dark:bg-zinc-950/70 backdrop-blur">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
            <ShoppingCart className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-semibold leading-none text-zinc-900 dark:text-zinc-50 truncate">
              {householdName}
            </h1>
            <p className="text-[11px] text-zinc-500 mt-0.5 truncate">
              {userEmail}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <LangToggle />
          <SignOutButton />
        </div>
      </header>

      <main className="flex-1 px-5 py-6 mx-auto w-full max-w-2xl">
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
          {t("tagline")}
        </p>

        <RunningLowPanel items={runningLow} />

        <div className="grid grid-cols-2 gap-3">
          {tiles.map(({ key, icon: Icon, color, href, enabled }) => {
            const inner = (
              <div className="group flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 h-full">
                <Icon className={`h-6 w-6 ${color}`} />
                <div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    {t(key)}
                  </p>
                  <p className="text-xs text-zinc-500 mt-1">
                    {enabled ? "" : t("comingSoon")}
                  </p>
                </div>
              </div>
            );
            return href ? (
              <Link key={key} href={href} className="block">
                {inner}
              </Link>
            ) : (
              <div key={key}>{inner}</div>
            );
          })}
        </div>
      </main>

      <footer className="px-5 py-4 text-center text-xs text-zinc-400">
        Ostoslista · v0.1
      </footer>
    </div>
  );
}
