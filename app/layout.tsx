import type { ReactNode } from 'react';

import type { Metadata } from 'next';
import { Geist_Mono, Noto_Sans_SC } from 'next/font/google';
import { Toaster } from 'sonner';

import './globals.css';

const notoSansSC = Noto_Sans_SC({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto-sans-sc',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
});

export const metadata: Metadata = {
  title: 'CatNovel Workspace',
  description:
    'A production-oriented webnovel workspace shell rebuilt with Next.js and SQLite.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={`${notoSansSC.variable} ${geistMono.variable}`}>
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
