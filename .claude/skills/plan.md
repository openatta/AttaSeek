---
name: write-plan
description: 编写实现计划：依赖图→垂直切片→精确到文件/命令的任务，按 Electron 三进程分层
---

# 编写实现计划

## 概述

在架构设计完成后、写代码前，编写一份完整的实现计划。针对 AttaSeek，任务按 Electron 三进程分层组织：**主进程 → 预加载 → 渲染进程**，实现顺序从底层依赖逐步向上。

计划应假设执行者是有经验的开发者，但不了解当前代码库细节。因此计划必须清楚说明：

- 每个任务要改哪些文件（标注进程层）
- 每个文件负责什么
- 需要写什么代码
- 需要写什么测试
- 如何验证（包括 Electron 特有的预加载重建验证）
- 如何提交

原则：

- TDD 铁律：生产代码之前先有失败测试
- 小步提交：每个增量 2～5 分钟，每步系统保持可构建
- 垂直切片：先交付端到端路径，再补完整功能
- 范围纪律：只改任务要求的内容

开始时声明：

"我正在使用 write-plan skill 创建实现计划。"

## 什么时候使用

使用场景：

- 已有 spec 或设计文档，需要拆成实现单元
- 任务太大或太模糊
- 需要多个 agent 或多个会话并行
- 需要向他人说明工作范围
- 实现顺序不明显

不适合：

- 单文件简单修改
- spec 已经拆好了可直接执行的任务

## 范围检查

如果需求覆盖多个彼此独立的子系统，应建议拆成多个计划。

每个计划都应该能独立产出可运行、可测试的软件。

## Step 1: 进入计划模式

写代码前只读：

- 阅读需求说明和设计文档
- 阅读相关代码（main / preload / renderer 三层）
- 识别现有模式和约定
- 找出组件依赖和 IPC 依赖
- 记录风险和未知项

**不要在规划阶段写代码。**

## Step 2: 建立依赖图

AttaSeek 的典型依赖链：

```
数据库 schema（主进程）
  → IPC handler（主进程）
    → contextBridge API（预加载）
      → Jotai atoms（渲染进程）
        → React 组件（渲染进程）
          → Tailwind 样式（渲染进程）

Electron 特定：
BrowserWindow 配置（主进程）
  → preload 脚本注册（主进程）
    → contextBridge 暴露（预加载）
```

实现顺序应从底层依赖开始，逐步向上。

## Step 3: 优先垂直切片

不要这样做：

- Task 1：做完整数据库
- Task 2：做所有 IPC
- Task 3：做所有 UI
- Task 4：最后连接

应该这样做：

- Task 1：用户可以在 Conversation 面板中看到新入口
- Task 2：用户可以触发操作并看到结果
- Task 3：操作结果可以持久化
- Task 4：操作结果可以在其他面板中查看

每个垂直切片都应该可运行、可测试。

## Step 4: 写精确任务

每个任务使用如下结构。AttaSeek 的任务文件路径必须与项目结构对应：

### Task N: [组件或功能名]

**进程层：** main / preload / renderer

**Files:**

- Create: `src/main/ipc/some-handler.ts`
- Create: `src/renderer/components/Feature/NewComponent.tsx`
- Modify: `src/preload/index.ts`
- Modify: `src/renderer/atoms/someAtom.ts`
- Test: `test/unit/some-handler.test.ts` 或 `test/e2e/feature.spec.ts`

- [ ] Step 1: 写失败测试

给出完整测试代码。标注测试类型（unit / integration / e2e）。

- [ ] Step 2: 运行测试，确认失败

给出准确命令和预期失败结果。

Electron 特定测试命令示例：
```bash
npx vitest run test/unit/some-handler.test.ts  # 单元测试
npx playwright test test/e2e/feature.spec.ts    # E2E 测试
```

- [ ] Step 3: 写最小实现

给出完整代码。

- [ ] Step 4: 运行测试，确认通过

给出准确命令和预期通过结果。

- [ ] Step 5: 验证 HMR / 主进程重启

对于以下变更，需要确认 Electron 热更新或重启生效：
- 修改 preload → 需要**重启整个 Electron 进程**（`npm run dev` 重启）
- 修改主进程 IPC handler → 需要**重启主进程**
- 修改渲染进程 → Vite HMR 自动生效

- [ ] Step 6: 提交

给出 `git add` / `git commit` 命令。

## 任务粒度

每个步骤应是一个很小的动作，通常 2～5 分钟可完成。

任务大小参考：

- **XS**：1 个文件，单函数或配置
- **S**：1～2 个文件，一个组件或单 IPC channel
- **M**：3～5 个文件，一个功能切片（如一个面板的新子功能）
- **L**：5～8 个文件，多组件功能（如新面板）
- **XL**：8 个以上文件，太大，必须拆分

agent 最适合执行 S 和 M 任务。

如果出现以下情况，继续拆分：

- 一个任务需要超过一个聚焦会话
- 验收标准超过 3 条仍说不清
- 触及两个独立面板
- 跨进程（main + renderer 混合在同一个任务里）
- 任务标题里出现"和"

## Step 5: 设置检查点

每 2～3 个任务后设置验证检查点：

```markdown
## Checkpoint: After Tasks 1-3

- [ ] 所有测试通过
- [ ] TypeScript 编译无错误：`npx tsc --noEmit`
- [ ] 构建通过：`npm run build`
- [ ] Electron 启动正常，新功能可交互
- [ ] 继续前让用户 review
```

## 并行化机会

可以并行：

- 独立面板功能
- 主进程纯逻辑 + 渲染进程纯 UI（contract 已定义后）
- 单元测试

必须串行：

- 数据库迁移 → IPC handler → preload API → 渲染组件
- 共享 Jotai atom 的上游变更
- BrowserWindow 配置变更

需要协调：

- IPC contract 变更：先定义类型，再分头实现 main 和 renderer

## 禁止占位符

计划里不能出现：

- TBD
- TODO
- implement later
- fill in details
- "添加适当错误处理"
- "处理边界情况"
- "为上面内容写测试"
- "类似 Task N"
- 只描述做什么但不给具体代码
- 引用还没定义过的函数、类型或方法
- 忽略 preload 层的类型同步

## Step 6: 自检

计划写完后重新检查：

1. **规格覆盖**：每个需求是否都有任务对应？
2. **占位符扫描**：是否还有 TODO/TBD/模糊描述？
3. **类型一致性**：前后任务里的函数名、类型名、字段名是否一致？
4. **三层完整性**：涉及 IPC 的任务是否覆盖了 main / preload / renderer 三层？
5. **依赖排序**：任务依赖已排序，不会出现先做上层再做底层？
6. **任务大小**：没有超过约 5 个文件的任务？

如果发现缺口，直接补充任务。

## 计划文档头部

每个计划必须包含：

```markdown
# [功能名] 实现计划

> 给执行者的要求：
> 推荐使用 /execute-plan 按任务执行。
> 每个任务参考 /test-driven-development 进行 TDD 循环。

**目标：** 一句话说明要构建什么
**涉及进程：** main / preload / renderer
**技术栈：** Electron + React 18 + TypeScript + Jotai + Tailwind + SQLite
**相关面板：** Conversation / Artifact / Terminal / Sidebar / ActivityBar / Diff
```

## 计划保存位置

默认保存到：

`docs/plans/YYYY-MM-DD-[feature-name].md`

## 交接

计划完成后给出执行选项：

1. **agent 执行**：每个任务派发独立 agent，任务间做 review
2. **内联执行**：当前会话中使用 `/execute-plan` 逐步执行
