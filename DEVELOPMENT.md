# AttaSeek 开发指导

> AttaSeek 是 Electron + React 18 + TypeScript 的 AI Agent 工作台桌面应用。
> 视觉与功能以 Codex Desktop 为源头参考。

## 项目架构

AttaSeek 按 Electron 三进程分层：

```
src/
├── main/          # 主进程 — BrowserWindow、IPC handler、SQLite、文件系统、MCP 子进程
├── preload/       # 预加载 — contextBridge 暴露安全 API，类型同步
└── renderer/      # 渲染进程 — React 组件、Jotai atoms、Tailwind 样式
    ├── components/
    │   ├── ActivityBar/     # 48px 左轨导航
    │   ├── Sidebar/         # 260px 上下文面板
    │   ├── Conversation/    # Agent 对话面板（消息流、工具调用、权限确认、输入区）
    │   ├── Artifact/        # 产物面板（Code/Diff/Preview/Terminal/Browser TAB）
    │   ├── Terminal/        # 集成终端（xterm.js）
    │   └── Diff/            # Diff 查看器（Monaco Editor）
    └── panels/              # 可拖拽面板系统
```

## 完整 SDLC 链路

```
需求模板                     /analyze-requirements      需求分析（按 Electron 三层探索）
    │                              │
    └────────→─────────────────────┘
                                     │
                              /design-architecture       架构设计（三进程 + IPC + Jotai）
                                     │
                              /write-plan                计划编写（按进程层排序任务）
                                     │
                              /execute-plan              增量实施（Vite HMR + 主进程重启）
                                     │
                                     ├──→ /test-driven-development   TDD 循环（每增量内）
                                     │
                              /code-review               代码审查（含 Electron 安全）
                                     │
                              /summarize-changes         变更总结（按进程层分组）
```

每个阶段的职责和产出：

| 阶段 | Skill | 输入 | 产出 |
|------|-------|------|------|
| **需求分析** | `/analyze-requirements` | 需求模板 / spec / 用户反馈 | 需求说明：按 Electron 三层评估影响范围 |
| **架构设计** | `/design-architecture` | 需求说明 | 设计文档：三进程结构、组件树、IPC contract、Jotai atoms |
| **计划编写** | `/write-plan` | 设计文档 | 实现计划：依赖图→垂直切片→精确文件路径→验证命令 |
| **增量实施** | `/execute-plan` | 实现计划 | 可工作代码：逐任务执行、区分 HMR/主进程重启 |
| **TDD** | `/test-driven-development` | 每个任务 | RED→GREEN→REFACTOR 循环，Vitest/Playwright |
| **代码审查** | `/code-review` | 变更 diff | 审查结论：正确性/可读性/架构/Electron安全/性能 |
| **变更总结** | `/summarize-changes` | 变更内容 | 结构化总结：按主进程/预加载/渲染进程分组 |

## 使用方式

### 完整功能开发

```bash
# 1. 从需求模板开始
复制 docs/requirements/REQUIREMENT_TEMPLATE.md → docs/requirements/YYYY-MM-DD-[feature-name].md
按模板填写需求

# 2. SDLC 链路
/analyze-requirements     # 理解需求，探索 main/preload/renderer 代码
/design-architecture      # 设计三进程结构、组件树、IPC contract、Jotai atoms
/write-plan               # 编写精确到文件的实现计划
/execute-plan             # 增量实施（区分 HMR 和主进程重启）
/code-review              # 五维审查（重点 Electron 安全）
/summarize-changes        # 按进程层分组总结
```

### 小改动快捷路径

需求明确、单面板或少量文件改动：

```bash
/write-plan → /execute-plan → /summarize-changes
```

### Bug 修复

```bash
/test-driven-development  # Prove-It：写复现测试→确认失败→修复→确认通过
/code-review              # 审查修复
/summarize-changes        # 总结变更
```

### 重构

