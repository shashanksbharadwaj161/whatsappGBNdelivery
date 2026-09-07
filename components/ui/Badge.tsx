import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const tones = {
  neutral: "bg-surface-alt text-ink-muted",
  primary: "bg-primary-soft text-primary",
  accent: "bg-accent-soft text-accent-hover",
  pending: "bg-[var(--color-status-pending-soft)] text-[var(--color-status-pending)]",
  confirmed: "bg-[var(--color-status-confirmed-soft)] text-[var(--color-status-confirmed)]",
  transit: "bg-[var(--color-status-transit-soft)] text-[var(--color-status-transit)]",
  delivered: "bg-[var(--color-status-delivered-soft)] text-[var(--color-status-delivered)]",
  cancelled: "bg-[var(--color-status-cancelled-soft)] text-[var(--color-status-cancelled)]",
  skipped: "bg-[var(--color-status-skipped-soft)] text-[var(--color-status-skipped)]",
} as const;

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: keyof typeof tones;
}

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className
      )}
      {...props}
    />
  );
}
