"use client";

import { useLang } from "@/components/lang-provider";
import { LangToggle } from "@/components/lang-toggle";
import { SignOutButton } from "@/components/sign-out-button";
import { CreateHousehold } from "@/components/create-household";
import { ShoppingCart } from "lucide-react";

export function OnboardingShell({ userEmail }: { userEmail: string }) {
  const { t } = useLang();
  return (
    <div className="flex flex-col flex-1 min-h-dvh bg-gradient-to-b from-emerald-50 to-white dark:from-zinc-950 dark:to-black">
      <header className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
            <ShoppingCart className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-semibold leading-none text-zinc-900 dark:text-zinc-50">
              {t("appName")}
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

      <main className="flex-1 flex items-center justify-center px-5 py-8">
        <CreateHousehold />
      </main>

      <footer className="px-5 py-4 text-center text-xs text-zinc-400">
        Ostoslista · v0.1
      </footer>
    </div>
  );
}
