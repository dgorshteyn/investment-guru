"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deletePortfolio, updatePortfolio } from "@/lib/portfolios/actions";

interface Portfolio {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export function PortfolioDetailsCard({ portfolio }: { portfolio: Portfolio }) {
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSave(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updatePortfolio(portfolio.id, formData);
      if (result?.error) setError(result.error);
      else setEditing(false);
    });
  }

  function onDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deletePortfolio(portfolio.id);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-base">Details</CardTitle>
          <div className="flex items-center gap-2">
            {!editing ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {editing ? (
            <form action={onSave} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={portfolio.name}
                  required
                  maxLength={80}
                  disabled={isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">
                  Description <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="description"
                  name="description"
                  defaultValue={portfolio.description ?? ""}
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
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setEditing(false);
                    setError(null);
                  }}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Saving…" : "Save"}
                </Button>
              </div>
            </form>
          ) : (
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Name
                </dt>
                <dd className="mt-1">{portfolio.name}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Description
                </dt>
                <dd className="mt-1 text-muted-foreground">
                  {portfolio.description || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Created
                </dt>
                <dd className="mt-1 text-muted-foreground">
                  {new Date(portfolio.created_at).toLocaleString("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Last updated
                </dt>
                <dd className="mt-1 text-muted-foreground">
                  {new Date(portfolio.updated_at).toLocaleString("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </dd>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete portfolio?</DialogTitle>
            <DialogDescription>
              This permanently deletes <span className="font-medium">{portfolio.name}</span> and
              all its transactions, targets, and backtests. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onDelete} disabled={isPending}>
              {isPending ? "Deleting…" : "Delete portfolio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
