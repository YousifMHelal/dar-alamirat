import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Text input matching the portal's tokens. Always pair with a visible
 * <label> (form-labels guideline) — this primitive intentionally does not
 * render its own label. `aria-invalid` styling surfaces validation state.
 */
export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "border-input bg-surface text-foreground placeholder:text-muted-foreground h-10 w-full rounded-lg border px-3 text-sm shadow-soft transition-colors",
        "focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-2 focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/25 aria-[invalid=true]:ring-2",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

/** Field label — start-aligned, mirrors correctly in RTL. */
export function Label({
  className,
  children,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("text-foreground mb-1.5 block text-sm font-medium", className)}
      {...props}
    >
      {children}
    </label>
  );
}

/** Inline field error, rendered below the input (error-placement guideline). */
export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-destructive mt-1.5 text-xs">
      {children}
    </p>
  );
}
