import assert from "node:assert/strict";
import test from "node:test";
import type { UIMessage } from "ai";

import {
  MAX_EVENT_PROBE_RETRIES,
  buildActiveRunSyncPlan,
  shouldIgnoreActiveRunSyncResult,
  shouldProbeActiveRun,
  shouldRetryEventProbe,
} from "../../src/components/ai-sidebar/chat-run-sync.ts";

test("shouldProbeActiveRun only probes when session is active and status is submitted", () => {
  assert.equal(
    shouldProbeActiveRun({
      projectId: "project-1",
      activeSessionId: "session-1",
      status: "submitted",
    }),
    true,
  );
  assert.equal(
    shouldProbeActiveRun({
      projectId: "project-1",
      activeSessionId: "session-1",
      status: "ready",
    }),
    false,
  );
  assert.equal(
    shouldProbeActiveRun({
      projectId: "project-1",
      activeSessionId: "session-1",
      status: "streaming",
    }),
    true,
  );
});

test("shouldRetryEventProbe retries only for untracked event-probe misses within retry budget", () => {
  assert.equal(
    shouldRetryEventProbe({
      mode: "event-probe",
      run: null,
      hadTrackedActiveRun: false,
      retryCount: 0,
    }),
    true,
  );
  assert.equal(
    shouldRetryEventProbe({
      mode: "event-probe",
      run: null,
      hadTrackedActiveRun: false,
      retryCount: MAX_EVENT_PROBE_RETRIES,
    }),
    false,
  );
  assert.equal(
    shouldRetryEventProbe({
      mode: "event-probe",
      run: null,
      hadTrackedActiveRun: true,
      retryCount: 0,
    }),
    false,
  );
});

test("shouldIgnoreActiveRunSyncResult ignores stale async results after session change", () => {
  assert.equal(
    shouldIgnoreActiveRunSyncResult({
      requestedSessionId: "session-1",
      currentSessionId: "session-2",
      requestedProjectId: "project-1",
      currentProjectId: "project-1",
    }),
    true,
  );
});

test("buildActiveRunSyncPlan keeps active run when server still reports it", () => {
  const plan = buildActiveRunSyncPlan({
    mode: "active-poll",
    run: {
      id: "run-1",
      status: "running",
      chapterId: null,
    },
    hadTrackedActiveRun: true,
    localMessages: [],
    localChatTerminated: false,
  });

  assert.deepEqual(plan, {
    type: "set-active-run",
    run: {
      id: "run-1",
      status: "running",
      chapterId: null,
    },
  });
});

test("buildActiveRunSyncPlan clears run without restore during event probe miss", () => {
  const plan = buildActiveRunSyncPlan({
    mode: "event-probe",
    run: null,
    hadTrackedActiveRun: false,
    localMessages: [],
    localChatTerminated: false,
  });

  assert.deepEqual(plan, {
    type: "clear-run",
  });
});

test("buildActiveRunSyncPlan restores session after tracked run ends", () => {
  const plan = buildActiveRunSyncPlan({
    mode: "active-poll",
    run: null,
    hadTrackedActiveRun: true,
    restoredSession: {
      id: "session-1",
      messages: [{ id: "assistant-1", role: "assistant", parts: [{ type: "text", text: "done" }] }],
      chatTerminated: true,
    },
    localMessages: [{ id: "assistant-local", role: "assistant", parts: [{ type: "text", text: "partial" }] }],
    localChatTerminated: false,
  });

  assert.deepEqual(plan, {
    type: "restore-session",
    session: {
      id: "session-1",
      messages: [{ id: "assistant-1", role: "assistant", parts: [{ type: "text", text: "done" }] }],
      chatTerminated: true,
    },
    replaceMessages: true,
    replaceChatTerminated: true,
  });
});

test("buildActiveRunSyncPlan only replaces local snapshot when restored session differs", () => {
  const localMessages: UIMessage[] = [
    { id: "user-1", role: "user", parts: [{ type: "text", text: "hello" }] },
  ];
  const samePlan = buildActiveRunSyncPlan({
    mode: "initial",
    run: null,
    hadTrackedActiveRun: false,
    restoredSession: {
      id: "session-1",
      messages: localMessages,
      chatTerminated: false,
    },
    localMessages,
    localChatTerminated: false,
  });
  const differentPlan = buildActiveRunSyncPlan({
    mode: "initial",
    run: null,
    hadTrackedActiveRun: false,
    restoredSession: {
      id: "session-1",
        messages: [{ id: "user-1", role: "user", parts: [{ type: "text", text: "changed" }] } satisfies UIMessage],
        chatTerminated: true,
      },
    localMessages,
    localChatTerminated: false,
  });

  assert.equal(samePlan.type, "restore-session");
  assert.equal(samePlan.replaceMessages, false);
  assert.equal(samePlan.replaceChatTerminated, false);

  assert.equal(differentPlan.type, "restore-session");
  assert.equal(differentPlan.replaceMessages, true);
  assert.equal(differentPlan.replaceChatTerminated, true);
});
