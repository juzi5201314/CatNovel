# Design Audit — author-replica

## Audit baseline

- Source of truth: `DESIGN.md`
- Goal: 证明新 UI 遵守单主题、紧凑工作台、近白底 + 近黑字、shadow-as-border、Geist 字体体系

## Hard checks

### 1. Typography

- [ ] 使用 Geist Sans 作为主字体
- [ ] 使用 Geist Mono 呈现代码 / 计数 / 辅助信息
- [ ] 标题层级与正文层级清晰

### 2. Palette

- [ ] near-white canvas
- [ ] near-black text
- [ ] 无深色主题切换
- [ ] 无额外视觉主题系统

### 3. Surface language

- [ ] primary cards 使用 shadow-as-border
- [ ] inputs / buttons / panels 遵守统一边框与阴影语言
- [ ] 不使用 glassmorphism 作为主风格

### 4. Layout rhythm

- [ ] 三栏工作台在常规桌面宽度下成立
- [ ] 多面板开关不会破坏编辑器连续性
- [ ] 间距节奏遵守 DESIGN.md，而不是 dashboard 式松散卡片堆叠

### 5. Accessibility

- [ ] focus ring 可见
- [ ] keyboard navigation 连续
- [ ] 面板收起/展开可通过键盘操作

## Evidence collection

最终需要追加：

1. 首页 / 工作台截图
2. 编辑器聚焦状态截图
3. 侧栏展开 / 收起截图
4. AI 面板打开状态截图
5. 三语言关键界面截图
