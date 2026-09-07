"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Leaf } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-64 flex-col border-r border-border bg-surface">
      <div className="flex items-center gap-2 px-5 py-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white">
          <Leaf size={18} />
        </span>
        <div className="leading-tight">
          <p className="font-display text-sm font-semibold text-ink">Gau Bhoomi</p>
          <p className="text-xs text-ink-muted">Naturals</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary-soft text-primary"
                  : "text-ink-muted hover:bg-surface-alt hover:text-ink"
              )}
            >
              <Icon size={18} strokeWidth={2} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border px-3 py-3">
        <Link
          href="/driver"
          onClick={onNavigate}
          className="block rounded-lg bg-accent-soft px-3 py-2 text-center text-sm font-medium text-accent-hover hover:bg-accent-soft/70"
        >
          Open Driver View
        </Link>
      </div>
    </div>
  );
}
