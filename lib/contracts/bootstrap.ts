import { z } from "zod";

import { providerFamilies, workspaceLocales } from './workspace.ts';

export const volumeSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  chapterCount: z.number().int().nonnegative(),
  totalWords: z.number().int().nonnegative(),
});

export const chapterSummarySchema = z.object({
  id: z.string(),
  volumeId: z.string(),
  title: z.string(),
  excerpt: z.string(),
  updatedAt: z.string(),
  wordCount: z.number().int().nonnegative(),
  characterCount: z.number().int().nonnegative(),
  readingMinutes: z.number().int().nonnegative(),
  lastAutosavedAt: z.string().nullable(),
});

export const providerSummarySchema = z.object({
  id: z.string(),
  label: z.string(),
  family: z.enum(providerFamilies),
  enabled: z.boolean(),
});

export const bootstrapPayloadSchema = z.object({
  db: z.object({
    file: z.string(),
    tables: z.number().int().nonnegative(),
    bootstrappedAt: z.string(),
  }),
  workspace: z.object({
    workId: z.string(),
    workTitle: z.string(),
    locale: z.enum(workspaceLocales),
    synopsis: z.string(),
    stats: z.object({
      volumeCount: z.number().int().nonnegative(),
      chapterCount: z.number().int().nonnegative(),
      totalWords: z.number().int().nonnegative(),
      totalCharacters: z.number().int().nonnegative(),
      totalReadingMinutes: z.number().int().nonnegative(),
      lastAutosavedAt: z.string().nullable(),
    }),
    volumes: z.array(volumeSummarySchema),
    chapters: z.array(chapterSummarySchema),
    providers: z.array(providerSummarySchema),
  }),
});

export type BootstrapPayload = z.infer<typeof bootstrapPayloadSchema>;
