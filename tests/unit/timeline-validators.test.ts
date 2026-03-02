import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeTimelineEvent,
  validatePatchTimelineEventInput,
  validateTimelineExtractInput,
} from "../../src/lib/http/timeline-validators.ts";

test("validateTimelineExtractInput rejects empty projectId", () => {
  const result = validateTimelineExtractInput({ projectId: " " });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "INVALID_INPUT");
  }
});

test("validatePatchTimelineEventInput accepts edit payload", () => {
  const result = validatePatchTimelineEventInput({
    action: "edit",
    payload: {
      title: "修订后的事件",
      confidence: 0.82,
    },
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.action, "edit");
    assert.equal(result.data.payload?.title, "修订后的事件");
  }
});

test("normalizeTimelineEvent supports snake_case and pendingReview status", () => {
  const event = normalizeTimelineEvent({
    event_id: "event_1",
    entity_id: "entity_1",
    chapter_order: 3,
    title: "事件标题",
    summary: "事件描述",
    confidence: 0.66,
    status: "pendingReview",
  });

  assert.ok(event);
  assert.equal(event?.eventId, "event_1");
  assert.equal(event?.entityId, "entity_1");
  assert.equal(event?.chapterNo, 3);
  assert.equal(event?.status, "pending_review");
});
