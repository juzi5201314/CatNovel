# Slide Build Guide

本目录的幻灯片源文件使用 Marp（Markdown）维护，导出 PPT 使用仓库脚本统一执行。

## 一键导出默认项目介绍 PPT

```bash
pnpm run slides:build:ppt
```

默认输入与输出：

- 输入：`docs/slides/catnovel-intro.marp.md`
- 输出：`docs/slides/catnovel-intro.pptx`

## 指定输入/输出

```bash
pnpm run slides:build:ppt -- --input docs/slides/catnovel-intro.marp.md --output docs/slides/catnovel-intro.pptx
```

说明：

- `--` 后面的参数会透传给 `scripts/build-slide-ppt.mjs`
- 该脚本固定导出 `.pptx`，不生成预览图片
