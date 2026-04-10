"use client";

import { resolveMessages } from "@/lib/i18n/messages";

export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const copy = resolveMessages("zh");

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-canvas)] px-6">
      <div className="max-w-xl rounded-[var(--radius-md)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-card)]">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-muted-text)]">
          workspace error
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-[-0.06em] text-[var(--color-text)]">
          {copy.workspaceError}
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--color-muted-text)]">
          {error.message}
        </p>
        <button
          className="mt-5 rounded-[var(--radius-sm)] bg-[var(--color-text)] px-4 py-2 text-sm font-medium text-white"
          onClick={reset}
          type="button"
        >
          {copy.workspaceErrorRetry}
        </button>
      </div>
    </div>
  );
}
