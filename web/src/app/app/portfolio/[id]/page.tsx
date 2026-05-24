import { notFound } from "next/navigation";
import Link from "next/link";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PortfolioDetailsCard } from "@/app/app/portfolio/[id]/_components/details-card";
import { createClient } from "@/lib/supabase/server";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PortfolioDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: portfolio, error } = await supabase
    .from("portfolios")
    .select("id, name, description, created_at, updated_at")
    .eq("id", id)
    .single();

  if (error || !portfolio) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/app" className="text-sm text-muted-foreground hover:text-foreground">
          ← Portfolios
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{portfolio.name}</h1>
        {portfolio.description ? (
          <p className="mt-1 text-sm text-muted-foreground">{portfolio.description}</p>
        ) : null}
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="holdings" disabled>Holdings</TabsTrigger>
          <TabsTrigger value="transactions" disabled>Transactions</TabsTrigger>
          <TabsTrigger value="strategy" disabled>Strategy</TabsTrigger>
          <TabsTrigger value="backtest" disabled>Backtest</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <PortfolioDetailsCard portfolio={portfolio} />
          <ComingSoonNote />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ComingSoonNote() {
  return (
    <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
      <p className="font-medium text-foreground">Sprint 1 placeholder</p>
      <p className="mt-1">
        Holdings, Transactions, Strategy, and Backtest tabs land in Sprints 2-6. For now, you can
        edit the portfolio name / description or delete it.
      </p>
    </div>
  );
}
