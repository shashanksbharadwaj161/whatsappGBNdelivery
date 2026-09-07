"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { CONVERSATION_STATUS_STYLE } from "@/lib/statusStyles";
import type { ConversationStatus } from "@prisma/client";

export interface ConversationSummary {
  id: string;
  displayName: string;
  lastMessagePreview: string;
  lastMessageAt: string | null;
  unreadCount: number;
  status: ConversationStatus;
}

export function ConversationList({ conversations }: { conversations: ConversationSummary[] }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-full flex-col divide-y divide-border overflow-y-auto md:w-80 md:border-r md:border-border">
      {conversations.map((c) => {
        const active = pathname === `/inbox/${c.id}`;
        const style = CONVERSATION_STATUS_STYLE[c.status];
        return (
          <Link
            key={c.id}
            href={`/inbox/${c.id}`}
            className={cn(
              "flex flex-col gap-1 px-4 py-3 hover:bg-surface-alt",
              active && "bg-primary-soft"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-medium text-ink">{c.displayName}</p>
              {c.unreadCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-semibold text-white">
                  {c.unreadCount}
                </span>
              )}
            </div>
            <p className="truncate text-xs text-ink-muted">{c.lastMessagePreview}</p>
            <div className="flex items-center justify-between">
              <Badge tone={style.tone} className="text-[10px]">
                {style.label}
              </Badge>
              {c.lastMessageAt && (
                <span className="text-[10px] text-ink-faint">
                  {new Date(c.lastMessageAt).toLocaleString("en-IN", { hour: "numeric", minute: "2-digit" })}
                </span>
              )}
            </div>
          </Link>
        );
      })}
      {conversations.length === 0 && (
        <p className="p-4 text-center text-sm text-ink-muted">No conversations yet.</p>
      )}
    </div>
  );
}
