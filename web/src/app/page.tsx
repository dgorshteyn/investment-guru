export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-12 px-6 py-24">
        <header className="flex flex-col gap-3">
          <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">
            Investment Guru
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
            Allocate, rebalance, backtest.
          </h1>
          <p className="max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
            A planning tool for passive investors. Define target allocations, see
            exactly which trades to make, and stress-test your strategy against
            three decades of market history.
          </p>
        </header>

        <section className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            Currently invite-only
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Investment Guru is in private beta. If you have an invite code, head to
            <a href="/redeem" className="ml-1 font-medium text-zinc-900 underline dark:text-zinc-50">
              /redeem
            </a>
            . Otherwise, request access below.
          </p>
        </section>

        <footer className="mt-auto text-xs text-zinc-500">
          Investment Guru is an experimental tool for educational and informational
          purposes only. Nothing here is financial advice. Backtested results are
          hypothetical and do not reflect actual trading.
        </footer>
      </main>
    </div>
  );
}
