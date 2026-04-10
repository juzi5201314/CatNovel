import * as React from "react";

import { cn } from "@/lib/utils";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-[var(--radius-sm)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text)] shadow-[var(--shadow-light-ring)] outline-none transition-shadow placeholder:text-[var(--color-muted-text)] focus-visible:shadow-[var(--shadow-focus)]",
        className,
      )}
      {...props}
    />
  );
}
