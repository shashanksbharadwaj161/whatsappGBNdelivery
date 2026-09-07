"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { signOutAction } from "@/lib/auth/actions";

export function SignOutButton() {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => signOutAction())}
      className="rounded-lg p-2 text-ink-muted hover:bg-surface-alt hover:text-ink disabled:opacity-50"
      aria-label="Sign out"
      title="Sign out"
    >
      <LogOut size={18} />
    </button>
  );
}
