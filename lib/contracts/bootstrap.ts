import { z } from "zod";

export const volumeSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  chapterCount: z.number().int().nonnegative(),
});

export const chapterSummarySchema = z.object({
  id: z.string(),
  volumeId: z.string(),
  title: z.string(),
  excerpt: z.string(),
  updatedAt: z.string(),
  wordCount: z.number().int().nonnegative(),
});

export const providerSummarySchema = z.object({
  id: z.string(),
  label: z.string(),
  family: z.enum(["openai-compatible", "gemini-native", "claude-native", "custom-endpoint"]),
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
    locale: z.enum(["zh", "en", "ru"]),
    volumes: z.array(volumeSummarySchema),
    chapters: z.array(chapterSummarySchema),
    providers: z.array(providerSummarySchema),
  }),
});

export type BootstrapPayload = z.infer<typeof bootstrapPayloadSchema>;
