"use client";

import { useState, useTransition } from "react";
import { signInWithMagicLink } from "@/app/auth/actions";
import { useLang } from "@/components/lang-provider";
import { LangToggle } from "@/components/lang-toggle";
import { ShoppingCart, Loader2, Mail } from "lucide-react";

type State =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; kind: "generic" | "invalid_email" };

export function LoginForm() {
  const { t } = useLang();
  const [state, setState] = useState<State>({ status: "idle" });
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col flex-1 min-h-dvh bg-gradient-to-b from-emerald-50 to-white dark:from-zinc-950 dark:to-black">
      <header className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
            <ShoppingCart className="h-5 w-5" />
          </div>
          <h1 className="text-base font-semibold leading-none text-zinc-900 dark:text-zinc-50">
            {t("appName")}
          </h1>
        </div>
        <LangToggle />
      </header>

      <main className="flex-1 flex items-center justify-center px-5 py-8">
        <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            {t("signInTitle")}
          </h2>
          <p className="mt-1 text-sm text-zinc-500">{t("signInSubtitle")}</p>

          {state.status === "sent" ? (
            <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
              <div className="flex items-start gap-2">
                <Mail className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">{state.email}</p>
                  <p className="mt-1">{t("magicLinkSent")}</p>
                </div>
              </div>
            </div>
          ) : (
            <form
              action={(fd) =>
                startTransition(async () => {
                  const res = await signInWithMagicLink(fd);
                  if ("ok" in res) {
                    setState({
                      status: "sent",
                      email: String(fd.get("email")),
                    });
                  } else {
                    setState({ status: "error", kind: res.error });
                  }
                })
              }
              className="mt-6 flex flex-col gap-3"
            >
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {t("emailLabel")}
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  inputMode="email"
                  placeholder={t("emailPlaceholder")}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                />
              </label>

              {state.status === "error" && (
                <p className="text-sm text-rose-600">
                  {t(state.kind === "invalid_email" ? "errorInvalidEmail" : "errorGeneric")}
                </p>
              )}

              <button
                type="submit"
                disabled={pending}
                className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("sendMagicLink")}
              </button>
            </form>
          )}
        </div>
      </main>

      <footer className="px-5 py-4 text-center text-xs text-zinc-400">
        Ostoslista · v0.1
      </footer>
    </div>
  );
}
