import { runInTransaction } from "@/db/client";
import type { ChapterPatch, ChapterRecord } from "@/repositories/chapters-repository";
import { ChaptersRepository } from "@/repositories/chapters-repository";
import {
  parseProjectSnapshotPayload,
  ProjectSnapshotsRepository,
  type ProjectSnapshotParsedRecord,
  type ProjectSnapshotRecord,
  type SnapshotChapterPayload,
} from "@/repositories/project-snapshots-repository";
import { ProjectsRepository } from "@/repositories/projects-repository";

import { buildSimplifiedTextDiff, type SimplifiedTextDiffLine } from "./text-diff";

export const DEFAULT_AUTO_SNAPSHOT_INTERVAL_MS = 10 * 60 * 1000;
export const DEFAULT_AUTO_SNAPSHOT_MILESTONE_CHARS = 500;

type SnapshotRowPort = Pick<
  ProjectSnapshotRecord,
  "id" | "triggerType" | "triggerReason" | "createdAt" | "chapterCount" | "timelineEventCount"
>;

export type SnapshotCreateResult = {
  snapshot: ProjectSnapshotRecord;
};

export type SnapshotRestoreResult = {
  restoredFromSnapshotId: string;
  backupSnapshotId: string;
  restoredSnapshotId: string;
  restoredChapterCount: number;
  restoredEntityCount: number;
  restoredEventCount: number;
  restoredEventEntityCount: number;
};

export type ChapterSnapshotDiff = {
  chapterId: string;
  chapterTitleBefore: string | null;
  chapterTitleAfter: string | null;
  orderNoBefore: number | null;
  orderNoAfter: number | null;
  changeType: "added" | "removed" | "modified" | "unchanged";
  diffLines: SimplifiedTextDiffLine[];
};

export type TimelineSnapshotDiff = {
  beforeSummary: string;
  afterSummary: string;
  beforeEventCount: number;
  afterEventCount: number;
  diffLines: SimplifiedTextDiffLine[];
};

export type SnapshotDiffResult = {
  beforeSnapshot: SnapshotRowPort;
  afterSnapshot: SnapshotRowPort;
  chapters: ChapterSnapshotDiff[];
  timeline: TimelineSnapshotDiff;
};

export type SaveChapterWithSnapshotResult = {
  chapter: ChapterRecord | null;
  autoSnapshot: {
    created: boolean;
    snapshotId: string | null;
    reason: string;
    elapsedMs: number | null;
    deltaChars: number;
  };
};

function buildChapterSnapshotText(chapter: SnapshotChapterPayload | null): string {
  if (!chapter) {
    return "";
  }

  return [chapter.title, chapter.content, chapter.summary ?? ""].join("\n");
}

function normalizeReason(rawReason: string | null | undefined): string {
  const trimmed = typeof rawReason === "string" ? rawReason.trim() : "";
  return trimmed.length > 0 ? trimmed : "manual_snapshot";
}

function compactSnapshotRow(snapshot: ProjectSnapshotRecord): SnapshotRowPort {
  return {
    id: snapshot.id,
    triggerType: snapshot.triggerType,
    triggerReason: snapshot.triggerReason,
    createdAt: snapshot.createdAt,
    chapterCount: snapshot.chapterCount,
    timelineEventCount: snapshot.timelineEventCount,
  };
}

export class ProjectSnapshotsService {
  listSnapshots(projectId: string, limit?: number): ProjectSnapshotRecord[] {
    const snapshotsRepository = new ProjectSnapshotsRepository();
    return snapshotsRepository.listByProject(projectId, limit ?? 20);
  }

  createManualSnapshot(projectId: string, reason?: string): SnapshotCreateResult {
    return runInTransaction((tx) => {
      const projectsRepository = new ProjectsRepository(tx);
      const snapshotsRepository = new ProjectSnapshotsRepository(tx);
      const project = projectsRepository.findById(projectId);
      if (!project) {
        throw new Error("project not found");
      }

      const snapshot = snapshotsRepository.createFromCurrentState({
        projectId,
        triggerType: "manual",
        triggerReason: normalizeReason(reason),
      });
      return { snapshot };
    });
  }

