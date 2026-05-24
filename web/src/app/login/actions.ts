"use server";

import { headers } from "next/headers";

import { isEmailAllowed } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export async function sendMagicLink(formData: FormData): Promise<{ error?: string } | void> {
  const rawEmail = formData.get("email");
  const next = formData.get("next");

  if (typeof rawEmail !== "string" || !rawEmail) {
    return { error: "Please enter a valid email address." };
  }
  const email = rawEmail.trim().toLowerCase();

  if (!isEmailAllowed(email)) {
    // Don't tell unauthorized users whether the email is real — just say the same thing.
    // For Phase 1 this is fine; Phase 2 will use invite codes.
    return { error: "This email isn't on the private beta allowlist." };
  }

  const supabase = await createClient();
  const headerList = await headers();
  const origin = headerList.get("origin") ?? `https://${headerList.get("host") ?? ""}`;
  const nextParam = typeof next === "string" && next ? `?next=${encodeURIComponent(next)}` : "";

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${origin}/auth/callback${nextParam}`,
    },
  });

  if (error) {
    return { error: error.message };
  }
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
