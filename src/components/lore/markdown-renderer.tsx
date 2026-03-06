"use client";

import { useMemo } from "react";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderMarkdownToHtml(source: string): string {
  if (!source.trim()) return "";

  let html = source;

  const codeBlocks: string[] = [];
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang, code) => {
    const idx = codeBlocks.length;
    const escaped = escapeHtml(code.trimEnd());
    const langAttr = lang ? ` data-lang="${escapeHtml(lang)}"` : "";
    codeBlocks.push(
      `<pre class="md-code-block"${langAttr}><code>${escaped}</code></pre>`,
    );
    return `\x00CODEBLOCK${idx}\x00`;
  });

  const inlineCodes: string[] = [];
  html = html.replace(/`([^`\n]+)`/g, (_match, code) => {
    const idx = inlineCodes.length;
    inlineCodes.push(`<code class="md-inline-code">${escapeHtml(code)}</code>`);
    return `\x00INLINE${idx}\x00`;
  });

  html = escapeHtml(html);

  for (let i = 0; i < codeBlocks.length; i++) {
    html = html.replace(`\x00CODEBLOCK${i}\x00`, codeBlocks[i]!);
  }
  for (let i = 0; i < inlineCodes.length; i++) {
    html = html.replace(`\x00INLINE${i}\x00`, inlineCodes[i]!);
  }

  html = html.replace(/^#### (.+)$/gm, '<h4 class="md-h4">$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="md-h2">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="md-h1">$1</h1>');

  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/~~(.+?)~~/g, "<del>$1</del>");

  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="md-link">$1</a>',
  );

  html = html.replace(/^---$/gm, '<hr class="md-hr" />');

  const lines = html.split("\n");
  const output: string[] = [];
  let inList = false;
  let listType: "ul" | "ol" = "ul";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    const ulMatch = line.match(/^(\s*)[-*]\s+(.+)$/);
    const olMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);

    if (ulMatch) {
      if (!inList || listType !== "ul") {
        if (inList) output.push(listType === "ul" ? "</ul>" : "</ol>");
        output.push('<ul class="md-list">');
        inList = true;
        listType = "ul";
      }
      output.push(`<li>${ulMatch[2]}</li>`);
    } else if (olMatch) {
      if (!inList || listType !== "ol") {
        if (inList) output.push(listType === "ul" ? "</ul>" : "</ol>");
        output.push('<ol class="md-list md-ol">');
        inList = true;
        listType = "ol";
      }
      output.push(`<li>${olMatch[2]}</li>`);
    } else {
      if (inList) {
        output.push(listType === "ul" ? "</ul>" : "</ol>");
        inList = false;
      }

      if (
        line.startsWith("<h") ||
        line.startsWith("<pre") ||
        line.startsWith("<hr") ||
        line.startsWith("<ul") ||
        line.startsWith("<ol")
      ) {
        output.push(line);
      } else if (line.trim() === "") {
        output.push("");
      } else {
        output.push(`<p class="md-p">${line}</p>`);
      }
    }
  }

  if (inList) {
    output.push(listType === "ul" ? "</ul>" : "</ol>");
  }

  return output.join("\n");
}

type MarkdownPreviewProps = {
  content: string;
  className?: string;
};

export function MarkdownPreview({ content, className }: MarkdownPreviewProps) {
  const html = useMemo(() => renderMarkdownToHtml(content), [content]);

  if (!content.trim()) {
    return (
      <div className={`text-sm text-muted-foreground italic ${className ?? ""}`}>
        暂无描述内容
      </div>
    );
  }

  return (
    <div
      className={`md-preview ${className ?? ""}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
