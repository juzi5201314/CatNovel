"use client";

import type { Editor } from "@tiptap/react";

type EditorToolbarProps = {
  editor: Editor | null;
};

function ToolbarButton({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`rounded-md border px-3 py-1.5 text-sm transition ${
        active
          ? "border-[#21636b] bg-[#21636b] text-white"
          : "border-[var(--cn-border)] bg-white text-[var(--cn-text-primary)]"
      } ${disabled ? "cursor-not-allowed opacity-50" : "hover:border-[#21636b]"}`}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  const disabled = !editor;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ToolbarButton
        label="段落"
        active={editor?.isActive("paragraph")}
        disabled={disabled}
        onClick={() => editor?.chain().focus().setParagraph().run()}
      />
      <ToolbarButton
        label="标题"
        active={editor?.isActive("heading", { level: 2 })}
        disabled={disabled}
        onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
      />
      <ToolbarButton
        label="粗体"
        active={editor?.isActive("bold")}
        disabled={disabled}
        onClick={() => editor?.chain().focus().toggleBold().run()}
      />
      <ToolbarButton
        label="斜体"
        active={editor?.isActive("italic")}
        disabled={disabled}
        onClick={() => editor?.chain().focus().toggleItalic().run()}
      />
    </div>
  );
}
