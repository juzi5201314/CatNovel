"use client";

import { useMemo, useState } from "react";
import {
  Bot,
  ChevronLeft,
  ChevronRight,
  FileText,
  LayoutPanelLeft,
  Settings2,
} from "lucide-react";

import type { BootstrapPayload } from "@/lib/contracts/bootstrap";
import type { AppMessages } from "@/lib/i18n/messages";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type WorkspaceShellProps = {
  copy: AppMessages;
  payload: BootstrapPayload;
};

export function WorkspaceShell({ copy, payload }: WorkspaceShellProps) {
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [leftWidth, setLeftWidth] = useState(320);
  const [rightWidth, setRightWidth] = useState(360);

  const activeChapter = payload.workspace.chapters[0];

  const gridStyle = useMemo(() => {
    const left = leftOpen ? `${leftWidth}px` : "72px";
    const right = rightOpen ? `${rightWidth}px` : "72px";

    return {
      gridTemplateColumns: `${left} minmax(0, 1fr) ${right}`,
    };
  }, [leftOpen, rightOpen, leftWidth, rightWidth]);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-canvas)]">
      <header className="sticky top-0 z-20 border-b border-[var(--color-line)] bg-[rgba(255,255,255,0.92)] backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-[var(--color-text)] text-white shadow-[var(--shadow-ring)]">
              <LayoutPanelLeft className="size-4" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-muted-text)]">
                {copy.foundationBadge}
              </p>
              <h1 className="text-2xl font-semibold tracking-[-0.06em] text-[var(--color-text)]">
                {payload.workspace.workTitle}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge>{payload.workspace.locale.toUpperCase()}</Badge>
            <Button variant="secondary" size="sm" onClick={() => setLeftOpen((value) => !value)}>
              {leftOpen ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
              {copy.chapterSidebar}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setRightOpen((value) => !value)}>
              {rightOpen ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
              {copy.aiSidebar}
            </Button>
            <Button variant="primary" size="sm">
              {copy.launchWriting}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col px-6 py-6">
        <div className="grid min-h-[calc(100vh-8rem)] gap-4" style={gridStyle}>
          <Card className="overflow-hidden">
            <CardHeader className={cn(!leftOpen && "items-center px-3")}>
              <div className="flex items-center justify-between gap-3">
                <div className={cn("flex items-center gap-2", !leftOpen && "flex-col")}>
                  <FileText className="size-4 text-[var(--color-muted-text)]" />
                  <CardTitle className={cn("text-base", !leftOpen && "sr-only")}>
                    章节 / 分卷
                  </CardTitle>
                </div>
                {leftOpen ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setLeftWidth((value) => Math.min(value + 24, 420))}
                  >
                    扩展
                  </Button>
                ) : null}
              </div>
              {leftOpen ? (
                <CardDescription>
                  Phase 3 工作台骨架：保持三栏结构，不提供布局模式切换。
                </CardDescription>
              ) : null}
            </CardHeader>
            <CardContent className={cn("space-y-4", !leftOpen && "px-3")}>
              {leftOpen ? (
                payload.workspace.volumes.map((volume) => (
                  <div
                    className="rounded-[var(--radius-md)] bg-[var(--color-surface-muted)] p-3 shadow-[var(--shadow-light-ring)]"
                    key={volume.id}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-[var(--color-text)]">
                          {volume.title}
                        </p>
                        <p className="text-xs text-[var(--color-muted-text)]">
                          {volume.chapterCount} chapters
                        </p>
                      </div>
                      <Badge>{volume.chapterCount}</Badge>
                    </div>

                    <div className="mt-3 flex flex-col gap-2">
                      {payload.workspace.chapters
                        .filter((chapter) => chapter.volumeId === volume.id)
                        .map((chapter) => (
                          <button
                            className="rounded-[var(--radius-sm)] bg-[var(--color-surface)] px-3 py-2 text-left shadow-[var(--shadow-light-ring)] transition-colors hover:bg-[var(--color-surface-muted)]"
                            key={chapter.id}
                            type="button"
                          >
                            <p className="text-sm font-medium text-[var(--color-text)]">
                              {chapter.title}
                            </p>
                            <p className="mt-1 line-clamp-2 text-xs text-[var(--color-muted-text)]">
                              {chapter.excerpt}
                            </p>
                          </button>
                        ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center gap-3 py-6">
                  <FileText className="size-4 text-[var(--color-muted-text)]" />
                  <span className="text-[11px] uppercase tracking-[0.24em] text-[var(--color-muted-text)]">
                    sidebar
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-[32px] tracking-[-0.08em]">
                      {activeChapter.title}
                    </CardTitle>
                    <CardDescription className="mt-2">
                      用新的 Next + SQLite 架构重建工作台；业务真相全部回到 canonical schema。
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge>{activeChapter.wordCount} words</Badge>
                    <Badge>autosave → SQLite</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <Textarea
                  defaultValue="雨落在旧城的玻璃顶棚上，像一场迟到的开场白。这里先放置 foundation 阶段的编辑器占位内容，后续 Phase 4 会换成正式 rich text editor。"
                />
                <Separator />
                <div className="grid gap-4 md:grid-cols-3">
                  <Card className="bg-[var(--color-surface-muted)]">
                    <CardHeader>
                      <CardTitle className="text-base">Database</CardTitle>
                      <CardDescription>{payload.db.file}</CardDescription>
                    </CardHeader>
                  </Card>
                  <Card className="bg-[var(--color-surface-muted)]">
                    <CardHeader>
                      <CardTitle className="text-base">Schema</CardTitle>
                      <CardDescription>{payload.db.tables} canonical tables ready</CardDescription>
                    </CardHeader>
                  </Card>
                  <Card className="bg-[var(--color-surface-muted)]">
                    <CardHeader>
                      <CardTitle className="text-base">Bootstrapped</CardTitle>
                      <CardDescription>{payload.db.bootstrappedAt}</CardDescription>
                    </CardHeader>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="overflow-hidden">
            <CardHeader className={cn(!rightOpen && "items-center px-3")}>
              <div className="flex items-center justify-between gap-3">
                <div className={cn("flex items-center gap-2", !rightOpen && "flex-col")}>
                  <Bot className="size-4 text-[var(--color-muted-text)]" />
                  <CardTitle className={cn("text-base", !rightOpen && "sr-only")}>
                    AI / Inspector
                  </CardTitle>
                </div>
                {rightOpen ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setRightWidth((value) => Math.min(value + 24, 460))}
                  >
                    扩展
                  </Button>
                ) : null}
              </div>
              {rightOpen ? (
                <CardDescription>
                  保留四类 AI family，占位展示 provider bootstrap 与后续 route contract。
                </CardDescription>
              ) : null}
            </CardHeader>
            <CardContent className={cn("space-y-3", !rightOpen && "px-3")}>
              {rightOpen ? (
                <>
                  {payload.workspace.providers.map((provider) => (
                    <div
                      className="rounded-[var(--radius-md)] bg-[var(--color-surface-muted)] p-3 shadow-[var(--shadow-light-ring)]"
                      key={provider.id}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-[var(--color-text)]">
                            {provider.label}
                          </p>
                          <p className="text-xs text-[var(--color-muted-text)]">
                            {provider.family}
                          </p>
                        </div>
                        <Badge>{provider.enabled ? "enabled" : "standby"}</Badge>
                      </div>
                    </div>
                  ))}

                  <Separator />

                  <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-muted)] p-4 shadow-[var(--shadow-light-ring)]">
                    <div className="flex items-center gap-2">
                      <Settings2 className="size-4 text-[var(--color-muted-text)]" />
                      <p className="text-sm font-semibold text-[var(--color-text)]">
                        Foundation notes
                      </p>
                    </div>
                    <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-sm text-[var(--color-muted-text)]">
                      <li>single-user / SQLite / self-hosted Node 已锁定</li>
                      <li>theme、layout mode、cloud sync、账号体系全部排除</li>
                      <li>feature matrix 已建立，后续执行都要回填证据</li>
                    </ul>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-3 py-6">
                  <Bot className="size-4 text-[var(--color-muted-text)]" />
                  <span className="text-[11px] uppercase tracking-[0.24em] text-[var(--color-muted-text)]">
                    ai
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
