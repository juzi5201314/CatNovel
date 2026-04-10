import { resolveMessages } from "@/lib/i18n/messages";

export default function WorkspaceLoading() {
  const copy = resolveMessages("zh");

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-canvas)] px-6">
      <div className="rounded-[var(--radius-md)] bg-[var(--color-surface)] px-6 py-4 text-sm text-[var(--color-muted-text)] shadow-[var(--shadow-card)]">
        {copy.workspaceLoading}
      </div>
    </div>
  );
}
