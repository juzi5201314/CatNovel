"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  type TimelineEventEditInput,
  type TimelineEventItem,
  useTimelineStore,
} from "@/stores/timeline-store";

type TimelinePanelProps = {
  projectId: string | null;
  chapterId: string | null;
};

type EditDraft = {
  title: string;
  description: string;
  chapterNo: string;
  confidence: string;
};

type ChapterGroup = {
  chapterNo: number;
  events: TimelineEventItem[];
};

function statusLabel(status: TimelineEventItem["status"]): string {
  if (status === "confirmed") {
    return "已确认";
  }
  if (status === "pending_review") {
    return "待人工审核";
  }
  if (status === "rejected") {
    return "已拒绝";
  }
  return "待审核";
}

function chapterLabel(chapterNo: number): string {
  return chapterNo > 0 ? `第 ${chapterNo} 章` : "未标注章节";
}

function toDraft(event: TimelineEventItem): EditDraft {
  return {
    title: event.title,
    description: event.description,
    chapterNo: String(event.chapterNo),
    confidence: event.confidence.toFixed(2),
  };
}

function parseEditPayload(draft: EditDraft): { payload: TimelineEventEditInput | null; error: string | null } {
  const title = draft.title.trim();
  if (!title) {
    return {
      payload: null,
      error: "标题不能为空",
    };
  }

  const chapterNoRaw = draft.chapterNo.trim();
  const confidenceRaw = draft.confidence.trim();

  const payload: TimelineEventEditInput = {
    title,
    description: draft.description.trim(),
  };

  if (chapterNoRaw.length > 0) {
    const chapterNo = Number(chapterNoRaw);
    if (!Number.isFinite(chapterNo) || chapterNo < 1) {
      return {
        payload: null,
        error: "章节号必须是大于等于 1 的数字",
      };
    }
    payload.chapterNo = Math.trunc(chapterNo);
  }

  if (confidenceRaw.length > 0) {
    const confidence = Number(confidenceRaw);
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
      return {
        payload: null,
        error: "置信度需在 0 到 1 之间",
      };
    }
    payload.confidence = confidence;
  }

  return { payload, error: null };
}

function groupEventsByChapter(events: TimelineEventItem[]): ChapterGroup[] {
  const map = new Map<number, TimelineEventItem[]>();
  for (const event of events) {
    const chapterNo = event.chapterNo;
    const list = map.get(chapterNo);
    if (list) {
      list.push(event);
    } else {
      map.set(chapterNo, [event]);
    }
  }

  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([chapterNo, chapterEvents]) => ({
      chapterNo,
      events: chapterEvents,
    }));
}

