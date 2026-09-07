import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

const variants = {
  primary: "bg-primary text-white hover:bg-primary-hover",
  accent: "bg-accent text-white hover:bg-accent-hover",
  outline: "border border-border bg-surface text-ink hover:bg-surface-alt",
  ghost: "text-ink hover:bg-surface-alt",
  danger: "bg-status-cancelled text-white hover:opacity-90",
} as const;

const sizes = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
} as const;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-lg font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
