"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  signInWithMagicLink,
  verifyEmailOtp,
} from "@/app/auth/actions";
import { useLang } from "@/components/lang-provider";
import { LangToggle } from "@/components/lang-toggle";
import { ShoppingCart, Loader2, Mail, ArrowLeft } from "lucide-react";

type Step =
  | { kind: "email" }
  | { kind: "code"; email: string }
  | { kind: "linkOnly"; email: string };

export function LoginForm() {
  const router = useRouter();
  const { t } = useLang();
  const [step, setStep] = useState<Step>({ kind: "email" });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const codeRef = useRef<HTMLInputElement>(null);

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
          {step.kind === "email" && (
            <>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                {t("signInTitle")}
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                {t("signInSubtitleCode")}
              </p>
              <form
                action={(fd) =>
                  startTransition(async () => {
                    setError(null);
                    const email = String(fd.get("email") ?? "").trim();
                    const res = await signInWithMagicLink(fd);
                    if ("ok" in res) {
                      setStep({ kind: "code", email });
                    } else {
                      const msg =
                        res.error === "invalid_email"
                          ? t("errorInvalidEmail")
                          : `${t("errorGeneric")}${"message" in res && res.message ? ` (${res.message})` : ""}`;
                      setError(msg);
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

                {error && <p className="text-sm text-rose-600">{error}</p>}

                <button
                  type="submit"
                  disabled={pending}
                  className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
                >
                  {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t("sendCode")}
                </button>
              </form>
            </>
          )}

          {step.kind === "code" && (
            <>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setStep({ kind: "email" });
                }}
                className="-ml-1 mb-2 inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                <ArrowLeft className="h-3 w-3" />
                {t("changeEmail")}
              </button>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                {t("codeSentTitle")}
              </h2>
              <div className="mt-1 flex items-start gap-2 text-sm text-zinc-500">
                <Mail className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600" />
                <p>
                  {t("codeSentTo")} <span className="font-medium text-zinc-800 dark:text-zinc-200">{step.email}</span>.
                  <br />
                  {t("codeSentHint")}
                </p>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const code = String(fd.get("code") ?? "");
                  startTransition(async () => {
                    setError(null);
                    const res = await verifyEmailOtp(step.email, code);
                    if (res.ok) {
                      router.replace("/");
                      router.refresh();
                    } else {
                      setError(
                        res.error === "invalid_code"
                          ? t("invalidCode")
                          : t("errorGeneric"),
                      );
                    }
                  });
                }}
                className="mt-5 flex flex-col gap-3"
              >
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {t("codeLabel")}
                  <input
                    ref={codeRef}
                    name="code"
                    type="text"
                    required
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="123456"
                    autoFocus
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-center text-2xl font-semibold tracking-[0.5em] text-zinc-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                  />
                </label>

                {error && <p className="text-sm text-rose-600">{error}</p>}

                <button
                  type="submit"
                  disabled={pending}
                  className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
                >
                  {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t("verify")}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const fd = new FormData();
                    fd.set("email", step.email);
                    startTransition(async () => {
                      setError(null);
                      await signInWithMagicLink(fd);
                      setError(t("codeResent"));
                    });
                  }}
                  disabled={pending}
                  className="text-xs text-zinc-500 hover:text-emerald-700 dark:hover:text-emerald-400 disabled:opacity-60"
                >
                  {t("resendCode")}
                </button>
              </form>
            </>
          )}
        </div>
      </main>

      <footer className="px-5 py-4 text-center text-xs text-zinc-400">
        Ostoslista · v0.1
      </footer>
    </div>
  );
}
