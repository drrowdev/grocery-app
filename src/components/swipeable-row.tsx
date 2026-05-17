"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

const THRESHOLD = 70;
const MAX_OFFSET = 110;

export type SwipeAction = {
  side: "left" | "right";
  bg: string;
  fg?: string;
  icon: ReactNode;
  label?: string;
  onTrigger: () => void;
};

export function SwipeableRow({
  leftAction,
  rightAction,
  children,
  disabled = false,
  className = "",
}: {
  leftAction?: SwipeAction;
  rightAction?: SwipeAction;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  // Only enable swipe on touch devices; mouse-drag swipe on desktop feels
  // unintuitive and competes with text selection.
  const touchEnabled = useSyncExternalStore(
    () => () => {},
    () =>
      "ontouchstart" in window ||
      (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0),
    () => false,
  );
  const startX = useRef(0);
  const startY = useRef(0);
  const axis = useRef<"x" | "y" | null>(null);
  const fired = useRef(false);

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    // Skip mouse on non-touch devices; desktop uses the explicit buttons.
    if (e.pointerType === "mouse" && !touchEnabled) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    setIsDragging(true);
    fired.current = false;
    startX.current = e.clientX;
    startY.current = e.clientY;
    axis.current = null;
  };

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - startX.current;
      const dy = e.clientY - startY.current;
      if (axis.current === null) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        axis.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      }
      if (axis.current === "y") return;
      e.preventDefault();
      const next =
        dx > 0 ? Math.min(MAX_OFFSET, dx) : Math.max(-MAX_OFFSET, dx);
      setOffset(next);
    },
    [isDragging],
  );

  const handlePointerUp = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    if (axis.current !== "x") {
      setOffset(0);
      return;
    }
    const o = offset;
    setOffset(0);
    if (o >= THRESHOLD && rightAction && !fired.current) {
      fired.current = true;
      rightAction.onTrigger();
    } else if (o <= -THRESHOLD && leftAction && !fired.current) {
      fired.current = true;
      leftAction.onTrigger();
    }
  }, [offset, isDragging, leftAction, rightAction]);

  useEffect(() => {
    if (!isDragging) return;
    window.addEventListener("pointermove", handlePointerMove, {
      passive: false,
    });
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [isDragging, handlePointerMove, handlePointerUp]);

  const transition = isDragging
    ? "none"
    : "transform 200ms, width 150ms, opacity 150ms";

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {rightAction && (
        <div
          className={`absolute inset-y-0 left-0 flex items-center px-4 ${rightAction.bg}`}
          style={{
            width: Math.max(0, offset),
            opacity: offset > 0 ? 1 : 0,
            transition,
          }}
          aria-hidden
        >
          <div
            className={`flex items-center gap-1.5 text-sm font-medium ${
              rightAction.fg ?? "text-white"
            }`}
          >
            {rightAction.icon}
            {offset > THRESHOLD && rightAction.label && (
              <span>{rightAction.label}</span>
            )}
          </div>
        </div>
      )}
      {leftAction && (
        <div
          className={`absolute inset-y-0 right-0 flex items-center justify-end px-4 ${leftAction.bg}`}
          style={{
            width: Math.max(0, -offset),
            opacity: offset < 0 ? 1 : 0,
            transition,
          }}
          aria-hidden
        >
          <div
            className={`flex items-center gap-1.5 text-sm font-medium ${
              leftAction.fg ?? "text-white"
            }`}
          >
            {offset < -THRESHOLD && leftAction.label && (
              <span>{leftAction.label}</span>
            )}
            {leftAction.icon}
          </div>
        </div>
      )}
      <div
        onPointerDown={handlePointerDown}
        style={{
          transform: `translateX(${offset}px)`,
          transition,
          touchAction: "pan-y",
        }}
        className="relative"
      >
        {children}
      </div>
    </div>
  );
}

export function buzz(ms = 15) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(ms);
    } catch {
      // ignore
    }
  }
}
