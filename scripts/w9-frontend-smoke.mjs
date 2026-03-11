#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

import { api, applyMigrations, baseUrl } from "./w7-test-utils.mjs";

async function apiWithRetry(method, route, body, attempts = 3) {
  let lastError = null;
  for (let index = 0; index < attempts; index += 1) {
    try {
      return await api(method, route, body);
    } catch (error) {
      lastError = error;
      if (index + 1 >= attempts) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw lastError;
}

function runAgentBrowser(sessionName, args, options = {}) {
  const runtimeDir = process.env.XDG_RUNTIME_DIR?.trim() || "/tmp/agent-browser-runtime";
  fs.mkdirSync(runtimeDir, { recursive: true });

  const result = spawnSync("agent-browser", ["--session", sessionName, ...args], {
    encoding: "utf8",
    timeout: options.timeoutMs ?? 30000,
    env: {
      ...process.env,
      XDG_RUNTIME_DIR: runtimeDir,
    },
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      [`agent-browser ${args.join(" ")} failed`, result.stdout, result.stderr]
        .filter(Boolean)
        .join("\n"),
    );
  }

  return (result.stdout ?? "").trim();
}

function getBodyText(sessionName) {
  return runAgentBrowser(sessionName, ["get", "text", "body"]);
}

function ensureBodyIncludes(sessionName, expected, message) {
  const body = getBodyText(sessionName);
  assert.match(body, expected, message);
  return body;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function ensureProjectSelected(sessionName, projectName) {
  let body = getBodyText(sessionName);
  if (body.includes(projectName)) {
    return;
  }

  runAgentBrowser(sessionName, ["find", "text", "Switch", "click"]);
  runAgentBrowser(sessionName, ["find", "text", projectName, "click"]);
  runAgentBrowser(sessionName, ["wait", "1000"]);
  body = getBodyText(sessionName);
  assert.match(body, new RegExp(escapeRegExp(projectName)), "frontend smoke should target created project");
}

async function main() {
  applyMigrations();

  const project = await apiWithRetry("POST", "/api/projects", {
    name: `Frontend Smoke ${Date.now()}`,
    mode: "webnovel",
  });
  await apiWithRetry("POST", `/api/projects/${project.id}/chapters`, {
    title: "Frontend Smoke Chapter 1",
  });
  await apiWithRetry("PATCH", `/api/settings/llm-defaults`, {
    projectId: project.id,
    defaultChatPresetId: "builtin-chat-default",
  }).catch(() => null);

  const sessionName = `w9-frontend-${Date.now()}`;
  const rootName = `Smoke Root ${Date.now()}`;
  const childName = `Smoke Child ${Date.now()}`;
  const chatPrompt = `Smoke chat ${Date.now()}`;

  try {
    runAgentBrowser(sessionName, ["open", baseUrl]);
    runAgentBrowser(sessionName, ["wait", "--load", "networkidle"], { timeoutMs: 45000 });
    ensureProjectSelected(sessionName, project.name);

    runAgentBrowser(sessionName, ["network", "requests", "--clear"]);
    runAgentBrowser(sessionName, ["wait", "2500"]);
    const idleRequests = runAgentBrowser(sessionName, ["network", "requests", "--filter", "active-run"]);
    assert.match(idleRequests, /No requests captured/, "idle workspace should not poll active-run continuously");

    runAgentBrowser(sessionName, ["fill", 'textarea[placeholder="Message AI Assistant..."]', chatPrompt]);
    runAgentBrowser(sessionName, ["network", "requests", "--clear"]);
    runAgentBrowser(sessionName, ["press", "Enter"]);
    runAgentBrowser(sessionName, ["wait", "2500"]);
    const chatProbeRequests = runAgentBrowser(sessionName, ["network", "requests", "--filter", "active-run"]);
    assert.doesNotMatch(chatProbeRequests, /No requests captured/, "sending chat should trigger active-run probe requests");

    runAgentBrowser(sessionName, ["find", "text", "设定集", "click"]);
    runAgentBrowser(sessionName, ["wait", "1000"]);
    ensureBodyIncludes(sessionName, /创建第一个节点/, "Lorebook empty state should show create CTA");

    runAgentBrowser(sessionName, ["find", "text", "创建第一个节点", "click"]);
    assert.equal(
      runAgentBrowser(sessionName, ["is", "visible", 'input[aria-label="节点名称"]']),
      "true",
      "Lorebook root create input should be visible by aria-label in empty state",
    );
    runAgentBrowser(sessionName, ["fill", 'input[aria-label="节点名称"]', rootName]);
    runAgentBrowser(sessionName, ["press", "Enter"]);
    runAgentBrowser(sessionName, ["wait", "1200"]);
    ensureBodyIncludes(
      sessionName,
      new RegExp(`节点「${escapeRegExp(rootName)}」已创建`),
      "Lorebook root creation should show success notice",
    );

    runAgentBrowser(sessionName, ["find", "title", "添加根节点", "click"]);
    assert.equal(
      runAgentBrowser(sessionName, ["is", "visible", 'input[aria-label="节点名称"]']),
      "true",
      "Lorebook non-empty root create entry should expose same accessible input",
    );
    runAgentBrowser(sessionName, ["find", "text", "取消", "click"]);

    runAgentBrowser(sessionName, ["find", "text", "添加子节点", "click"]);
    assert.equal(
      runAgentBrowser(sessionName, ["is", "visible", 'input[aria-label="节点名称"]']),
      "true",
      "Lorebook child create input should be visible by aria-label",
    );
    runAgentBrowser(sessionName, ["fill", 'input[aria-label="节点名称"]', childName]);
    runAgentBrowser(sessionName, ["press", "Enter"]);
    runAgentBrowser(sessionName, ["wait", "1200"]);

    const listed = await apiWithRetry("GET", `/api/projects/${project.id}/worldbuilding`);
    assert.ok(listed.nodes.some((node) => node.name === rootName), "Lorebook root node should persist to API");
    assert.ok(listed.nodes.some((node) => node.name === childName), "Lorebook child node should persist to API");

    runAgentBrowser(sessionName, ["reload"]);
    runAgentBrowser(sessionName, ["wait", "1000"]);
    ensureProjectSelected(sessionName, project.name);
    runAgentBrowser(sessionName, ["find", "text", "设定集", "click"]);
    runAgentBrowser(sessionName, ["wait", "1000"]);
    ensureBodyIncludes(sessionName, new RegExp(escapeRegExp(rootName)), "Lorebook root node should remain visible after reload");

    console.log("frontend_lore_smoke_ok=true");
    console.log(`frontend_smoke_project_id=${project.id}`);
  } finally {
    try {
      runAgentBrowser(sessionName, ["close"], { timeoutMs: 10000 });
    } catch {
    }
  }
}

main().catch((error) => {
  console.error("frontend_lore_smoke_ok=false");
  console.error(error);
  process.exitCode = 1;
});
