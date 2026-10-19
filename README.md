# 五笔学习（Wubi Practice）

一个部署在 GitHub Pages 上的免费五笔学习网站：**免安装、打开即练**，纯静态、无后端。

在线体验：<https://ltywk.github.io/wubi-practice/>

支持 **98 王码**（默认）与 **86 版（微软五笔）** 两套输入方案，顶部下拉一键切换，进度与错题按方案独立保存。

## 功能

- **双输入方案**：默认 98 王码，顶部下拉切换 86 版；码表、字根表、键盘布局、字根字体随方案整体切换，进度 / 错题 / 统计互不干扰。
- **关卡地图**：6 个阶段、41 个小关（字根启蒙 → 简码入门 → 识别码专题 → 常用字爬坡 → 词组爬坡 → 挑战关卡）。阶段内小关顺序自由，全部达标后解锁下一阶段；未解锁阶段可在卡片上手动解锁（弹窗确认）。
- **字根练习**：五区键位图随机出题，覆盖每个键位的**全部字根**，键位高亮与即时反馈。
- **单字练习**：一级简码、二级简码、全码训练、识别码专题；常驻显示全码与拆字提示，底部键盘实时高亮下一应按键。
- **退格修正**：文本练习中可按退格键（或点虚拟键盘 ⌫）删除当前字已输入的字符；已发生的错误统计不回滚。
- **字根键盘**：按人工配置的 **4×4 / 5×5 矩阵**逐键渲染字根（键名用主题主色强调、红/绿标记、随主题配色），底部显示字母与一级简码；移动端保留「字根 + 字母 + 简码」三要素。
- **跟打器**：只接收输入法提交的汉字、不关心输入法；实时速度、正确率、错误字与拆字提示卡片；光标与输入法候选框跟随当前待输入字；底部为带字根矩阵的虚拟键盘，物理按键按下即点亮；流式文本支持居中 / 左对齐切换（诗词古文关默认居中）；支持严格改错、Esc 重开、粘贴屏蔽。
- **S4 常用字爬坡**：3500 常用字按字频分 5 关（每关 700 字），10 字一组；速度达标自动进入下一组、未达标自动重来，训练不中断；通关速度 35 / 50 / 70 字/分可选；逐组保存进度，可回打已通关组或重新随机；另有「常用字综合 200」——全键位综合形式，每次进入从 3500 字全池随机抽 200 字一次打完。
- **S5 词组爬坡**：常用二字词（2 关）、三字词、四字词共 4 关 +「常用词综合 200」（按 7:2:1 随机抽 200 词，一次打完），10 词一组按汉字数计算速度；机制与常用字爬坡一致。
- **S6 挑战关卡**：诗词限时冲刺、古韵逐段提速、现代文耐力长跑、无尽词流、公文终极挑战与毕业综合测试；素材取自公版诗文、古文、现代文与政府工作报告节选。
- **自由模式**：跟打器界面，任选内置文章或粘贴自定义文本；不计关卡进度，也不写入单字统计与错题本。
- **错题与智能加练**：S1–S3 编码练习全程记录错误；按「错误率 + 平均耗时」打分，挑出最需要练的字。
- **实时统计**：速度、正确率、击键（键/分）、完成度、用时与超时次数，实时刷新；跟打器结算按达成率评定 S/A/B/C 段位。
- **界面**：QWERTY 虚拟键盘（跟打模式按键点亮反馈）、五态文字配色、居中/左对齐切换、浅色/深色主题。
- **音效**：按键正确 / 错误 / 超时提示音，音量可调。
- **存档**：进度（含爬坡组进度、段位与无尽模式纪录）自动保存在本机；支持导出 / 导入 JSON 存档、一键解锁全部关卡。

## 技术栈

| 层面 | 选型 |
|---|---|
| 语言 | TypeScript（`strict: true`） |
| 框架 | Vue 3（SFC + `<script setup>` + 组合式 API） |
| 构建 | Vite 5 |
| 路由 | vue-router 4（hash 模式，适配 GitHub Pages） |
| 测试 | Vitest + @vue/test-utils（247 项，含 86/98 两套 S1–S3 编码冒烟、跟打器配置校验、9 关爬坡冒烟与跟打显示体验） |
| 质量 | ESLint 9（flat config）+ typescript-eslint + Prettier |
| 包管理 | pnpm |

运行时依赖仅 `vue`、`vue-router`，零 UI 库、零状态管理库。

## 快速开始

```bash
pnpm install
pnpm data:build   # 生成 86/98 码表、字根表、常用字/词组与文章数据（首次必须执行）
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
  build-chars.ts      86/98 码表 → src/data/generated/{scheme}/*.json + common3500.json
  build-zigen.ts      字根表 + 键盘布局（人工配置）→ zigen.json / radical-weights.json
  build-words.ts      86 码表 → 常用词组 words.json（权重降序 + 黑名单）
  verify-data.ts      两方案数据校验（含 common3500 / words）
  verify-articles.ts  文章数据校验
tools/root-tagger/    字根标注器：人工标注字根归属与键盘布局，导出配置
src/
  engine/             纯逻辑引擎（judge / stats / timer / drill / typing 跟打判定 / rank 段位）
  schemes/            输入方案接口与 registry（86 / 98 实现）
  data/               关卡配置、出题池、按方案与跟打器数据加载器
  composables/        存档（按方案隔离）、进度、错题、useTypingInput 跟打输入捕获、UI 设置
  components/         虚拟键盘（按键点亮反馈）、文本面板、拆字提示、统计条、TypingProgress 爬坡、TypingResult 跟打结算
  views/              地图 / 编码练习 / TypingView 跟打器 / 自由模式 / 外观 / 存档
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

- 常用字分级与训练数据：《通用规范汉字表》一级字（3500 字），按字频降序生成 `common3500.json`，供 S4 常用字爬坡与 S6 毕业综合使用。
- 词组训练数据：从 86 版 RIME 码表按权重降序提取纯汉字词条，生成 `words.json`（二字词 1000 / 三字词 200 / 四字词 200，内置人工黑名单），86/98 共用，供 S5 词组爬坡与 S6 无尽词流使用。
- 文章素材：维基文库（Wikisource）公有领域诗文集；政府工作报告节选选自中国政府网（国家机关公文，不适用著作权保护）。素材用于 S6 挑战关卡与自由模式。

输入法标准：**微软五笔（86 版王码）** 与 **98 王码**。

## 部署

推送到 `main` 分支后，GitHub Actions 自动执行 `pnpm data:build` 构建并发布到 GitHub Pages（见 `.github/workflows/deploy.yml`）。
首次部署需在仓库 **Settings → Pages → Source** 选择 **GitHub Actions**。

## 开源协议

[GPL-3.0](LICENSE) © 2026 LtyWK

本项目为个人学习工具，与王码公司无关。
