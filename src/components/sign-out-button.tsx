"use client";

import { useTransition } from "react";
import { signOut } from "@/app/auth/actions";
import { useLang } from "@/components/lang-provider";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  const { t } = useLang();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      onClick={() => startTransition(() => signOut())}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 shadow-sm transition hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
      title={t("signOut")}
    >
      <LogOut className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{t("signOut")}</span>
    </button>
  );
}
