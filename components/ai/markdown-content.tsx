'use client';

import dynamic from 'next/dynamic';

const MarkdownContentInner = dynamic(
  () => import('./markdown-content-inner').then((mod) => mod.MarkdownContentInner),
  {
    ssr: false,
    loading: () => (
      <div className="markdown-content prose prose-sm prose-neutral max-w-none text-[var(--cn-text-muted)]">
        <p>Loading message…</p>
      </div>
    ),
  },
);

export function MarkdownContent({ content }: { content: string }) {
  return <MarkdownContentInner content={content} />;
}
