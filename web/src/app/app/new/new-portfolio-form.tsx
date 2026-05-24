"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPortfolio } from "@/lib/portfolios/actions";

export function NewPortfolioForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createPortfolio(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          required
          maxLength={80}
          placeholder="e.g. Roth IRA"
          autoFocus
          disabled={isPending}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description <span className="text-muted-foreground">(optional)</span></Label>
        <Input
          id="description"
          name="description"
          placeholder="What's this portfolio for?"
          maxLength={280}
          disabled={isPending}
        />
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.push("/app")} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating…" : "Create portfolio"}
        </Button>
      </div>
    </form>
  );
}
