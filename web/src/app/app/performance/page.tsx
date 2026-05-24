export default function PerformancePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Performance</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cross-portfolio time-weighted return chart since your first transaction.
        </p>
      </div>
      <div className="rounded-md border border-dashed border-border p-12 text-center">
        <p className="text-sm font-medium">Lands in Sprint 7</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Requires the transactions ledger (Sprint 2) and the Python worker&apos;s TWR endpoint.
        </p>
      </div>
    </div>
  );
}
