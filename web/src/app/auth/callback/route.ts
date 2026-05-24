import { NextResponse, type NextRequest } from "next/server";

import { isEmailAllowed } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/**
 * Handles the OAuth/magic-link callback. Two flows:
 *   1. ?code=...   — Supabase exchanges this for a session cookie.
 *   2. ?token_hash=...&type=... — older email OTP shape.
 *
 * After exchange we re-check the email allowlist (defense in depth — the
 * client-side allowlist check in `sendMagicLink` should already have stopped
 * anyone who isn't on the list).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const nextRaw = searchParams.get("next");
  const next = nextRaw && nextRaw.startsWith("/") ? nextRaw : "/app";

  const supabase = await createClient();
  let exchangeError: string | null = null;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) exchangeError = error.message;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as "email" | "magiclink" | "recovery" | "signup",
      token_hash: tokenHash,
    });
    if (error) exchangeError = error.message;
  } else {
    exchangeError = "Missing auth code.";
  }

  if (exchangeError) {
    const url = new URL("/login", origin);
    url.searchParams.set("error", exchangeError);
    return NextResponse.redirect(url);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isEmailAllowed(user.email)) {
    await supabase.auth.signOut();
    const url = new URL("/login", origin);
    url.searchParams.set("error", "This email isn't on the private beta allowlist.");
    return NextResponse.redirect(url);
  }

  return NextResponse.redirect(new URL(next, origin));
}
