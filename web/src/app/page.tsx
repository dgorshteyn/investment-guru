import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-12 px-6 py-24">
        <header className="flex flex-col gap-3">
          <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            Investment Guru
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Allocate, rebalance, backtest.
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            A planning tool for passive investors. Define target allocations, see exactly which
            trades to make, and stress-test your strategy against three decades of market history.
          </p>
        </header>

        <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-6">
          <h2 className="text-base font-semibold">Currently in private alpha</h2>
          <p className="text-sm text-muted-foreground">
            We&apos;ll open invite-code redemption once we&apos;ve dogfooded the product internally.
            If you&apos;re on the allowlist, sign in below.
          </p>
          <div className="mt-2">
            <Button asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </section>

        <footer className="mt-auto text-xs text-muted-foreground">
          Investment Guru is an experimental tool for educational and informational purposes only.
          Nothing here is financial advice. Backtested results are hypothetical and do not reflect
          actual trading.
        </footer>
      </main>
    </div>
  );
}
