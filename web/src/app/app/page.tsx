import Link from "next/link";
import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default async function PortfoliosPage() {
  const supabase = await createClient();
  const { data: portfolios, error } = await supabase
    .from("portfolios")
    .select("id, name, description, created_at, updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Failed to load portfolios: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Portfolios</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Define a target allocation, track holdings, and run backtests.
          </p>
        </div>
        <Button asChild>
          <Link href="/app/new">
            <PlusIcon className="size-4" />
            New portfolio
          </Link>
        </Button>
      </div>

      {portfolios && portfolios.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {portfolios.map((p) => (
            <Link key={p.id} href={`/app/portfolio/${p.id}`} className="group">
              <Card className="transition-colors group-hover:border-foreground/30">
                <CardHeader>
                  <CardTitle className="text-base">{p.name}</CardTitle>
                  {p.description ? (
                    <CardDescription className="line-clamp-2">{p.description}</CardDescription>
                  ) : null}
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  Updated {formatRelativeDate(p.updated_at)}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/30 p-12 text-center">
      <h2 className="text-base font-medium">No portfolios yet</h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        Create your first portfolio to define a target allocation and start tracking your strategy.
        Sprint 3 will add a library of canonical starter portfolios to clone from.
      </p>
      <Button asChild className="mt-6">
        <Link href="/app/new">
          <PlusIcon className="size-4" />
          New portfolio
        </Link>
      </Button>
    </div>
  );
}
