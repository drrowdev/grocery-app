"use client";

import { useEffect } from "react";

/**
 * Registers the runtime-caching service worker (public/sw.js). Production
 * only — in development the SW would cache dev assets and cause confusing
 * stale loads. Registration is a progressive enhancement, so failures are
 * swallowed silently.
 */
export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* ignore — the app works without the SW */
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
