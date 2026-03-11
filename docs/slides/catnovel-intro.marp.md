---
marp: true
theme: default
paginate: true
size: 16:9
html: true
style: |
  :root {
    --bg: #d6e2ef;
    --ink: #062a4a;
    --outline: #0a2f50;
    --soft: #f4f8fc;
  }

  section {
    background: var(--bg);
    color: var(--ink);
    font-family: "Geist", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
    padding: 52px 68px;
    line-height: 1.32;
  }

  h1,
  h2,
  h3 {
    margin: 0 0 14px 0;
    color: var(--ink);
    letter-spacing: -0.02em;
    font-weight: 900;
  }

  h1 {
    font-size: 58px;
  }

  h2 {
    font-size: 42px;
  }

  h3 {
    font-size: 28px;
  }

  p,
  li {
    font-size: 22px;
  }

  code {
    display: inline-block;
    background: #ffffff;
    border: 2px solid var(--outline);
    border-radius: 10px;
    padding: 1px 7px;
    font-size: 0.8em;
    color: var(--ink);
  }

  ul {
    margin: 10px 0 0 0;
    padding: 0;
    list-style: none;
  }

  li {
    border: 2.5px solid var(--outline);
    border-radius: 18px;
    padding: 11px 15px;
    margin: 9px 0;
    box-shadow: 0 3px 0 rgba(6, 42, 74, 0.24);
    font-weight: 700;
  }

  li:nth-child(10n + 1) { background: #77d1f3; }
  li:nth-child(10n + 2) { background: #53b0e8; }
  li:nth-child(10n + 3) { background: #5f86f0; }
  li:nth-child(10n + 4) { background: #745de5; }
  li:nth-child(10n + 5) { background: #9452df; }
  li:nth-child(10n + 6) { background: #b75dda; }
  li:nth-child(10n + 7) { background: #e45ab2; }
  li:nth-child(10n + 8) { background: #f07086; }
  li:nth-child(10n + 9) { background: #f29f64; }
  li:nth-child(10n + 10) { background: #f5d75a; }

  .card-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-top: 14px;
  }

  .card {
    border: 2.5px solid var(--outline);
    border-radius: 18px;
    padding: 12px 14px;
    box-shadow: 0 3px 0 rgba(6, 42, 74, 0.24);
  }

  .card:nth-child(1) { background: #77d1f3; }
  .card:nth-child(2) { background: #5f86f0; }
  .card:nth-child(3) { background: #9452df; }
  .card:nth-child(4) { background: #f29f64; }

  .card-title {
    font-size: 24px;
    font-weight: 900;
    margin-bottom: 6px;
  }

  .card-body {
    font-size: 17px;
    line-height: 1.35;
    font-weight: 700;
  }

  .muted {
    color: #153f67;
    font-size: 20px;
    font-weight: 700;
  }

  .tag-wrap {
    margin-top: 10px;
  }

  .tag {
    display: inline-block;
    border: 2px solid var(--outline);
    border-radius: 999px;
    padding: 4px 12px;
    margin: 4px 8px 4px 0;
    background: var(--soft);
    color: var(--ink);
    font-size: 16px;
    font-weight: 800;
  }

  .cover {
    text-align: center;
    position: relative;
    padding-top: 78px;
  }

  .cover h1 {
    font-size: 62px;
    margin-bottom: 10px;
  }

  .cover-sub {
    font-size: 26px;
    font-weight: 800;
    margin: 0 0 10px 0;
  }

  .brand-box {
    position: absolute;
    left: 14px;
    top: 14px;
    border: 2.5px solid var(--outline);
    background: #c6d7e9;
    border-radius: 8px;
    padding: 8px 10px;
    line-height: 1.05;
    text-align: left;
    width: 98px;
    box-sizing: border-box;
    font-weight: 900;
    font-size: 18px;
  }

  .brand-box span {
    display: block;
    margin-top: 4px;
    font-size: 11px;
    font-weight: 700;
  }

  .cta {
    display: inline-block;
    margin-top: 18px;
    background: #052b4d;
    color: #ffffff;
    border: 2.5px solid #052b4d;
    border-radius: 16px;
    padding: 12px 26px;
    font-size: 30px;
    font-weight: 900;
    letter-spacing: 0.02em;
  }

  .mini {
    font-size: 17px;
    font-weight: 800;
    color: #1a4a75;
  }
---

<!-- _class: cover -->
<div class="brand-box">CN<span>Creative Novel Deck</span></div>

# CatNovel 项目介绍
<p class="cover-sub">一体化 AI 小说创作工作台</p>

<div class="tag-wrap">
  <span class="tag">创作工作台</span>
  <span class="tag">AI 协作</span>
  <span class="tag">知识检索</span>
  <span class="tag">版本回溯</span>
</div>

<p class="cta">开始演示 ↗</p>

---

## 项目定位

- 面向长篇创作的本地优先工作台，覆盖网络连载、文学写作与剧本创作
- 把写作、检索、时间线整理、AI 辅助、版本恢复整合到同一界面
- 三栏工作区让素材管理、正文创作与 AI 协作可以并行推进
- 采用新架构直切策略，减少历史包袱，保持体验一致性

---

## 核心能力（写作工作流）

<div class="card-grid">
  <div class="card">
    <div class="card-title">项目与章节管理</div>
    <div class="card-body">创建、重命名、导入导出、删除，覆盖完整创作生命周期。</div>
  </div>
  <div class="card">
    <div class="card-title">编辑器与自动保存</div>
    <div class="card-body">Tiptap 富文本编辑，支持 autosave、手动保存与预览切换。</div>
  </div>
  <div class="card">
    <div class="card-title">Lorebook</div>
    <div class="card-body">世界观与角色设定集中管理，与正文写作并行推进。</div>
  </div>
  <div class="card">
    <div class="card-title">Snapshot 版本恢复</div>
    <div class="card-body">创建快照、查看 diff、按原因恢复版本，降低误改成本。</div>
  </div>
</div>

---

## 核心能力（AI 与知识引擎）

- AI 对话支持实时反馈，创作过程更顺畅
- 知识检索会结合项目内容，减少设定冲突与信息遗漏
- 时间线能力可自动抽取事件，并按人物与实体聚合
- Ghost Text 可直接并入当前章节，便于快速续写与润色

---

## 安全可控执行模型

- 涉及改动的 AI 操作会先进入审批流程，再执行落地
- 支持通过与拒绝两种决策路径，权限边界清晰
- 审批中心可实时查看待处理事项与处理结果
- 目标是在效率与可控之间取得平衡，降低误操作风险

---

## 技术架构

- 采用现代 Web 前端架构，交互响应快，迭代效率高
- 系统按接口层、核心逻辑层、数据访问层分层，职责清晰
- 项目数据与知识索引分离存储，兼顾稳定性与查询效率
- 架构强调可维护性，便于持续扩展新能力

---

## 质量保障与验证体系

- 从静态检查到自动化测试形成多层质量闸门
- 覆盖单元、契约、核心场景与性能等关键维度
- 每次改动都有可追溯的验证结果，降低回归风险
- 持续验证机制保障上线质量与团队协作效率

---

## 运行与环境

- 默认支持本地运行，开箱即可进入功能演示
- 关键配置统一收敛到环境参数，部署与迁移更清晰
- 敏感信息通过加密与密钥机制管理，降低泄露风险
- 建议先完成基础健康检查，再进入完整演示流程

---

## CatNovel 下一步

- 提升模型配置与默认策略的可观测性
- 强化 RAG 召回与 Timeline 提取质量评估
- 扩展团队协作场景（审批策略、审计日志、操作回放）

<p class="muted">让创作流与 AI 能力在一个工作台内稳定协同。</p>
<p class="mini">把创作效率、内容一致性与操作安全放在同一个产品闭环里。</p>
