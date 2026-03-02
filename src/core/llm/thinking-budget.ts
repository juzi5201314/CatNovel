import { THINKING_EFFORT_LEVELS, type ThinkingEffort } from "@/db/schema";

import type { ThinkingBudget } from "./types";

type ParseThinkingBudgetSuccess = {
  ok: true;
  data: ThinkingBudget | undefined;
};

type ParseThinkingBudgetFailed = {
  ok: false;
  message: string;
};

export type ParseThinkingBudgetResult =
  | ParseThinkingBudgetSuccess
  | ParseThinkingBudgetFailed;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export function parseThinkingBudget(value: unknown): ParseThinkingBudgetResult {
  if (value === undefined) {
    return { ok: true, data: undefined };
  }

  const record = asRecord(value);
  if (!record) {
    return { ok: false, message: "thinkingBudget must be an object" };
  }

  const budgetType = record.type;
  if (budgetType !== "effort" && budgetType !== "tokens") {
    return { ok: false, message: "thinkingBudget.type must be effort or tokens" };
  }

  if (budgetType === "effort") {
    const effort = record.effort;
    if (
      typeof effort !== "string" ||
      !THINKING_EFFORT_LEVELS.includes(effort as ThinkingEffort)
    ) {
      return { ok: false, message: "thinkingBudget.effort must be low/medium/high" };
    }
    return { ok: true, data: { type: "effort", effort: effort as ThinkingEffort } };
  }

  const tokens = record.tokens;
  if (!Number.isInteger(tokens) || (tokens as number) <= 0) {
    return { ok: false, message: "thinkingBudget.tokens must be a positive integer" };
  }
  return { ok: true, data: { type: "tokens", tokens: tokens as number } };
}
