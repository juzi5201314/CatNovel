import { z } from 'zod';

import {
  settingNodeTypes,
  workspaceLocales,
  worldviewNodeTypes,
} from '../../contracts/workspace.ts';
import type {
  ActiveModelSelection,
  ChatRole,
  SettingNodeType,
  WorkspaceCollections,
  WorkspaceLocale,
} from '../../contracts/workspace.ts';
import {
  appendChatMessage,
  createChatSession,
  deleteChatMessage,
  deleteChatSession,
  listChatMessages,
  listChatSessions,
  updateChatSession,
} from '../repositories/chat-repository.ts';
import {
  upsertContextSelectionBySource,
} from '../repositories/context-selection-repository.ts';
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
  getActiveModelPreference,
  setActiveModelPreference,
} from '../ai/provider-registry.ts';
import {
  createSettingNode,
  deleteSettingNode,
  getBookMetadata,
  hasChildren,
  listSettingsNodes,
  moveSettingNode,
  reorderSiblings,
  updateBookMetadata,
  updateSettingNode,
  wouldCreateCycle,
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

const localeSchema = z.enum(workspaceLocales);
const roleSchema = z.enum(['system', 'user', 'assistant']);
const settingNodeTypeSchema = z.enum(settingNodeTypes);

const worldviewNodeTypeSchema = z.enum(worldviewNodeTypes);

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
    action: z.literal('create-worldview-node'),
    workId: z.string().min(1),
    nodeType: worldviewNodeTypeSchema,
    title: z.string().min(1),
    parentId: z.string().min(1).nullable().optional(),
    payloadJson: z.string().optional(),
  }),
  z.object({
    action: z.literal('move-worldview-node'),
    nodeId: z.string().min(1),
    parentId: z.string().min(1).nullable(),
  }),
  z.object({
    action: z.literal('reorder-worldview-siblings'),
    workId: z.string().min(1),
    parentId: z.string().min(1).nullable().optional(),
    orderedIds: z.array(z.string().min(1)),
  }),
  z.object({
    action: z.literal('convert-worldview-node'),
    nodeId: z.string().min(1),
    nodeType: worldviewNodeTypeSchema,
    payloadJson: z.string().optional(),
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
    tps: z.number().nonnegative().optional(),
  }),
  z.object({
    action: z.literal('delete-chat-message'),
    messageId: z.string().min(1),
  }),
  z.object({
    action: z.literal('set-active-model'),
    profileId: z.string().min(1),
    modelId: z.string().min(1),
  }),
  z.object({
    action: z.literal('set-chat-session-context'),
    sessionId: z.string().min(1),
    workId: z.string().min(1),
    chapterId: z.string().nullable().optional(),
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
      activeModel: null,
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
    activeModel: getActiveModelPreference(),
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
    case 'create-worldview-node':
      return {
        action: mutation.action,
        settingNode: createSettingNode({
          workId: mutation.workId,
          nodeType: mutation.nodeType,
          title: mutation.title,
          parentId: mutation.parentId ?? null,
          payloadJson: mutation.payloadJson,
        }),
      };
    case 'move-worldview-node': {
      if (mutation.parentId !== null && wouldCreateCycle(mutation.nodeId, mutation.parentId)) {
        throw new Error('Cannot move node under itself or its descendant');
      }
      return {
        action: mutation.action,
        settingNode: moveSettingNode(mutation.nodeId, mutation.parentId),
      };
    }
    case 'reorder-worldview-siblings':
      reorderSiblings(
        mutation.workId,
        mutation.parentId ?? null,
        mutation.orderedIds
      );
      return { action: mutation.action, reordered: mutation.orderedIds };
    case 'convert-worldview-node': {
      if (hasChildren(mutation.nodeId) && mutation.nodeType !== 'group') {
        throw new Error('Cannot convert to non-group type while node has children');
      }
      return {
        action: mutation.action,
        settingNode: updateSettingNode(mutation.nodeId, {
          nodeType: mutation.nodeType,
          payloadJson: mutation.payloadJson,
        }),
      };
    }
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
          tps: mutation.tps,
        }),
      };
    case 'delete-chat-message':
      return {
        action: mutation.action,
        message: deleteChatMessage(mutation.messageId),
      };
    case 'set-active-model':
      setActiveModelPreference({
        profileId: mutation.profileId,
        modelId: mutation.modelId,
      });
      return {
        action: mutation.action,
        activeModel: { profileId: mutation.profileId, modelId: mutation.modelId } as ActiveModelSelection,
      };
    case 'set-chat-session-context':
      return {
        action: mutation.action,
        contextSelection: upsertContextSelectionBySource({
          sourceType: 'chat-session',
          sourceId: mutation.sessionId,
          workId: mutation.workId,
          chapterId: mutation.chapterId ?? null,
        }),
      };
  }
}

export function getPersistenceSnapshot(context: ContextSelection = {}) {
  return getWorkspaceCollections(context);
}
