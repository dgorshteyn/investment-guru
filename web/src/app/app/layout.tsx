import Link from "next/link";
import { redirect } from "next/navigation";

import { AppNav } from "@/app/app/_components/app-nav";
import { UserMenu } from "@/app/app/_components/user-menu";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-8">
            <Link href="/app" className="text-sm font-semibold tracking-tight">
              Investment Guru
            </Link>
            <AppNav />
          </div>
          <UserMenu email={user.email ?? ""} />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
      <footer className="border-t border-border py-4">
        <p className="mx-auto max-w-6xl px-6 text-xs text-muted-foreground">
          Investment Guru is for educational and informational purposes only. Nothing here is
          financial advice.
        </p>
      </footer>
    </div>
  );
}
