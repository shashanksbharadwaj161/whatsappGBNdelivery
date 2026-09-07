"use client";

import { useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { SignOutButton } from "./SignOutButton";

interface AppShellProps {
  children: ReactNode;
  userLabel: string;
  roleLabel: string;
}

export function AppShell({ children, userLabel, roleLabel }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-full min-h-screen w-full">
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-ink/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border bg-surface px-4 md:px-6">
          <button
            type="button"
            className="rounded-lg p-2 text-ink-muted hover:bg-surface-alt md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle navigation"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="hidden md:block" />
          <div className="flex items-center gap-3">
            <div className="text-right leading-tight">
              <p className="text-sm font-medium text-ink">{userLabel}</p>
              <p className="text-xs text-ink-muted">{roleLabel}</p>
            </div>
            <SignOutButton />
          </div>
        </header>
        <main className="flex-1 bg-bg px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
