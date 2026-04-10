import { z } from "zod";

import {
  createChapter,
  deleteChapter,
  getChapterById,
  listChapters,
  updateChapter,
} from "../repositories/chapter-repository.ts";
import {
  createVolume,
  deleteVolume,
  listVolumes,
  updateVolume,
} from "../repositories/volume-repository.ts";
import {
  createWork,
  deleteWork,
  listWorks,
  updateWork,
} from "../repositories/work-repository.ts";
import { deriveChapterMetrics } from "./workspace-metrics.ts";

const localeSchema = z.enum(["zh", "en", "ru"]);

const mutationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create-work"),
    title: z.string().min(1),
    locale: localeSchema,
    synopsis: z.string().default(""),
  }),
  z.object({
    action: z.literal("update-work"),
    workId: z.string().min(1),
    title: z.string().min(1).optional(),
    locale: localeSchema.optional(),
    synopsis: z.string().optional(),
  }),
  z.object({
    action: z.literal("delete-work"),
    workId: z.string().min(1),
  }),
  z.object({
    action: z.literal("create-volume"),
    workId: z.string().min(1),
    title: z.string().min(1),
  }),
  z.object({
    action: z.literal("update-volume"),
    volumeId: z.string().min(1),
    title: z.string().min(1).optional(),
    sortIndex: z.number().int().nonnegative().optional(),
  }),
  z.object({
    action: z.literal("delete-volume"),
    volumeId: z.string().min(1),
  }),
  z.object({
    action: z.literal("create-chapter"),
    workId: z.string().min(1),
    volumeId: z.string().min(1),
    title: z.string().min(1),
    bodyJson: z.string().default('{"type":"doc","content":[]}'),
  }),
  z.object({
    action: z.literal("update-chapter"),
    chapterId: z.string().min(1),
    title: z.string().min(1).optional(),
    volumeId: z.string().min(1).optional(),
    status: z.string().min(1).optional(),
  }),
  z.object({
    action: z.literal("delete-chapter"),
    chapterId: z.string().min(1),
  }),
  z.object({
    action: z.literal("autosave-chapter"),
    chapterId: z.string().min(1),
    title: z.string().min(1).optional(),
    bodyJson: z.string().min(1),
    status: z.string().min(1).optional(),
  }),
]);

export type WorkspaceMutation = z.infer<typeof mutationSchema>;

export function getWorkspaceCollections() {
  const works = listWorks();
  const activeWork = works[0];

  return {
    works,
    activeWork,
    volumes: activeWork ? listVolumes(activeWork.id) : [],
    chapters: activeWork ? listChapters(activeWork.id) : [],
  };
}

export function applyWorkspaceMutation(input: unknown) {
  const mutation = mutationSchema.parse(input);

  switch (mutation.action) {
    case "create-work":
      return { action: mutation.action, work: createWork(mutation) };
    case "update-work":
      return {
        action: mutation.action,
        work: updateWork(
          mutation.workId,
          Object.fromEntries(
            Object.entries({
              title: mutation.title,
              locale: mutation.locale,
              synopsis: mutation.synopsis,
            }).filter(([, value]) => value !== undefined),
          ),
        ),
      };
    case "delete-work":
      deleteWork(mutation.workId);
      return { action: mutation.action, deleted: mutation.workId };
    case "create-volume":
      return { action: mutation.action, volume: createVolume(mutation) };
    case "update-volume":
      return {
        action: mutation.action,
        volume: updateVolume(
          mutation.volumeId,
          Object.fromEntries(
            Object.entries({
              title: mutation.title,
              sortIndex: mutation.sortIndex,
            }).filter(([, value]) => value !== undefined),
          ),
        ),
      };
    case "delete-volume":
      deleteVolume(mutation.volumeId);
      return { action: mutation.action, deleted: mutation.volumeId };
    case "create-chapter": {
      const metrics = deriveChapterMetrics(mutation.bodyJson);
      return {
        action: mutation.action,
        chapter: createChapter({
          ...mutation,
          ...metrics,
        }),
      };
    }
    case "update-chapter":
      return {
        action: mutation.action,
        chapter: updateChapter(
          mutation.chapterId,
          Object.fromEntries(
            Object.entries({
              title: mutation.title,
              volumeId: mutation.volumeId,
              status: mutation.status,
            }).filter(([, value]) => value !== undefined),
          ),
        ),
      };
    case "delete-chapter":
      deleteChapter(mutation.chapterId);
      return { action: mutation.action, deleted: mutation.chapterId };
    case "autosave-chapter": {
      const current = getChapterById(mutation.chapterId);

      if (!current) {
        throw new Error(`Unknown chapter: ${mutation.chapterId}`);
      }

      const metrics = deriveChapterMetrics(mutation.bodyJson);
      return {
        action: mutation.action,
        chapter: updateChapter(mutation.chapterId, {
          title: mutation.title ?? current.title,
          bodyJson: mutation.bodyJson,
          plaintext: metrics.plaintext,
          excerpt: metrics.excerpt,
          wordCount: metrics.wordCount,
          characterCount: metrics.characterCount,
          readingMinutes: metrics.readingMinutes,
          status: mutation.status ?? current.status,
          lastAutosavedAt: new Date().toISOString(),
        }),
      };
    }
  }
}

export function getPersistenceSnapshot() {
  return getWorkspaceCollections();
}
