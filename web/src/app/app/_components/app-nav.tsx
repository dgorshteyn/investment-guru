"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const links = [
  { href: "/app", label: "Portfolios", match: (p: string) => p === "/app" || p.startsWith("/app/portfolio") || p === "/app/new" },
  { href: "/app/performance", label: "Performance", match: (p: string) => p.startsWith("/app/performance") },
  { href: "/app/settings", label: "Settings", match: (p: string) => p.startsWith("/app/settings") },
];

export function AppNav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1 text-sm">
      {links.map((link) => {
        const active = link.match(pathname);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground",
              active && "bg-accent text-foreground"
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
