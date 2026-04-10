# Manual Test Script — author-replica

> 目的：将 PRD / Test Spec 的“最终人工验收”拆成可逐步执行的脚本。

## 1. Workspace shell

1. 打开首页。
2. 确认页面以 **工作台** 进入，而不是营销页或多页面导航中心。
3. 确认存在：
   - 左侧导航 / 章节树或设定入口
   - 中央编辑区
   - 右侧 AI / inspector 面板
4. 展开 / 收起左侧面板，确认编辑区宽度跟随调整。
5. 打开 / 关闭右侧面板，确认无明显抖动、遮挡、错位。
6. 检查 UI 中 **没有**：
   - theme 切换
   - layout mode 切换
   - login / register / account / sync 入口

## 2. Writing domain

1. 新建作品。
2. 新建分卷。
3. 新建章节。
4. 在章节中输入正文并使用富文本能力：
   - 粗体 / 斜体
   - 标题
   - 列表
   - slash command
   - bubble menu
   - 搜索高亮
   - page-break / pagination style
5. 关闭页面并刷新。
6. 确认最新内容恢复。
7. 重命名章节。
8. 调整章节顺序。
9. 删除章节并确认统计同步更新。

## 3. Webnovel settings system

1. 打开设定集面板。
2. 依次创建：
   - 角色
   - 地点
   - 物品
   - 世界观
   - 剧情
   - 规则
3. 编辑每类节点的专属字段。
4. 检查书籍信息面板是否完整。
5. 确认 **不存在**：
   - traditional mode 字段
   - screenplay mode 字段
   - 模式切换 UI

## 4. AI platform

1. 创建 provider profile。
2. 对以下 family 分别执行模型拉取：
   - OpenAI-compatible
   - Gemini-native
   - Claude-native
   - custom endpoint
3. 执行以下操作各一次：
   - 续写
   - 改写
   - 润色
   - 扩写
4. 触发 ghost text，分别测试接受 / 拒绝。
5. 创建自由对话 session，与 AI 讨论剧情。
6. 确认上下文包含：
   - 当前章节
   - 设定节点
   - 手动选择内容
   - 摘要 / 上下文缓存（如有）
7. degraded-path：
   - 空 API Key
   - 请求超时
   - 模型列表拉取失败
   - 流式中断
   - 非法响应

## 5. Import / export / snapshot

### Import

对以下格式分别执行一次导入：

- txt
- md
- epub
- docx
- doc
- pdf

导入后检查：

1. 章节拆分是否合理。
2. 正文是否进入 canonical 数据存储。
3. 中文内容是否无明显乱码。

### Export

对以下格式分别执行一次导出：

- txt
- md
- docx
- epub
- pdf
- project JSON

导出后检查：

1. 文件是否可打开。
2. 章节顺序是否保持一致。
3. 书籍元数据是否保留。

### Snapshot

1. 创建快照。
2. 做破坏性编辑。
3. 恢复快照。
4. 校对正文、设定、聊天记录、偏好设置是否回滚。
5. 删除快照并确认列表更新。

## 6. I18n / onboarding / help

1. 切换到 `zh`，检查工作台主流程。
2. 切换到 `en`，检查工作台主流程。
3. 切换到 `ru`，检查工作台主流程。
4. 检查新手引导是否可关闭并重新打开。
5. 检查帮助面板与快捷键说明。
6. 检查核心工作台不存在未翻译 placeholder。

## 7. Design audit

按 `docs/verification/design-audit.md` 逐项确认：

1. Geist / Geist Mono
2. near-white canvas + near-black text
3. shadow-as-border
4. focus ring
5. spacing rhythm
6. 单主题实现

## 8. Ops readiness

按 `docs/verification/deployment-readiness.md` 执行：

1. clean DB bootstrap
2. existing DB migration
3. backup
4. restore rehearsal
5. health / readiness
6. import/export 大文件边界

## Signoff rule

只有当本脚本所有项目都能被证明为：

- 通过
- 或显式删项

才允许勾选 `docs/verification/signoff-checklist.md`。