  saveChapterWithAutoSnapshot(
    chapterId: string,
    patch: ChapterPatch,
    options?: {
      intervalMs?: number;
      milestoneChars?: number;
    },
  ): SaveChapterWithSnapshotResult {
    return runInTransaction((tx) => {
      const chaptersRepository = new ChaptersRepository(tx);
      const snapshotsRepository = new ProjectSnapshotsRepository(tx);

      const chapter = chaptersRepository.updateAndGet(chapterId, patch);
      if (!chapter) {
        return {
          chapter: null,
          autoSnapshot: {
            created: false,
            snapshotId: null,
            reason: "chapter_not_found",
            elapsedMs: null,
            deltaChars: 0,
          },
        };
      }

      const autoDecision = snapshotsRepository.evaluateAutoSnapshotPolicy({
        projectId: chapter.projectId,
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        chapterContent: chapter.content ?? "",
        chapterSummary: chapter.summary ?? null,
        intervalMs: options?.intervalMs ?? DEFAULT_AUTO_SNAPSHOT_INTERVAL_MS,
        milestoneChars: options?.milestoneChars ?? DEFAULT_AUTO_SNAPSHOT_MILESTONE_CHARS,
      });

      if (!autoDecision.shouldCreate) {
        return {
          chapter,
          autoSnapshot: {
            created: false,
            snapshotId: null,
            reason: autoDecision.reason,
            elapsedMs: autoDecision.elapsedMs,
            deltaChars: autoDecision.deltaChars,
          },
        };
      }

      const triggerReason = [
        autoDecision.reason,
        `elapsedMs=${autoDecision.elapsedMs ?? -1}`,
        `deltaChars=${autoDecision.deltaChars}`,
      ].join("|");
      const snapshot = snapshotsRepository.createFromCurrentState({
        projectId: chapter.projectId,
        triggerType: "auto",
        triggerReason,
        sourceChapterId: chapter.id,
      });

      return {
        chapter,
        autoSnapshot: {
          created: true,
          snapshotId: snapshot.id,
          reason: autoDecision.reason,
          elapsedMs: autoDecision.elapsedMs,
          deltaChars: autoDecision.deltaChars,
        },
      };
    });
  }

  restoreSnapshot(projectId: string, snapshotId: string, reason?: string): SnapshotRestoreResult {
    return runInTransaction((tx) => {
      const projectsRepository = new ProjectsRepository(tx);
      const snapshotsRepository = new ProjectSnapshotsRepository(tx);

      const project = projectsRepository.findById(projectId);
      if (!project) {
        throw new Error("project not found");
      }

      const targetSnapshot = snapshotsRepository.findWithPayload(projectId, snapshotId);
      if (!targetSnapshot) {
        throw new Error("snapshot not found");
      }

      const backupSnapshot = snapshotsRepository.createFromCurrentState({
        projectId,
        triggerType: "manual",
        triggerReason: `pre_restore_backup|from=${snapshotId}`,
      });

      const restoreResult = snapshotsRepository.restoreProjectState(projectId, targetSnapshot.payload);
      const restoredSnapshot = snapshotsRepository.createFromCurrentState({
        projectId,
        triggerType: "restore",
        triggerReason: normalizeReason(reason),
        sourceSnapshotId: snapshotId,
      });

      return {
        restoredFromSnapshotId: snapshotId,
        backupSnapshotId: backupSnapshot.id,
        restoredSnapshotId: restoredSnapshot.id,
        restoredChapterCount: restoreResult.restoredChapterCount,
        restoredEntityCount: restoreResult.restoredEntityCount,
        restoredEventCount: restoreResult.restoredEventCount,
        restoredEventEntityCount: restoreResult.restoredEventEntityCount,
      };
    });
  }

  diffSnapshots(
    projectId: string,
    snapshotId: string,
    options?: {
      againstSnapshotId?: string;
      includeUnchangedChapters?: boolean;
    },
  ): SnapshotDiffResult {
    const snapshotsRepository = new ProjectSnapshotsRepository();
    const afterSnapshot = snapshotsRepository.findWithPayload(projectId, snapshotId);
    if (!afterSnapshot) {
      throw new Error("snapshot not found");
    }

    const beforeSnapshot = options?.againstSnapshotId
      ? snapshotsRepository.findWithPayload(projectId, options.againstSnapshotId)
      : this.findPreviousSnapshotWithPayload(snapshotsRepository, projectId, snapshotId);
    if (!beforeSnapshot) {
      throw new Error("baseline snapshot not found");
    }

    return this.buildSnapshotDiff(beforeSnapshot, afterSnapshot, options?.includeUnchangedChapters ?? false);
  }