```bash
/analyze-requirements     # 理解现有代码、明确重构边界
/write-plan               # 编写重构计划
/execute-plan             # 增量实施（每步保持可构建）
/code-review              # 审查重构结果（检查是否引入死代码）
/summarize-changes        # 总结变更
```

### 审查已有代码

```bash
/code-review              # 五维审查 + 分级反馈（含 Electron 安全五条）
```

### 单个任务 TDD

```bash
/test-driven-development  # RED → GREEN → REFACTOR
```

## Skill 调用名一览

Skill 是**思考模式**，不是代码模板——它们告诉 AI 如何思考、产出什么格式、遵循什么约束，而不是贴大段示例代码。项目知识（架构、技术栈、文件布局）已在 CLAUDE.md 中，skill 不重复。

| 调用命令 | 文件 | 用途 |
|----------|--------|------|
| `/analyze-requirements` | `analyze.md` | 需求分析 → 产出需求说明（用户场景+范围+风险） |
| `/design-architecture` | `design.md` | 架构设计 → 产出设计文档（组件结构+数据流+IPC） |
| `/write-plan` | `plan.md` | 编写计划 → 产出精确任务列表（文件+操作+验证命令） |
| `/execute-plan` | `implement.md` | 按计划增量实施 → 逐任务 TDD → 每步提交 |
| `/test-driven-development` | `test.md` | TDD 循环：RED→GREEN→REFACTOR |
| `/code-review` | `review.md` | 五维审查 → 分级反馈 |
| `/summarize-changes` | `summarize.md` | 变更总结 → 改了什么/没改什么/风险/验证

## Electron 关键规则

AttaSeek 开发中必须遵守的 Electron 特有纪律：

1. **渲染进程不直接访问 Node.js** — 所有系统能力通过 `contextBridge` 在 preload 中暴露
2. **nodeIntegration: false** — 始终保持关闭，不可打开
3. **IPC 输入不可信** — 主进程 handler 必须校验渲染进程传入的所有数据
4. **预加载变更需重启** — 修改 `src/preload/index.ts` 后必须重启整个 Electron 进程，Vite HMR 不覆盖预加载
5. **主进程变更需重启** — 修改 IPC handler 或 BrowserWindow 配置后需重启主进程
6. **每个 IPC channel 有类型** — preload 中的 API 签名与主进程 handler 类型必须同步

## 需求模板

新功能从需求模板开始：

```
docs/requirements/REQUIREMENT_TEMPLATE.md        ← 模板文件
docs/requirements/YYYY-MM-DD-[feature-name].md   ← 复制后填写，归档于此
```

需求模板覆盖：目标与背景、用户场景（正常/异常/边界）、Electron 三层影响、涉及面板、交互设计、Jotai atoms、IPC channels、安全考量、平台差异、验收标准。

## 核心原则

所有 skill 共享以下原则：

- **DRY**：不重复无意义内容
- **YAGNI**：不过度设计，不为假想未来需求抽象
- **TDD 铁律**：生产代码之前必须先有失败测试
- **小步提交**：每个增量 2～5 分钟，每步系统保持可构建
- **范围纪律**：只改任务要求的内容，不顺带改无关代码
- **无占位符**：计划中不出现 TBD/TODO/模糊描述
- **先审后做**：执行计划前先批判性审查
- **安全优先**：contextBridge 最小化、IPC 输入校验、CSP 策略

## 文件存放位置

| 内容 | 路径 |
|------|------|
| Skill 定义 | `.claude/skills/*.md` |
| Skill 注册 | `.claude/settings.json` → `"skills"` 字段 |
| 实现计划 | `docs/plans/YYYY-MM-DD-[feature-name].md` |
| 需求模板 | `docs/requirements/REQUIREMENT_TEMPLATE.md` |
| 需求归档 | `docs/requirements/YYYY-MM-DD-[feature-name].md` |
| UI 设计规格 | `docs/ui.md` |
