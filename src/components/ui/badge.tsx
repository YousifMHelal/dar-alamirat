import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Small status/label pill. Tone maps to the semantic token palette so the
 * same component renders order statuses, payment states, and type tags
 * consistently. Color is never the only signal — callers pair it with text
 * (and often an icon) per the a11y guideline.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        neutral: "border-border bg-muted text-muted-foreground",
        primary: "border-transparent bg-primary-soft text-sidebar-active-foreground",
        success: "border-transparent bg-success/12 text-success",
        warning: "border-transparent bg-warning/20 text-warning-foreground",
        danger: "border-transparent bg-destructive/12 text-destructive",
        info: "border-transparent bg-accent/15 text-accent-foreground",
        outline: "border-border-strong bg-surface text-foreground",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export { badgeVariants };
