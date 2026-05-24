import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "@/app/login/login-form";
import { createClient } from "@/lib/supabase/server";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; sent?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/app");
  }

  const params = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-sm space-y-8">
        <header className="space-y-2 text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Investment Guru
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="text-sm text-muted-foreground">
            Private beta. We&apos;ll send you a one-time magic link.
          </p>
        </header>

        <LoginForm next={params.next} initialError={params.error} initialSent={params.sent === "1"} />

        <p className="text-center text-xs text-muted-foreground">
          Not on the allowlist?{" "}
          <Link href="/" className="underline">
            Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
