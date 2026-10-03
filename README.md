# 五笔学习（Wubi Practice）

一个部署在 GitHub Pages 上的免费五笔学习网站：**免安装、打开即练**，纯静态、无后端。

在线体验：<https://ltywk.github.io/wubi-practice/>

支持 **86 版（微软五笔）** 与 **98 王码** 两套输入方案，顶部下拉一键切换，进度与错题按方案独立保存。

## 功能

- **双输入方案**：默认 86 版，顶部下拉切换 98 王码；码表、字根表、键盘布局、字根字体随方案整体切换，进度 / 错题 / 统计互不干扰。
- **关卡地图**：6 个阶段、29 个小关（字根启蒙 → 简码入门 → 常用字攻坚 → 文章实战 → 综合挑战 → 终极挑战）。阶段内小关顺序自由，全部达标后解锁下一阶段。
- **字根练习**：五区键位图随机出题，覆盖每个键位的**全部字根**，键位高亮与即时反馈。
- **单字练习**：一级简码、二级简码、常用字、识别码专题；常驻显示全码与拆字提示，底部键盘实时高亮下一应按键。
- **字根键盘**：按人工配置的 **4×4 / 5×5 矩阵**逐键渲染字根（键名用主题主色强调、红/绿标记、随主题配色），底部显示字母与一级简码；移动端保留「字根 + 字母 + 简码」三要素。
- **文章训练**：公版诗文与政府公文合集（五言/七言诗、宋词、古文、现代文，以及政府工作报告节选，每篇 200 字以上），按段落连续输入。
- **自由模式**：任选内置文章，或粘贴自定义文本练习。
- **错题与智能加练**：全程记录错误；按「错误率 + 平均耗时」打分，挑出最需要练的字。
- **实时统计**：速度、正确率、完成度、用时、超时次数，每秒刷新。
- **界面**：QWERTY 虚拟键盘、五态文字配色、居中/左对齐切换、浅色/深色主题。
- **音效**：按键正确 / 错误 / 超时提示音，音量可调。
- **存档**：进度自动保存在本机；支持导出 / 导入 JSON 存档、一键解锁全部关卡。

## 技术栈

| 层面 | 选型 |
|---|---|
| 语言 | TypeScript（`strict: true`） |
| 框架 | Vue 3（SFC + `<script setup>` + 组合式 API） |
| 构建 | Vite 5 |
| 路由 | vue-router 4（hash 模式，适配 GitHub Pages） |
| 测试 | Vitest + @vue/test-utils（118 项，含 86/98 两套各 29 关自动通关冒烟） |
| 质量 | ESLint 9（flat config）+ typescript-eslint + Prettier |
| 包管理 | pnpm |

运行时依赖仅 `vue`、`vue-router`，零 UI 库、零状态管理库。

## 快速开始

```bash
pnpm install
pnpm data:build   # 生成 86/98 码表、字根表与文章数据（首次必须执行）
pnpm dev          # 本地开发
```

构建与全量校验：

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm data:verify
```

仅跑关卡冒烟测试（两方案）：

```bash
pnpm test:levels
```

## 项目结构

```
doc/                  需求与设计文档
scripts/              数据构建与校验（不进入前端产物）
  sources/            原始数据源（86/98 码表、拆解、人工字根配置、文章）
  build-chars.ts      86/98 码表 → src/data/generated/{scheme}/*.json
  build-zigen.ts      字根表 + 键盘布局（人工配置）→ zigen.json / radical-weights.json
  verify-data.ts      两方案数据校验
  verify-articles.ts  文章数据校验
tools/root-tagger/    字根标注器：人工标注字根归属与键盘布局，导出配置
src/
  engine/             纯逻辑引擎（判定、统计、计时、加练打分）
  schemes/            输入方案接口与 registry（86 / 98 实现）
  data/               关卡配置、出题池、按方案加载器
  composables/        存档（按方案隔离）、进度、错题、UI 设置
  components/         虚拟键盘、文本面板、统计条、结算弹窗等
  views/              地图 / 练习 / 自由模式 / 外观 / 存档
  assets/fonts/       86 与 98 字根字形字体
  testing/            可编程测试接口（键盘注入、关卡冒烟）
```

## 数据来源与致谢

### 86 版（微软五笔）

- 编码事实源：[RIME rime-wubi](https://github.com/rime/rime-wubi) 的 `wubi86.dict.yaml`（LGPL-3.0）。
- 字根拆解：[hantang/search-wubi](https://github.com/hantang/search-wubi) 的 86 版字根拆解序列，经 `scripts/sources/roots-map.json` 映射为字根文本。

### 98 王码（特别感谢 [98wb](https://github.com/98wb)）

本项目的 98 王码支持完整受益于 **98 五笔资源库（[98wb](https://github.com/98wb) / [yanhuacuo](https://github.com/yanhuacuo)）** 的开源项目与资料：

- **98 码表**：[`yanhuacuo/98wubi-tables`](https://github.com/yanhuacuo/98wubi-tables)（98 五笔基础码表，Unlicense）的 98 超集 RIME 码表 `wubi98_U.dict.yaml` —— 作为 `scripts/sources/wubi98.dict.yaml`，是 98 单字编码（全码与简码）的事实源。
- **98 字根拆解**：同仓库 `98五笔拆分映射表/` 的 `spelling3.txt`（GB18030 字集，字根以补充私有区 PUA 序列存储）—— 作为 `scripts/sources/data-wubi-v98.tsv`，提供 98 拆字提示与识别码判定。
- **98 字根字形字体**：`98WB-0.otf`（覆盖 `U+F0000–F0170`）—— 作为 `src/assets/fonts/wubi98-roots.otf`，用于渲染 98 全部字根字形。
- **98 键位口诀**：由 98 五笔资源库整理的 25 键口诀，用于键盘注释。

此外，86 / 98 的**字根表与键盘布局**（每键字根清单、4×4/5×5 矩阵位置、键名/标记）由本项目通过 `tools/root-tagger` 字根标注器**人工标注整理**，并与码表 + 拆解数据交叉校验后固定采用。

### 其他

- 常用字分级：《通用规范汉字表》一级字（3500 字）。
- 文章素材：维基文库（Wikisource）公有领域诗文集；政府工作报告节选选自中国政府网（国家机关公文，不适用著作权保护）。

输入法标准：**微软五笔（86 版王码）** 与 **98 王码**。

## 部署

推送到 `main` 分支后，GitHub Actions 自动执行 `pnpm data:build` 构建并发布到 GitHub Pages（见 `.github/workflows/deploy.yml`）。
首次部署需在仓库 **Settings → Pages → Source** 选择 **GitHub Actions**。

## 开源协议

[GPL-3.0](LICENSE) © 2026 LtyWK

本项目为个人学习工具，与王码公司无关。
