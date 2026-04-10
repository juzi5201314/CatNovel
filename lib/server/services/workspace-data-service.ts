import { z } from 'zod';

import type {
  ChatRole,
  SettingNodeType,
  WorkspaceCollections,
  WorkspaceLocale,
} from '../../contracts/workspace.ts';
import {
  appendChatMessage,
  createChatSession,
  deleteChatSession,
  listChatMessages,
  listChatSessions,
  updateChatSession,
} from '../repositories/chat-repository.ts';
import {
  createChapter,
  deleteChapter,
  getChapterById,
  listChapters,
  updateChapter,
} from '../repositories/chapter-repository.ts';
import {
  listProviderProfiles,
} from '../repositories/provider-repository.ts';
import {
  createSettingNode,
  deleteSettingNode,
  getBookMetadata,
  listSettingsNodes,
  updateBookMetadata,
  updateSettingNode,
} from '../repositories/settings-repository.ts';
import {
  createVolume,
  deleteVolume,
  listVolumes,
  updateVolume,
} from '../repositories/volume-repository.ts';
import {
  createWork,
  deleteWork,
  listWorks,
  updateWork,
} from '../repositories/work-repository.ts';
import { deriveChapterMetrics } from './workspace-metrics.ts';

const localeSchema = z.enum(['zh', 'en', 'ru']);
const roleSchema = z.enum(['system', 'user', 'assistant']);
const settingNodeTypeSchema = z.enum([
  'character',
  'location',
  'item',
  'world',
  'plot',
  'rule',
]);

const mutationSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create-work'),
    title: z.string().min(1),
    locale: localeSchema,
    synopsis: z.string().default(''),
  }),
  z.object({
    action: z.literal('update-work'),
    workId: z.string().min(1),
    title: z.string().min(1).optional(),
    locale: localeSchema.optional(),
    synopsis: z.string().optional(),
  }),
  z.object({
    action: z.literal('delete-work'),
    workId: z.string().min(1),
  }),
  z.object({
    action: z.literal('create-volume'),
    workId: z.string().min(1),
    title: z.string().min(1),
  }),
  z.object({
    action: z.literal('update-volume'),
    volumeId: z.string().min(1),
    title: z.string().min(1).optional(),
    sortIndex: z.number().int().nonnegative().optional(),
  }),
  z.object({
    action: z.literal('delete-volume'),
    volumeId: z.string().min(1),
  }),
  z.object({
    action: z.literal('create-chapter'),
    workId: z.string().min(1),
    volumeId: z.string().min(1),
    title: z.string().min(1),
    bodyJson: z.string().default('{"type":"doc","content":[]}'),
  }),
  z.object({
    action: z.literal('update-chapter'),
    chapterId: z.string().min(1),
    title: z.string().min(1).optional(),
    volumeId: z.string().min(1).optional(),
    status: z.string().min(1).optional(),
  }),
  z.object({
    action: z.literal('delete-chapter'),
    chapterId: z.string().min(1),
  }),
  z.object({
    action: z.literal('autosave-chapter'),
    chapterId: z.string().min(1),
    title: z.string().min(1).optional(),
    bodyJson: z.string().min(1),
    status: z.string().min(1).optional(),
  }),
  z.object({
    action: z.literal('create-setting-node'),
    workId: z.string().min(1),
    nodeType: settingNodeTypeSchema,
    title: z.string().min(1),
    parentId: z.string().min(1).nullable().optional(),
    payloadJson: z.string().optional(),
  }),
  z.object({
    action: z.literal('update-setting-node'),
    nodeId: z.string().min(1),
    title: z.string().min(1).optional(),
    nodeType: settingNodeTypeSchema.optional(),
    parentId: z.string().min(1).nullable().optional(),
    payloadJson: z.string().optional(),
  }),
  z.object({
    action: z.literal('delete-setting-node'),
    nodeId: z.string().min(1),
  }),
  z.object({
    action: z.literal('update-book-metadata'),
    workId: z.string().min(1),
    authorName: z.string().optional(),
    premise: z.string().optional(),
    targetReaders: z.string().optional(),
    serializedStatus: z.string().optional(),
    tagsJson: z.string().optional(),
  }),
  z.object({
    action: z.literal('create-chat-session'),
    workId: z.string().min(1),
    title: z.string().min(1),
  }),
  z.object({
    action: z.literal('update-chat-session'),
    sessionId: z.string().min(1),
    title: z.string().min(1),
  }),
  z.object({
    action: z.literal('delete-chat-session'),
    sessionId: z.string().min(1),
  }),
  z.object({
    action: z.literal('append-chat-message'),
    sessionId: z.string().min(1),
    role: roleSchema,
    body: z.string().min(1),
    tokenCount: z.number().int().nonnegative().optional(),
  }),
]);

