import type { UIMessage } from "ai";

export type ActiveRunProbeMode = "initial" | "active-poll" | "event-probe";

export const MAX_EVENT_PROBE_RETRIES = 2;

export type ActiveRunSummary = {
  id: string;
  status: "queued" | "running";
  chapterId: string | null;
};

export type ChatSessionSnapshot = {
  id: string;
  messages: UIMessage[];
  chatTerminated: boolean;
};

export type ActiveRunSyncPlan =
  | {
      type: "set-active-run";
      run: ActiveRunSummary;
    }
  | {
      type: "clear-run";
    }
  | {
      type: "restore-session";
      session: ChatSessionSnapshot;
      replaceMessages: boolean;
      replaceChatTerminated: boolean;
    };

export function shouldProbeActiveRun(input: {
  projectId: string | null;
  activeSessionId: string | null;
  status: string;
}): boolean {
  if (!input.projectId || !input.activeSessionId) {
    return false;
  }
  return input.status === "submitted" || input.status === "streaming";
}

export function shouldRetryEventProbe(input: {
  mode: ActiveRunProbeMode;
  run: ActiveRunSummary | null;
  hadTrackedActiveRun: boolean;
  retryCount: number;
}): boolean {
  return (
    input.mode === "event-probe" &&
    input.run === null &&
    input.hadTrackedActiveRun === false &&
    input.retryCount < MAX_EVENT_PROBE_RETRIES
  );
}

export function shouldIgnoreActiveRunSyncResult(input: {
  requestedSessionId: string;
  currentSessionId: string | null;
  requestedProjectId: string | null;
  currentProjectId: string | null;
}): boolean {
  return (
    !input.requestedProjectId ||
    input.currentSessionId !== input.requestedSessionId ||
    input.currentProjectId !== input.requestedProjectId
  );
}

export function buildActiveRunSyncPlan(input: {
  mode: ActiveRunProbeMode;
  run: ActiveRunSummary | null;
  hadTrackedActiveRun: boolean;
  restoredSession?: ChatSessionSnapshot;
  localMessages: UIMessage[];
  localChatTerminated: boolean;
}): ActiveRunSyncPlan {
  if (input.run) {
    return {
      type: "set-active-run",
      run: input.run,
    };
  }

  if (input.mode === "event-probe") {
    return {
      type: "clear-run",
    };
  }

  if (!input.restoredSession) {
    throw new Error("restoredSession is required when no active run exists outside event-probe mode");
  }

  if (input.hadTrackedActiveRun) {
    return {
      type: "restore-session",
      session: input.restoredSession,
      replaceMessages: true,
      replaceChatTerminated: true,
    };
  }

  return {
    type: "restore-session",
    session: input.restoredSession,
    replaceMessages:
      JSON.stringify(input.localMessages) !== JSON.stringify(input.restoredSession.messages),
    replaceChatTerminated: input.localChatTerminated !== input.restoredSession.chatTerminated,
  };
}
