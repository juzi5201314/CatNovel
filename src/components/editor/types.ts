export type EditorSaveStatus = "idle" | "saving" | "saved" | "error";

export type EditorChapter = {
  id: string;
  title: string;
  content: string;
  summary?: string | null;
  orderNo: number;
  projectId: string;
};

export type EditorSavePayload = {
  content: string;
  summary?: string;
};

export type EditorShellProps = {
  chapter: EditorChapter | null;
  onSave: (payload: EditorSavePayload) => Promise<void>;
  autosaveDelayMs?: number;
};
