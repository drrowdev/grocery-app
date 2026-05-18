"use client";

import { useState, useTransition } from "react";
import { Crown, Loader2, LogOut, Mail, UserPlus, X } from "lucide-react";
import { useLang } from "@/components/lang-provider";
import { AppHeader } from "@/components/app-header";
import {
  inviteToHousehold,
  leaveHousehold,
  removeMember,
  revokeInvitation,
} from "@/app/household/actions";
import type { InvitationRow, MemberRow } from "@/app/household/page";

export function HouseholdView({
  householdName,
  householdId,
  members,
  invitations,
  currentUserId,
  isOwner,
}: {
  householdName: string;
  householdId: string;
  members: MemberRow[];
  invitations: InvitationRow[];
  currentUserId: string;
  isOwner: boolean;
}) {
  const { t } = useLang();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);
  const [emailDraft, setEmailDraft] = useState("");

  return (
    <div className="flex flex-col flex-1 min-h-dvh bg-zinc-50 dark:bg-zinc-950">
      <main className="flex-1 px-5 py-5 mx-auto w-full max-w-2xl space-y-6">
        <AppHeader
          title={t("household")}
          subtitle={householdName}
          backHref="/list"
          isOwner={isOwner}
        />
        {isOwner && (
          <section>
            <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <UserPlus className="h-3.5 w-3.5" />
              {t("inviteTitle")}
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const email = emailDraft.trim();
                if (!email) return;
                startTransition(async () => {
                  setFeedback(null);
                  const res = await inviteToHousehold(householdId, email);
                  if (res.ok) {
                    setFeedback({ kind: "ok", text: t("inviteSent", { email }) });
                    setEmailDraft("");
                  } else {
                    setFeedback({
                      kind: "err",
                      text:
                        res.error === "already_member"
                          ? t("alreadyMember")
                          : res.error === "invalid_email"
                            ? t("errorInvalidEmail")
                            : `${t("errorGeneric")}${res.message ? ` (${res.message})` : ""}`,
                    });
                  }
                });
              }}
              className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {t("emailLabel")}
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  type="email"
                  required
                  autoComplete="email"
                  inputMode="email"
                  value={emailDraft}
                  onChange={(e) => setEmailDraft(e.target.value)}
                  placeholder={t("emailPlaceholder")}
                  className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                />
                <button
                  type="submit"
                  disabled={pending}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
                >
                  {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4" />
                  )}
                  {t("invite")}
                </button>
              </div>
              <p className="mt-2 text-xs text-zinc-500">{t("inviteHint")}</p>
              {feedback && (
                <p
                  className={`mt-2 text-sm ${
                    feedback.kind === "ok"
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-rose-600"
                  }`}
                >
                  {feedback.text}
                </p>
              )}
            </form>
          </section>
        )}

        <section>
          <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {t("members")} · {members.length}
          </h2>
          <ul className="divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white shadow-sm dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {members.map((m) => (
              <li
                key={m.user_id}
                className="flex items-center gap-3 px-4 py-3"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  {m.role === "owner" ? (
                    <Crown className="h-4 w-4" />
                  ) : (
                    <span className="text-xs font-semibold">
                      {(m.display_name ?? m.email ?? "?")[0]?.toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50 truncate">
                    {m.display_name ?? m.email ?? "—"}
                    {m.user_id === currentUserId && (
                      <span className="ml-2 text-xs font-normal text-zinc-500">
                        ({t("you")})
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-zinc-500 truncate">
                    {m.email}
                    {" · "}
                    {m.role === "owner" ? t("roleOwner") : t("roleMember")}
                  </p>
                </div>
                {isOwner && m.user_id !== currentUserId && (
                  <button
                    type="button"
                    onClick={() =>
                      startTransition(async () => {
                        await removeMember(householdId, m.user_id);
                      })
                    }
                    disabled={pending}
                    className="rounded-md p-1.5 text-zinc-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-60 dark:hover:bg-rose-950/30"
                    aria-label={t("remove")}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>

        {invitations.length > 0 && (
          <section>
            <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <Mail className="h-3.5 w-3.5" />
              {t("pendingInvitations")} · {invitations.length}
            </h2>
            <ul className="divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white/70 shadow-sm dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900/70">
              {invitations.map((inv) => (
                <li
                  key={inv.id}
                  className="flex items-center gap-3 px-4 py-2.5"
                >
                  <Mail className="h-4 w-4 text-zinc-400" />
                  <p className="min-w-0 flex-1 text-sm text-zinc-700 dark:text-zinc-300 truncate">
                    {inv.email}
                  </p>
                  {isOwner && (
                    <button
                      type="button"
                      onClick={() =>
                        startTransition(async () => {
                          await revokeInvitation(inv.id);
                        })
                      }
                      disabled={pending}
                      className="rounded-md p-1.5 text-zinc-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-60 dark:hover:bg-rose-950/30"
                      aria-label={t("revoke")}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {!isOwner && (
          <section>
            <button
              type="button"
              onClick={() => {
                if (!window.confirm(t("leaveConfirm"))) return;
                startTransition(async () => {
                  await leaveHousehold(householdId);
                });
              }}
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100 disabled:opacity-60 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300"
            >
              <LogOut className="h-4 w-4" />
              {t("leaveHousehold")}
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
