import { ProjectSettingsRepository } from "@/repositories/project-settings-repository";

import { DEFAULT_WRITING_SYSTEM_PROMPT } from "./default-prompts";

const projectSettingsRepository = new ProjectSettingsRepository();

export function resolveProjectSystemPrompt(projectId: string): string {
  const projectSettings = projectSettingsRepository.getByProjectId(projectId);
  const prompt = projectSettings?.systemPrompt?.trim();
  if (!prompt) {
    return DEFAULT_WRITING_SYSTEM_PROMPT;
  }
  return prompt;
}

