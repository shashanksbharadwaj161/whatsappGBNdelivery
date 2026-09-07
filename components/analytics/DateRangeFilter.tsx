import Link from "next/link";
import { cn } from "@/lib/utils";

const PRESETS = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
] as const;

export function DateRangeFilter({ active }: { active: string }) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {PRESETS.map((p) => (
        <Link
          key={p.key}
          href={`/analytics?range=${p.key}`}
          className={cn(
            "rounded-full px-3 py-1.5 text-sm font-medium",
            active === p.key ? "bg-primary text-white" : "bg-surface-alt text-ink-muted hover:text-ink"
          )}
        >
          {p.label}
        </Link>
      ))}
    </div>
  );
}
