# UI/UX Pro Max: Workspace 全面体验优化方案

## Background & Motivation (背景与动机)
当前项目的 Workspace 界面已经具备了完整的骨架，并初步落地了 Vercel 的极简设计语言（Geist 字体、阴影边框）。但在专业生产力工具的标准下，仍存在交互生硬（如条件渲染导致的布局跳动）、响应式不足（空间利用率低）、缺乏高阶快捷键及无障碍语义等问题。本次优化旨在将可用性提升至“沉浸式专业创作工具”级别。

## Scope & Impact (影响范围)
*   **交互动画**：引入基于 CSS Transition / Transform 的平滑过渡，替代硬卸载/挂载。
*   **响应式布局**：基于 Flexbox 优化编辑器高度，并适配移动端/平板的降级呈现。
*   **可访问性 (A11y)**：引入全局快捷键系统、规范 ARIA Role 与 Focus Ring。
*   **状态反馈**：完善错误处理（Toast 提示及重试机制）和加载骨架。
*   **设计系统对齐**：严格映射 `DESIGN.md` 中定义的 Geist 排版规范与多层阴影（Layered Shadows）。

影响到的核心文件：
- `app/(workspace)/*`
- `components/workspace/*`
- `components/editor/*`
- `app/globals.css` (按需补充部分动画工具类)

---

## Implementation Plan (实施步骤)

### Phase 1: 流畅动效与空间连续性 (Fluidity & Micro-interactions)
1. **侧边栏平滑过渡** (`workspace-shell.tsx`):
   - 移除 `isSidebarOpen && <aside>` 的直接条件渲染。
   - 使用 CSS 类控制宽度或 Transform 配合 `transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]`，实现平滑展开/折叠。
   - 为主编辑区增加自适应动画，避免闪烁。
2. **沉浸/专注模式 (Focus Mode)**:
   - 监听 `editor-panel.tsx` 中的持续输入状态。
   - 当检测到打字活跃时，自动添加类名淡出（Fade-out）顶栏和双侧边栏。空闲 3 秒或鼠标移动时恢复。
3. **按下态微交互 (Press Feedback)**:
   - 为所有可点击组件（`Button`, `nav-link`, 章节列表）增加 `:active:scale-[0.98]` 及过渡效果，增强物理按压感。

### Phase 2: 响应式与全屏利用率 (Responsive & Space Utilization)
1. **编辑器自适应高度** (`editor-panel.tsx`):
   - 将 `min-h-[600px]` 替换为 `flex-1 h-full w-full`，并让外部容器负责限制最大宽度（`max-w-3xl mx-auto`），避免大小屏幕上的死角。
2. **移动端降级 (Mobile Degradation)**:
   - 在窄屏下 (`max-w-md`)，将侧边栏默认隐藏并转换为悬浮抽屉 (Off-canvas Drawer) 形式，甚至采用底部导航条 (Bottom Nav) 方案。

### Phase 3: 高级键盘控制与无障碍 (Keyboard Nav & A11y)
1. **全局快捷键系统** (`hooks/use-keyboard-shortcuts.ts`):
   - 注入高频快捷键：
     - `Cmd/Ctrl + S`：强制保存
     - `Cmd/Ctrl + B`：切换左侧目录栏
     - `Cmd/Ctrl + J`：切换右侧辅助面板（AI/Settings/Snapshots）
2. **ARIA 语义树规范** (`workspace-shell.tsx`):
   - 为右侧的 Tab 切换组添加 `role="tablist"`。
   - 每个 Tab 按钮添加 `role="tab"`, `aria-selected={tab === current}`。
3. **焦点环管理** (`globals.css` & Components):
   - 确保所有可聚焦元素获得 Vercel 规范的焦点环：`focus-visible:ring-2 focus-visible:ring-[var(--cn-focus)]`，且 `outline-none`。

### Phase 4: 数据呈现与状态反馈 (Data Presentation & Feedback)
1. **层级折叠目录** (`sidebar-nav.tsx`):
   - 将卷（Volume）升级为可折叠的 Accordion。点击 Volume 标题展开/收起其下属章节，避免超长列表带来的认知负担。
   - 确保移动端可见的字数统计，不再仅依赖 hover。
2. **容错与重试机制** (`workspace-shell.tsx`):
   - 利用 `sonner`（项目中已安装）在保存失败时弹出 Toast（"Autosave failed"），并提供显式的 [Retry] 按钮。
   - 对于 `pendingGhostText`（AI 生成中），增加符合设计系统的脉冲加载骨架。

### Phase 5: 严格贯彻设计系统 (Vercel Design System Adherence)
1. **排版严格映射**:
   - `editor-panel.tsx` 的标题输入框：应用 `class="text-card-title"` 替代散装的 `text-2xl font-semibold`，确保 `-0.96px` 的负字距得以落实。
2. **层级阴影替代边框**:
   - 优化 Ghost Suggestion Card：去除 `border-dashed`，改用多层阴影堆叠 `box-shadow: var(--cn-shell-shadow)` 和内发光环 (`#fafafa`) 以传达卡片层级。

---

## Verification & Testing (验证标准)
1. **视觉检查**：左右侧栏的切换是否存在像素跳动；Ghost 卡片的阴影是否正确渲染。
2. **交互检查**：触发 `Cmd/Ctrl + B`，侧边栏能够顺滑收起；按下按钮时能感受到缩放微动效。
3. **错误模拟**：主动阻断网络，检查 Autosave 失败时是否出现带有 [Retry] 按钮的 Toast。
4. **移动端模拟**：在 Chrome DevTools (375px 宽) 下，编辑器主体是否填满屏幕，侧边栏是否平滑过渡为抽屉模式。

## Rollback Strategy (回滚策略)
如果动画方案引起了 React 的性能问题（如不必要的重渲染），我们将回滚 `workspace-shell.tsx` 的动画控制类，重新使用简单的条件渲染；或者对 `framer-motion` (如需引入) 等库进行动态导入分离，确保初始包体积不超标。