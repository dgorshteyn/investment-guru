import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NewPortfolioForm } from "@/app/app/new/new-portfolio-form";

export default function NewPortfolioPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/app" className="text-sm text-muted-foreground hover:text-foreground">
          ← Portfolios
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">New portfolio</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Give it a name. You&apos;ll set the target allocation, add holdings, and configure
          rebalancing in the next steps.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent>
          <NewPortfolioForm />
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        A library of canonical starter portfolios (3-fund, All Weather, Permanent Portfolio, …) is
        coming in Sprint 3.
      </p>
    </div>
  );
}
