# 为 AI Chat 区域添加 Markdown 渲染支持

## 现状分析

当前 AI 聊天区域中，所有 LLM 消息（包括助手回复）均以纯文本形式渲染，直接插入 `<div>` 中：
- [chat-session-list.tsx:513](file:///home/soeur/project/CatNovel/components/ai/chat-session-list.tsx#L513) — 持久化的助手消息 `{displayBody}`
- [chat-session-list.tsx:483](file:///home/soeur/project/CatNovel/components/ai/chat-session-list.tsx#L483) — 重试流式消息 `{retryText}`
- [chat-session-list.tsx:543](file:///home/soeur/project/CatNovel/components/ai/chat-session-list.tsx#L543) — 新流式消息 `{streamingMessage.text}`

项目当前无任何 Markdown 渲染库，也无 `@tailwindcss/typography` 插件。

## 技术选型

| 库 | 用途 | 理由 |
|---|---|---|
| `react-markdown` | Markdown → React 组件渲染 | 最成熟热门的 React Markdown 库，npm 周下载量 500w+，基于 remark/rehype 生态 |
| `remark-gfm` | GitHub Flavored Markdown 支持 | 支持表格、删除线、任务列表、自动链接等 GFM 扩展 |
| `rehype-highlight` | 代码块语法高亮 | 与 rehype 管道无缝集成，基于 highlight.js，轻量高效 |
| `@tailwindcss/typography` | Markdown 排版样式（`prose` 类） | Tailwind 官方排版插件，为渲染后的 HTML 提供美观的排版样式 |

## 实施步骤

### Step 1: 安装依赖

```bash
pnpm add react-markdown remark-gfm rehype-highlight
pnpm add -D @tailwindcss/typography
```

### Step 2: 配置 Tailwind Typography 插件

在 `app/globals.css` 中添加 `@plugin` 指令（Tailwind v4 语法）：

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";
```

### Step 3: 创建 `MarkdownContent` 组件

新建 `components/ai/markdown-content.tsx`，封装 `react-markdown` 渲染逻辑：

- 接收 `content: string` 属性
- 配置 `remarkGfm` 插件（GFM 支持）
- 配置 `rehypeHighlight` 插件（代码高亮）
- 为代码块添加一键复制功能
- 自定义组件映射：`<a>` 添加 `target="_blank" rel="noopener noreferrer"`；`<code>` 区分行内代码与代码块样式；`<pre>` 添加代码块容器样式
- 外层使用 `prose prose-sm` 类控制排版，配合 `prose-invert` 适配深色背景
- 导入 highlight.js 主题 CSS（选择与 Geist 设计系统协调的浅色主题，如 `github`）

### Step 4: 修改 `chat-session-list.tsx` 中的消息渲染

将三处纯文本渲染替换为 `<MarkdownContent>` 组件：

1. **持久化助手消息**（~L513）：将 `{displayBody}` 替换为 `<MarkdownContent content={displayBody} />`
2. **重试流式消息**（~L483）：将 `{retryText}` 替换为 `<MarkdownContent content={retryText} />`
3. **新流式消息**（~L543）：将 `{streamingMessage.text}` 替换为 `<MarkdownContent content={streamingMessage.text} />`

**注意**：用户消息（`role === 'user'`）保持纯文本渲染不变，仅对助手消息应用 Markdown 渲染。

### Step 5: 调整样式

- 助手消息气泡的 `prose` 样式需要与现有 `bg-muted` 背景协调
- 代码块需要适当的圆角和内边距，与 Geist 设计系统一致
- 流式消息中的 Markdown 渲染需保留光标动画（`<span className="inline-block w-1.5 h-3 ml-0.5 bg-current animate-pulse" />`）
- 确保表格、列表等 GFM 元素在消息气泡宽度内正确换行和滚动

### Step 6: 验证

- 运行 `pnpm typecheck` 确保类型正确
- 运行 `pnpm lint` 确保代码规范
- 运行 `pnpm build` 确保构建通过
- 手动测试：发送包含标题、粗体、代码块、表格、列表的消息，验证渲染效果

## 文件变更清单

| 文件 | 操作 |
|---|---|
| `package.json` | 新增 4 个依赖 |
| `app/globals.css` | 添加 `@plugin "@tailwindcss/typography"` |
| `components/ai/markdown-content.tsx` | **新建** — Markdown 渲染组件 |
| `components/ai/chat-session-list.tsx` | 导入并使用 `MarkdownContent` 替换 3 处纯文本 |