  private findPreviousSnapshotWithPayload(
    snapshotsRepository: ProjectSnapshotsRepository,
    projectId: string,
    snapshotId: string,
  ): ProjectSnapshotParsedRecord | null {
    const previousSnapshot = snapshotsRepository.findPreviousBySnapshot(projectId, snapshotId);
    if (!previousSnapshot) {
      return null;
    }

    return {
      snapshot: previousSnapshot,
      payload: parseProjectSnapshotPayload(previousSnapshot.payload),
    };
  }

  private buildSnapshotDiff(
    beforeSnapshot: ProjectSnapshotParsedRecord,
    afterSnapshot: ProjectSnapshotParsedRecord,
    includeUnchangedChapters: boolean,
  ): SnapshotDiffResult {
    const beforeChaptersById = new Map(
      beforeSnapshot.payload.chapters.map((chapter) => [chapter.id, chapter] as const),
    );
    const afterChaptersById = new Map(
      afterSnapshot.payload.chapters.map((chapter) => [chapter.id, chapter] as const),
    );
    const chapterIds = [...new Set([...beforeChaptersById.keys(), ...afterChaptersById.keys()])];

    const chapterDiffs: ChapterSnapshotDiff[] = [];
    for (const chapterId of chapterIds) {
      const beforeChapter = beforeChaptersById.get(chapterId) ?? null;
      const afterChapter = afterChaptersById.get(chapterId) ?? null;

      if (!beforeChapter && afterChapter) {
        chapterDiffs.push({
          chapterId,
          chapterTitleBefore: null,
          chapterTitleAfter: afterChapter.title,
          orderNoBefore: null,
          orderNoAfter: afterChapter.orderNo,
          changeType: "added",
          diffLines: buildSimplifiedTextDiff("", buildChapterSnapshotText(afterChapter)),
        });
        continue;
      }
      if (beforeChapter && !afterChapter) {
        chapterDiffs.push({
          chapterId,
          chapterTitleBefore: beforeChapter.title,
          chapterTitleAfter: null,
          orderNoBefore: beforeChapter.orderNo,
          orderNoAfter: null,
          changeType: "removed",
          diffLines: buildSimplifiedTextDiff(buildChapterSnapshotText(beforeChapter), ""),
        });
        continue;
      }
      if (!beforeChapter || !afterChapter) {
        continue;
      }

      const beforeText = buildChapterSnapshotText(beforeChapter);
      const afterText = buildChapterSnapshotText(afterChapter);
      const isUnchanged = beforeText === afterText;
      if (isUnchanged && !includeUnchangedChapters) {
        continue;
      }

      chapterDiffs.push({
        chapterId,
        chapterTitleBefore: beforeChapter.title,
        chapterTitleAfter: afterChapter.title,
        orderNoBefore: beforeChapter.orderNo,
        orderNoAfter: afterChapter.orderNo,
        changeType: isUnchanged ? "unchanged" : "modified",
        diffLines: isUnchanged ? [{ op: "equal", text: beforeText }] : buildSimplifiedTextDiff(beforeText, afterText),
      });
    }

    chapterDiffs.sort((left, right) => {
        const orderLeft = left.orderNoAfter ?? left.orderNoBefore ?? Number.MAX_SAFE_INTEGER;
        const orderRight = right.orderNoAfter ?? right.orderNoBefore ?? Number.MAX_SAFE_INTEGER;
        if (orderLeft !== orderRight) {
          return orderLeft - orderRight;
        }
        return left.chapterId.localeCompare(right.chapterId);
      });

    const timelineBeforeSummary = beforeSnapshot.payload.timeline.summary;
    const timelineAfterSummary = afterSnapshot.payload.timeline.summary;

    return {
      beforeSnapshot: compactSnapshotRow(beforeSnapshot.snapshot),
      afterSnapshot: compactSnapshotRow(afterSnapshot.snapshot),
      chapters: chapterDiffs,
      timeline: {
        beforeSummary: timelineBeforeSummary,
        afterSummary: timelineAfterSummary,
        beforeEventCount: beforeSnapshot.payload.timeline.eventCount,
        afterEventCount: afterSnapshot.payload.timeline.eventCount,
        diffLines: buildSimplifiedTextDiff(timelineBeforeSummary, timelineAfterSummary),
      },
    };
  }
}
