"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Loader2, RefreshCw } from "lucide-react";

const THRESHOLD = 70; // px the user has to pull before release triggers refresh
const MAX_PULL = 120; // max distance the indicator follows the finger

/**
 * Mobile pull-to-refresh. Standalone PWA mode disables the browser's native
 * PTR, so we implement a lightweight touch-only version. Activates only
 * when the page is scrolled to the very top and the user drags downward.
 */
export function PullToRefresh({
  onRefresh,
  children,
}: {
  onRefresh: () => void | Promise<void>;
  children: ReactNode;
}) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const tracking = useRef(false);

  const trigger = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      // Snap back even if onRefresh threw
      setRefreshing(false);
      setPull(0);
    }
  }, [onRefresh, refreshing]);

  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      if (refreshing) return;
      const t = e.touches[0];
      if (!t) return;
      // Only engage when scrolled all the way to the top.
      const scrollEl =
        document.scrollingElement || document.documentElement;
      if (scrollEl.scrollTop > 0) {
        tracking.current = false;
        return;
      }
      tracking.current = true;
      startY.current = t.clientY;
    }

    function onTouchMove(e: TouchEvent) {
      if (!tracking.current || startY.current == null) return;
      const t = e.touches[0];
      if (!t) return;
      const dy = t.clientY - startY.current;
      if (dy <= 0) {
        // Pulling up — let the browser scroll normally.
        setPull(0);
        return;
      }
      // Resistance: distance decays so the indicator never feels jumpy.
      const eased = Math.min(MAX_PULL, dy * 0.5);
      setPull(eased);
      // Prevent the browser from over-scrolling the body while we own the gesture.
      if (e.cancelable) e.preventDefault();
    }

    function onTouchEnd() {
      if (!tracking.current) return;
      tracking.current = false;
      startY.current = null;
      if (pull >= THRESHOLD) {
        void trigger();
      } else {
        setPull(0);
      }
    }

    // passive:false so preventDefault works during the pull
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [pull, refreshing, trigger]);

  const armed = pull >= THRESHOLD;

  return (
    <>
      <div
        className="pointer-events-none fixed left-0 right-0 top-0 z-50 flex justify-center"
        style={{
          transform: `translateY(${pull}px)`,
          opacity: pull > 4 || refreshing ? 1 : 0,
          transition: tracking.current ? "none" : "transform 220ms, opacity 220ms",
        }}
        aria-hidden={!refreshing && pull === 0}
      >
        <div className="mt-2 flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 shadow dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw
              className={`h-4 w-4 transition-transform ${
                armed ? "rotate-180 text-emerald-600" : ""
              }`}
              style={{ transform: armed ? "rotate(180deg)" : `rotate(${pull * 3}deg)` }}
            />
          )}
        </div>
      </div>
      <div
        style={{
          transform: `translateY(${pull * 0.4}px)`,
          transition: tracking.current ? "none" : "transform 220ms",
        }}
      >
        {children}
      </div>
    </>
  );
}
