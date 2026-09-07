import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "today", label: "Today" },
  { key: "tomorrow", label: "Tomorrow" },
  { key: "upcoming", label: "Upcoming" },
  { key: "subscriptions", label: "Subscriptions" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
] as const;

export type OrderTabKey = (typeof TABS)[number]["key"];

export function OrderTabs({ active }: { active: OrderTabKey }) {
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto border-b border-border">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={`/orders?tab=${tab.key}`}
          className={cn(
            "whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium",
            active === tab.key
              ? "border-primary text-primary"
              : "border-transparent text-ink-muted hover:text-ink"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
