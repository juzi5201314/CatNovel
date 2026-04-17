'use client';

import { useCallback, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { cx } from '@/lib/design/cx';

import 'highlight.js/styles/github.css';

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className={cx(
        'absolute top-2 right-2 p-1.5 rounded-md',
        'text-[var(--cn-text-muted)] hover:text-[var(--cn-text)]',
        'hover:bg-[var(--cn-bg-soft)] transition-colors',
        'opacity-0 group-hover:opacity-100'
      )}
      title={copied ? '已复制' : '复制代码'}
    >
      {copied ? (
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  );
}

export function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="markdown-content prose prose-sm prose-neutral max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-pre:my-2 prose-pre:p-0 prose-blockquote:my-2 prose-table:my-2 prose-hr:my-2 prose-img:my-2 prose-code:before:content-none prose-code:after:content-none prose-code:font-normal prose-code:text-[0.875em] prose-code:bg-[var(--cn-bg-soft)] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[var(--cn-blue-strong)]">
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          a: ({ href, children, ...props }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--cn-blue-strong)] underline decoration-[var(--cn-blue-strong)]/30 hover:decoration-[var(--cn-blue-strong)] transition-colors"
              {...props}
            >
              {children}
            </a>
          ),
          pre: ({ children, ...props }) => {
            const codeElement = children as React.ReactElement<{
              className?: string;
              children?: React.ReactNode;
            }> | null;
            const codeText = extractTextContent(codeElement);
            return (
              <div className="relative group">
                <pre
                  className={cx(
                    'rounded-lg bg-[var(--cn-bg-muted)] overflow-x-auto',
                    'text-[var(--cn-text-secondary)] text-xs leading-relaxed',
                    'p-3 pt-9'
                  )}
                  {...props}
                >
                  {codeElement?.props?.className && (
                    <div className="absolute top-2 left-3 text-[10px] text-[var(--cn-text-muted)] font-mono uppercase tracking-wider">
                      {codeElement.props.className.replace('language-', '').replace('hljs ', '')}
                    </div>
                  )}
                  {children}
                </pre>
                <CopyButton text={codeText} />
              </div>
            );
          },
          code: ({ className, children, ...props }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            }
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          table: ({ children, ...props }) => (
            <div className="overflow-x-auto">
              <table {...props}>{children}</table>
            </div>
          ),
          blockquote: ({ children, ...props }) => (
            <blockquote
              className="border-l-2 border-[var(--cn-blue-strong)]/40 pl-3 text-[var(--cn-text-muted)]"
              {...props}
            >
              {children}
            </blockquote>
          ),
        }}
      >
        {content}
      </Markdown>
    </div>
  );
}

function extractTextContent(node: React.ReactNode): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (!node) return '';
  if (Array.isArray(node)) return node.map(extractTextContent).join('');
  if (typeof node === 'object' && 'props' in node) {
    const element = node as React.ReactElement<{ children?: React.ReactNode }>;
    return extractTextContent(element.props.children);
  }
  return '';
}
