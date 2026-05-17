"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createHousehold(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "name_required" as const, message: "Name is required" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not_authenticated" as const, message: "Not signed in" };

  const { error } = await supabase
    .from("households")
    .insert({ name, created_by: user.id });

  if (error) {
    console.error("createHousehold error:", error);
    return {
      error: "generic" as const,
      message: `${error.code ?? "?"}: ${error.message}`,
    };
  }

  redirect("/");
}
