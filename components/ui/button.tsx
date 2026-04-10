import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-sm)] text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-canvas)]",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--color-text)] px-4 py-2 text-white shadow-[var(--shadow-ring)] hover:bg-black",
        secondary:
          "bg-[var(--color-surface)] px-4 py-2 text-[var(--color-text)] shadow-[var(--shadow-light-ring)] hover:bg-[var(--color-surface-muted)]",
        ghost: "px-3 py-2 text-[var(--color-muted-text)] hover:bg-[var(--color-surface-muted)]",
      },
      size: {
        default: "h-10",
        sm: "h-9 px-3 text-xs",
        lg: "h-11 px-5",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({
  className,
  variant,
  size,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      type={type}
      {...props}
    />
  );
}
