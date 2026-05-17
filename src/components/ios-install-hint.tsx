"use client";

import { useEffect, useState } from "react";
import { Share2, Plus, X } from "lucide-react";
import { useLang } from "@/components/lang-provider";

const STORAGE_KEY = "ostoslista.install-dismissed";

function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return isIos && isSafari;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    "standalone" in window.navigator &&
      (window.navigator as { standalone?: boolean }).standalone === true
  );
}

export function IosInstallHint() {
  const { t } = useLang();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isIosSafari()) return;
    if (isStandalone()) return;
    if (window.localStorage.getItem(STORAGE_KEY)) return;
    // Slight delay so the banner doesn't fight with first paint
    const id = window.setTimeout(() => setVisible(true), 1500);
    return () => window.clearTimeout(id);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-x-3 bottom-3 z-50 rounded-2xl border border-emerald-200 bg-white p-4 shadow-2xl dark:border-emerald-900/40 dark:bg-zinc-900"
      role="dialog"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
          <Plus className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            {t("installTitle")}
          </p>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            {t("installLine1")}{" "}
            <Share2 className="inline h-3.5 w-3.5 align-text-bottom text-emerald-700" />{" "}
            {t("installLine2")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            window.localStorage.setItem(STORAGE_KEY, "1");
            setVisible(false);
          }}
          className="rounded-md p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