type ContextSelection = {
  workId?: string;
  sessionId?: string;
};

export type WorkspaceMutation = z.infer<typeof mutationSchema>;

export function getWorkspaceCollections(context: ContextSelection = {}): WorkspaceCollections {
  const works = listWorks();
  const activeWork =
    works.find((work) => work.id === context.workId) ??
    works[0] ??
    null;

  if (!activeWork) {
    return {
      works: [],
      activeWorkId: null,
      volumes: [],
      chapters: [],
      settingsNodes: [],
      bookMetadata: null,
      providerProfiles: [],
      chatSessions: [],
      activeSessionId: null,
      chatMessages: [],
    };
  }

  const volumes = listVolumes(activeWork.id);
  const chapters = listChapters(activeWork.id);
  const settingsNodes = listSettingsNodes(activeWork.id);
  const bookMetadata = getBookMetadata(activeWork.id);
  const providerProfiles = listProviderProfiles(activeWork.id);
  const chatSessions = listChatSessions(activeWork.id);
  const activeSession =
    chatSessions.find((session) => session.id === context.sessionId) ??
    chatSessions[0] ??
    null;

  return {
    works,
    activeWorkId: activeWork.id,
    volumes,
    chapters,
    settingsNodes,
    bookMetadata,
    providerProfiles,
    chatSessions,
    activeSessionId: activeSession?.id ?? null,
    chatMessages: activeSession ? listChatMessages(activeSession.id) : [],
  };
}

export function applyWorkspaceMutation(input: unknown) {
  const mutation = mutationSchema.parse(input);

  switch (mutation.action) {
    case 'create-work':
      return { action: mutation.action, work: createWork(mutation) };
    case 'update-work':
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
          ) as Partial<{
            title: string;
            locale: WorkspaceLocale;
            synopsis: string;
          }>,
        ),
      };
    case 'delete-work':
      deleteWork(mutation.workId);
      return { action: mutation.action, deleted: mutation.workId };
    case 'create-volume':
      return { action: mutation.action, volume: createVolume(mutation) };
    case 'update-volume':
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
    case 'delete-volume':
      deleteVolume(mutation.volumeId);
      return { action: mutation.action, deleted: mutation.volumeId };
    case 'create-chapter': {
      const metrics = deriveChapterMetrics(mutation.bodyJson);
      return {
        action: mutation.action,
        chapter: createChapter({
          ...mutation,
          ...metrics,
        }),
      };
    }
    case 'update-chapter':
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
    case 'delete-chapter':
      deleteChapter(mutation.chapterId);
      return { action: mutation.action, deleted: mutation.chapterId };
    case 'autosave-chapter': {
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
    case 'create-setting-node':
      return {
        action: mutation.action,
        settingNode: createSettingNode({
          workId: mutation.workId,
          nodeType: mutation.nodeType as SettingNodeType,
          title: mutation.title,
          parentId: mutation.parentId ?? null,
          payloadJson: mutation.payloadJson,
        }),
      };
    case 'update-setting-node':
      return {
        action: mutation.action,
        settingNode: updateSettingNode(mutation.nodeId, {
          title: mutation.title,
          nodeType: mutation.nodeType as SettingNodeType | undefined,
          parentId: mutation.parentId,
          payloadJson: mutation.payloadJson,
        }),
      };
    case 'delete-setting-node':
      deleteSettingNode(mutation.nodeId);
      return { action: mutation.action, deleted: mutation.nodeId };
    case 'update-book-metadata':
      return {
        action: mutation.action,
        bookMetadata: updateBookMetadata(mutation.workId, {
          authorName: mutation.authorName,
          premise: mutation.premise,
          targetReaders: mutation.targetReaders,
          serializedStatus: mutation.serializedStatus,
          tagsJson: mutation.tagsJson,
        }),
      };
    case 'create-chat-session':
      return {
        action: mutation.action,
        session: createChatSession({
          workId: mutation.workId,
          title: mutation.title,
        }),
      };
    case 'update-chat-session':
      return {
        action: mutation.action,
        session: updateChatSession(mutation.sessionId, mutation.title),
      };
    case 'delete-chat-session':
      return {
        action: mutation.action,
        session: deleteChatSession(mutation.sessionId),
      };
    case 'append-chat-message':
      return {
        action: mutation.action,
        message: appendChatMessage({
          sessionId: mutation.sessionId,
          role: mutation.role as ChatRole,
          body: mutation.body,
          tokenCount: mutation.tokenCount,
        }),
      };
  }
}

export function getPersistenceSnapshot(context: ContextSelection = {}) {
  return getWorkspaceCollections(context);
}
