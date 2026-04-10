import * as React from "react";

import { cn } from "@/lib/utils";

export function Badge({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--color-badge-surface)] px-2.5 py-1 text-xs font-medium text-[var(--color-badge-text)]",
        className,
      )}
      {...props}
    />
  );
}
