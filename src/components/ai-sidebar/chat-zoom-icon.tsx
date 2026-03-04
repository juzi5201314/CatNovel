type ChatZoomIconProps = {
  mode: "expand" | "collapse";
  className?: string;
};

export function ChatZoomIcon({ mode, className = "h-4 w-4" }: ChatZoomIconProps) {
  if (mode === "collapse") {
    return (
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ color: "var(--foreground, #111827)", display: "block" }}
        aria-hidden="true"
      >
        <path d="M5 9 9 5" />
        <path d="M3 3h6v6" />
        <path d="M5 15 9 19" />
        <path d="M3 21h6v-6" />
        <path d="M19 9 15 5" />
        <path d="M15 3h6v6" />
        <path d="M19 15 15 19" />
        <path d="M15 21h6v-6" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: "var(--foreground, #111827)", display: "block" }}
      aria-hidden="true"
    >
      <path d="M16 4h4v4" />
      <path d="M14 10 20 4" />
      <path d="M8 20H4v-4" />
      <path d="M4 20 10 14" />
      <path d="M16 20h4v-4" />
      <path d="M14 14 20 20" />
      <path d="M8 4H4v4" />
      <path d="M4 4 10 10" />
    </svg>
  );
}
