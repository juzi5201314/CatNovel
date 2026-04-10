import * as React from "react";

import { cn } from "@/lib/utils";

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-32 w-full rounded-[var(--radius-md)] bg-[var(--color-surface)] px-4 py-3 text-sm leading-6 text-[var(--color-text)] shadow-[var(--shadow-light-ring)] outline-none transition-shadow placeholder:text-[var(--color-muted-text)] focus-visible:shadow-[var(--shadow-focus)]",
        className,
      )}
      {...props}
    />
  );
}
