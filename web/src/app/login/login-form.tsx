"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendMagicLink } from "@/app/login/actions";

interface Props {
  next?: string;
  initialError?: string;
  initialSent?: boolean;
}

export function LoginForm({ next, initialError, initialSent }: Props) {
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [sent, setSent] = useState(initialSent ?? false);
  const [isPending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await sendMagicLink(formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setSent(true);
      }
    });
  }

  if (sent) {
    return (
      <div className="rounded-md border border-border bg-card p-4 text-sm text-card-foreground">
        <p className="font-medium">Check your inbox.</p>
        <p className="mt-1 text-muted-foreground">
          We sent a sign-in link to your email. It expires in 1 hour.
        </p>
        <button
          type="button"
          className="mt-3 text-xs underline text-muted-foreground hover:text-foreground"
          onClick={() => setSent(false)}
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          disabled={isPending}
        />
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Sending…" : "Send magic link"}
      </Button>
    </form>
  );
}
