"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, History, LogOut, Tag, Users } from "lucide-react";
import { useLang } from "@/components/lang-provider";
import { LangToggle } from "@/components/lang-toggle";
import { ActionMenu } from "@/components/action-menu";
import { signOut } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/client";

/**
 * Shared header used on /list, /household, /history, /items. Keeps title +
 * subtitle on the left; right side has a stable [LangToggle] [⋯] cluster.
 * Pages render any page-specific control (e.g. progress counter) in
 * `rightExtra` between the title block and the controls.
 */
export function AppHeader({
  title,
  subtitle,
  backHref,
  rightExtra,
  isOwner = false,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  backHref?: string;
  rightExtra?: ReactNode;
  isOwner?: boolean;
}) {
  const router = useRouter();
  const { t } = useLang();
  const [uncategorizedCount, setUncategorizedCount] = useState<number>(0);

  // Prefetch sibling routes so navigation feels instant
  useEffect(() => {
    router.prefetch("/list");
    if (isOwner) {
      router.prefetch("/household");
      router.prefetch("/items");
    }
    router.prefetch("/history");
  }, [router, isOwner]);

  // Owners see a live count of uncategorised items in the ⋯ menu so they
  // know when items need cleaning up.
  useEffect(() => {
    if (!isOwner) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { count } = await supabase
        .from("items")
        .select("id", { count: "exact", head: true })
        .is("category_id", null);
      if (!cancelled && typeof count === "number") {
        setUncategorizedCount(count);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOwner]);

  const menuItems: import("@/components/action-menu").MenuItem[] = [
    {
      label: t("myList"),
      icon: <span className="text-base">🛒</span>,
      onClick: () => router.push("/list"),
    },
    {
      label: t("history"),
      icon: <History className="h-4 w-4" />,
      onClick: () => router.push("/history"),
    },
  ];
  if (isOwner) {
    menuItems.push({
      label: t("household"),
      icon: <Users className="h-4 w-4" />,
      onClick: () => router.push("/household"),
    });
    menuItems.push({
      label: t("manageItems"),
      icon: <Tag className="h-4 w-4" />,
      onClick: () => router.push("/items"),
      badge: uncategorizedCount,
    });
  }
  menuItems.push({
    label: t("signOut"),
    icon: <LogOut className="h-4 w-4" />,
    onClick: () => void signOut(),
    danger: true,
  });

  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="min-w-0 flex items-start gap-2">
        {backHref && (
          <Link
            href={backHref}
            prefetch
            className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        )}
        <div className="min-w-0">
          {typeof title === "string" ? (
            <h1 className="text-2xl font-bold leading-tight text-zinc-900 dark:text-zinc-50 truncate">
              {title}
            </h1>
          ) : (
            title
          )}
          {subtitle && (
            <p className="text-xs text-zinc-500 truncate mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 mt-1">
        {rightExtra}
        <LangToggle />
        <ActionMenu items={menuItems} />
      </div>
    </div>
  );
}
