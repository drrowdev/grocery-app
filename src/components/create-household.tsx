"use client";

import { useState, useTransition } from "react";
import { useLang } from "@/components/lang-provider";
import { createHousehold } from "@/app/households/actions";
import { Loader2, Users } from "lucide-react";

export function CreateHousehold() {
  const { t } = useLang();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {t("createHouseholdTitle")}
          </h2>
          <p className="text-sm text-zinc-500">{t("createHouseholdSubtitle")}</p>
        </div>
      </div>

      <form
        action={(fd) =>
          startTransition(async () => {
            setError(null);
            const res = await createHousehold(fd);
            if (res && "error" in res) {
              setError(`${t("errorGeneric")} (${res.message ?? res.error})`);
            }
          })
        }
        className="mt-5 flex flex-col gap-3"
      >
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {t("householdNameLabel")}
          <input
            name="name"
            required
            maxLength={60}
            placeholder={t("householdNamePlaceholder")}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          />
        </label>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {t("create")}
        </button>
      </form>
    </div>
  );
}
