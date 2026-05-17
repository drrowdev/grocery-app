"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function getOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function signInWithMagicLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { error: "invalid_email" as const };
  }

  const origin = await getOrigin();

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  if (error) {
    console.error("magic-link error:", error.message);
    return { error: "generic" as const };
  }
  return { ok: true as const };
}

/**
 * Verify the 6-digit email OTP code. On success, the user is signed in.
 */
export async function verifyEmailOtp(
  email: string,
  token: string,
): Promise<
  | { ok: true }
  | { ok: false; error: "invalid_input" | "invalid_code" | "generic"; message?: string }
> {
  const cleanedEmail = email.trim().toLowerCase();
  const cleanedToken = token.replace(/\s+/g, "");
  if (!cleanedEmail || !cleanedToken || cleanedToken.length < 4) {
    return { ok: false, error: "invalid_input" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email: cleanedEmail,
    token: cleanedToken,
    type: "email",
  });

  if (error) {
    console.error("verifyOtp error:", error.message);
    if (
      error.message.toLowerCase().includes("invalid") ||
      error.message.toLowerCase().includes("expired") ||
      error.message.toLowerCase().includes("token")
    ) {
      return { ok: false, error: "invalid_code", message: error.message };
    }
    return { ok: false, error: "generic", message: error.message };
  }
  return { ok: true };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