export function TimelinePanel({ projectId, chapterId }: TimelinePanelProps) {
  const entities = useTimelineStore((state) => state.entities);
  const selectedEntityId = useTimelineStore((state) => state.selectedEntityId);
  const selectedEntity = useTimelineStore((state) => state.selectedEntity);
  const loadingEntities = useTimelineStore((state) => state.loadingEntities);
  const loadingEntityDetail = useTimelineStore((state) => state.loadingEntityDetail);
  const extracting = useTimelineStore((state) => state.extracting);
  const busyEventId = useTimelineStore((state) => state.busyEventId);
  const reviewThreshold = useTimelineStore((state) => state.reviewThreshold);
  const error = useTimelineStore((state) => state.error);
  const notice = useTimelineStore((state) => state.notice);

  const initialize = useTimelineStore((state) => state.initialize);
  const fetchEntities = useTimelineStore((state) => state.fetchEntities);
  const selectEntity = useTimelineStore((state) => state.selectEntity);
  const extractTimeline = useTimelineStore((state) => state.extractTimeline);
  const confirmEvent = useTimelineStore((state) => state.confirmEvent);
  const rejectEvent = useTimelineStore((state) => state.rejectEvent);
  const editEvent = useTimelineStore((state) => state.editEvent);
  const clearError = useTimelineStore((state) => state.clearError);
  const clearNotice = useTimelineStore((state) => state.clearNotice);

  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    void initialize(projectId);
  }, [initialize, projectId]);

  const timelineEvents = useMemo(() => selectedEntity?.events ?? [], [selectedEntity]);

  const chapterGroups = useMemo(
    () => groupEventsByChapter(timelineEvents),
    [timelineEvents],
  );

  const reviewEvents = useMemo(
    () =>
      timelineEvents.filter(
        (event) =>
          event.status === "pending_review" ||
          (event.status === "auto" && event.confidence < reviewThreshold),
      ),
    [timelineEvents, reviewThreshold],
  );

  function handleStartEdit(event: TimelineEventItem) {
    setEditingEventId(event.id);
    setEditDraft(toDraft(event));
    setEditError(null);
  }

  async function handleSubmitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingEventId || !editDraft) {
      return;
    }

    const parsed = parseEditPayload(editDraft);
    if (!parsed.payload) {
      setEditError(parsed.error);
      return;
    }

    await editEvent(editingEventId, parsed.payload);

    if (!useTimelineStore.getState().error) {
      setEditingEventId(null);
      setEditDraft(null);
      setEditError(null);
    }
  }

  return (
    <article className="cn-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="cn-card-title">实体时间线</h3>
        <span className="rounded-full border border-[var(--cn-border)] px-2 py-0.5 text-xs text-[var(--cn-text-secondary)]">
          实体 {entities.length}
        </span>
      </div>
      <p className="cn-card-description">
        章节上下文：{chapterId ? `已选章节 ${chapterId}` : "未选章节（可全量抽取）"}
      </p>

      {!projectId ? (
        <p className="cn-card-description">请选择项目后查看并审核时间线。</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void fetchEntities()}
            disabled={loadingEntities || loadingEntityDetail}
          >
            {loadingEntities ? "刷新中..." : "刷新"}
          </button>
          <button
            type="button"
            onClick={() => void extractTimeline(chapterId)}
            disabled={extracting}
          >
            {extracting ? "抽取中..." : chapterId ? "抽取当前章节" : "全量抽取"}
          </button>
        </div>
      )}

      {error ? (
        <div className="mt-2 rounded-md border border-red-200 bg-red-50 p-2">
          <p className="text-sm text-red-700">{error}</p>
          <button type="button" className="mt-2" onClick={clearError}>
            关闭
          </button>
        </div>
      ) : null}

      {notice ? (
        <div className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 p-2">
          <p className="text-sm text-emerald-700">{notice}</p>
          <button type="button" className="mt-2" onClick={clearNotice}>
            知道了
          </button>
        </div>
      ) : null}

      <section className="mt-3 rounded-md border border-[var(--cn-border)] p-3">
        <p className="text-xs text-[var(--cn-text-secondary)]">实体列表</p>
        {loadingEntities ? <p className="cn-card-description">加载中...</p> : null}
        <ul className="mt-2 flex max-h-44 flex-col gap-2 overflow-y-auto pr-1">
          {entities.map((entity) => (
            <li key={entity.id}>
              <button
                type="button"
                className="w-full text-left"
                aria-current={entity.id === selectedEntityId}
                onClick={() => {
                  setEditingEventId(null);
                  setEditDraft(null);
                  setEditError(null);
                  void selectEntity(entity.id);
                }}
              >
                <span className="block text-sm font-semibold text-[var(--cn-text-primary)]">
                  {entity.name}
                </span>
                <span className="block text-xs text-[var(--cn-text-secondary)]">
                  事件 {entity.eventCount} · 待审核 {entity.pendingReviewCount}
                </span>
              </button>
            </li>
          ))}
          {entities.length === 0 && !loadingEntities ? (
            <li>
              <p className="cn-card-description">暂无实体</p>
            </li>
          ) : null}
        </ul>
      </section>

      <section className="mt-3 rounded-md border border-[var(--cn-border)] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-[var(--cn-text-primary)]">
            {selectedEntity ? selectedEntity.entity.name : "实体详情"}
          </p>
          <span className="text-xs text-[var(--cn-text-secondary)]">
            {selectedEntity?.entity.type ?? "未分类"}
          </span>
        </div>

        {selectedEntity?.entity.aliases.length ? (
          <p className="mt-1 text-xs text-[var(--cn-text-secondary)]">
            别名：{selectedEntity.entity.aliases.join(" / ")}
          </p>
        ) : null}

        {!selectedEntity && !loadingEntityDetail ? (
          <p className="cn-card-description">请选择一个实体查看时间线。</p>
        ) : null}
        {loadingEntityDetail ? <p className="cn-card-description">详情加载中...</p> : null}

        {chapterGroups.length > 0 ? (
          <ul className="mt-3 flex max-h-80 flex-col gap-3 overflow-y-auto pr-1">
            {chapterGroups.map((group) => (
              <li key={group.chapterNo}>
                <p className="text-xs font-semibold text-[var(--cn-text-secondary)]">
                  {chapterLabel(group.chapterNo)}
                </p>
                <ul className="mt-1 flex flex-col gap-2">
                  {group.events.map((event) => {
                    const needsReview =
                      event.status === "pending_review" ||
                      (event.status === "auto" && event.confidence < reviewThreshold);
                    return (
                      <li
                        key={event.id}
                        className={[
                          "rounded-md border p-2",
                          needsReview
                            ? "border-amber-300 bg-amber-50"
                            : "border-[var(--cn-border)] bg-white",
                        ].join(" ")}
                      >
                        <p className="text-sm font-semibold text-[var(--cn-text-primary)]">
                          {event.title}
                        </p>
                        {event.description ? (
                          <p className="mt-1 text-xs text-[var(--cn-text-secondary)]">
                            {event.description}
                          </p>
                        ) : null}
                        <p className="mt-1 text-xs text-[var(--cn-text-secondary)]">
                          状态：{statusLabel(event.status)} · 置信度：
                          {Math.round(event.confidence * 100)}%
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="mt-3 rounded-md border border-[var(--cn-border)] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-[var(--cn-text-primary)]">低置信度审核</p>
          <span className="text-xs text-[var(--cn-text-secondary)]">
            待处理 {reviewEvents.length}
          </span>
        </div>

        {reviewEvents.length === 0 ? (
          <p className="cn-card-description">当前没有低置信度事件。</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {reviewEvents.map((event) => {
              const isEditing = editingEventId === event.id && editDraft !== null;
              const isBusy = busyEventId === event.id;

              return (
                <li
                  key={event.id}
                  className="rounded-md border border-amber-300 bg-amber-50 p-2"
                >
                  {!isEditing ? (
                    <>
                      <p className="text-sm font-semibold text-[var(--cn-text-primary)]">
                        {event.title}
                      </p>
                      {event.description ? (
                        <p className="mt-1 text-xs text-[var(--cn-text-secondary)]">
                          {event.description}
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs text-[var(--cn-text-secondary)]">
                        {chapterLabel(event.chapterNo)} · 置信度：
                        {Math.round(event.confidence * 100)}%
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void confirmEvent(event.id)}
                          disabled={Boolean(busyEventId)}
                        >
                          {isBusy ? "处理中..." : "确认"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void rejectEvent(event.id)}
                          disabled={Boolean(busyEventId)}
                        >
                          {isBusy ? "处理中..." : "拒绝"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStartEdit(event)}
                          disabled={Boolean(busyEventId)}
                        >
                          编辑
                        </button>
                      </div>
                    </>
                  ) : (
                    <form className="flex flex-col gap-2" onSubmit={handleSubmitEdit}>
                      <label>
                        <span className="text-xs text-[var(--cn-text-secondary)]">标题</span>
                        <input
                          value={editDraft.title}
                          onChange={(inputEvent) =>
                            setEditDraft((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    title: inputEvent.target.value,
                                  }
                                : prev,
                            )
                          }
                        />
                      </label>
                      <label>
                        <span className="text-xs text-[var(--cn-text-secondary)]">描述</span>
                        <textarea
                          rows={3}
                          value={editDraft.description}
                          onChange={(inputEvent) =>
                            setEditDraft((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    description: inputEvent.target.value,
                                  }
                                : prev,
                            )
                          }
                          className="rounded-md border border-[var(--cn-border)] p-2 text-sm"
                        />
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <label>
                          <span className="text-xs text-[var(--cn-text-secondary)]">章节号</span>
                          <input
                            value={editDraft.chapterNo}
                            onChange={(inputEvent) =>
                              setEditDraft((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      chapterNo: inputEvent.target.value,
                                    }
                                  : prev,
                              )
                            }
                          />
                        </label>
                        <label>
                          <span className="text-xs text-[var(--cn-text-secondary)]">置信度</span>
                          <input
                            value={editDraft.confidence}
                            onChange={(inputEvent) =>
                              setEditDraft((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      confidence: inputEvent.target.value,
                                    }
                                  : prev,
                              )
                            }
                          />
                        </label>
                      </div>
                      {editError ? <p className="text-xs text-red-700">{editError}</p> : null}
                      <div className="flex flex-wrap gap-2">
                        <button type="submit" disabled={Boolean(busyEventId)}>
                          {isBusy ? "保存中..." : "保存"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingEventId(null);
                            setEditDraft(null);
                            setEditError(null);
                          }}
                          disabled={Boolean(busyEventId)}
                        >
                          取消
                        </button>
                      </div>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </article>
  );
}
