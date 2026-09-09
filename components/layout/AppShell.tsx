"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./nav-items";
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

  const pathname = usePathname();
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (mobileOpen) dialog?.showModal(); else dialog?.close();
  }, [mobileOpen]);

  return (
    <div className="flex h-full min-h-screen w-full">
      <div className="hidden md:block">
        <Sidebar />
      </div>

      <dialog ref={dialogRef} onCancel={() => setMobileOpen(false)} onClick={event => { if (event.target === event.currentTarget) setMobileOpen(false); }} className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none bg-transparent backdrop:bg-ink/40 md:hidden" aria-label="Navigation">
        <div className="relative h-full w-64">
          <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation" className="absolute right-2 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-lg bg-surface"><X size={20} /></button>
          <Sidebar onNavigate={() => setMobileOpen(false)} />
        </div>
      </dialog>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border bg-surface px-4 md:px-6">
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-lg p-2 text-ink-muted hover:bg-surface-alt md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
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
        <main id="main-content" className="flex-1 bg-bg min-w-0 px-4 pt-5 pb-28 md:px-8 md:py-8">{children}</main>
        <nav aria-label="Main navigation" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-surface px-2 pt-1 md:hidden" style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
          {NAV_ITEMS.slice(0, 4).map(item => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg text-xs font-medium ${active ? "bg-primary-soft text-primary" : "text-ink-muted"}`}><Icon size={21} />{item.label === "Dashboard" ? "Today" : item.label}</Link>;
          })}
          <button type="button" onClick={() => setMobileOpen(true)} aria-expanded={mobileOpen} className="flex min-h-14 flex-col items-center justify-center gap-1 text-xs font-medium text-ink-muted"><Menu size={21} />More</button>
        </nav>
      </div>
    </div>
  );
}
