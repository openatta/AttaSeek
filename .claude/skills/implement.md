---
name: execute-plan
description: 按计划增量实施：审查→逐任务执行→每步提交，适应 Electron Vite HMR + 主进程重启
---

# 按计划实施

## 概述

加载实现计划，先批判性审查，然后以增量方式逐步执行。针对 AttaSeek 的 Electron 架构，每步验证时注意区分 Vite HMR（渲染进程即时生效）和主进程/预加载变更（需重启 Electron）。

开始时声明：

"我正在使用 execute-plan skill 实施计划。"

## 什么时候使用

使用场景：

- 已有书面实现计划
- 多文件变更（跨 main/preload/renderer 层）
- 大功能实现
- 新增面板或组件
- 重构现有代码

不适合：

- 单文件、单组件、范围很小的修改
- 没有计划的临时改动

## Step 1: 加载并审查计划

1. 阅读计划文件
2. 批判性检查计划
3. 找出问题、缺口、风险或不清楚的地方
4. 如果有问题，先向用户说明，不要直接开工
5. 如果没有问题，按任务顺序开始执行

## Step 2: 增量执行循环

对每个任务，执行内层循环：

```
┌─────────────────────────────────────────────────┐
│  For each task:                                 │
│                                                 │
│  1. Implement  → 写最小实现                      │
│  2. Test       → 运行测试                        │
│  3. Verify     → 确认测试通过 + 构建成功          │
│                  渲染进程变更：检查 HMR 生效      │
│                  main/preload 变更：重启 Electron │
│  4. Commit     → 提交这个增量                    │
│  5. Next       → 进入下一个任务                  │
└─────────────────────────────────────────────────┘
```

### Electron 特定验证

不同进程层的变更验证方式不同：

| 变更层 | 热更新 | 验证方式 |
|--------|--------|---------|
| 渲染进程（React 组件） | ✅ Vite HMR 即时生效 | 刷新浏览器窗口 |
| 渲染进程（Tailwind 样式） | ✅ Vite HMR 即时生效 | 样式即时更新 |
| 预加载（contextBridge） | ❌ 需重启 | `npm run dev` 重启 |
| 主进程（IPC handler） | ❌ 需重启 | 重启主进程 |
| 主进程（数据库变更） | ❌ 需重启 | 重启主进程 |

### 切片策略

**1. 垂直切片优先**

每个 slice 交付一个可工作的端到端路径：

- Slice 1：新面板的基本渲染和布局
- Slice 2：面板的核心交互和数据流
- Slice 3：数据持久化和 IPC 通信
- Slice 4：边界处理和异常状态

**2. Contract-first 切片**

当主进程和渲染进程需要并行时：

- Slice 0：定义 IPC contract / 类型（`src/preload/index.ts` 签名 + 类型文件）
- Slice 1a：主进程实现 IPC handler
- Slice 1b：渲染进程用 mock 数据按 contract 实现 UI
- Slice 2：集成并端到端测试（替换 mock 为真实 IPC）

**3. Risk-first 切片**

先做最高风险部分：

- Slice 1：证明 IPC channel 能建立通信
- Slice 2：证明 Electron 窗口配置正确
- Slice 3：实现完整功能

## 实施规则

### Rule 0: 简单优先

写代码前问："最简单可工作的方案是什么？"

写完代码后检查：

- 能否更少代码完成？
- 抽象是否真的值得？
- 是否在为假想未来需求设计？

先写直观、正确、朴素的版本。测试通过后再优化。

### Rule 0.5: 范围纪律

只改任务需要的内容。

不要：

- 顺手清理无关代码
- 重构旁边文件
- 删除你不完全理解的注释
- 添加 spec 没要求的功能
- 现代化你只是读过的文件

如果发现无关问题，记录下来而不是顺手改：

```
NOTICED BUT NOT TOUCHING:
- src/renderer/components/Sidebar.tsx 有未使用 import
- src/main/ipc/other-handler.ts 错误信息可以改进

是否需要我为这些创建单独任务？
```

### Rule 1: 一次只做一件事

一个增量只改变一个逻辑点。

坏例子：一个 commit 里新增组件 + 重构旧组件 + 更新 preload

好例子：

- commit 1：新增 React 组件
- commit 2：扩展 preload API（含类型同步）
- commit 3：注册 IPC handler

### Rule 2: 每步都保持可构建

每个增量后：

- TypeScript 编译无错误：`npx tsc --noEmit`
- Vite 构建成功：`npm run build`
- 现有测试通过
- 不要让代码库处于半坏状态

### Rule 3: 未完成功能使用 feature flag

如果功能还不能面向用户但需要合并小增量，用 feature flag 或条件渲染隐藏。

## 什么时候必须停止

遇到以下情况必须停止并求助：

- 缺少依赖（npm 包未安装 / native module 编译失败）
- 测试反复失败
- 跨进程通信异常（IPC 不通 / preload 未生效）
- 指令不清楚
- 计划有关键缺口
- 不理解某个步骤
- 验证无法通过

不要硬猜，不要强行继续。

## 什么时候回到审查阶段

如果用户修改了计划，或者发现整体方案需要重想，回到 Step 1 重新审查。

## Step 3: 完成开发

所有任务完成并验证后：

- 运行完整测试套件：`npm test`
- 运行构建：`npm run build`
- 手工在 Electron 中验证关键路径
- 使用 `/summarize-changes` 给出变更总结
- 使用 `/code-review` 做代码审查

## 完成检查

- 每个任务都已执行
- 每个增量都已提交
- TypeScript 编译通过
- 所有测试通过
- 构建成功
- Electron 启动正常
- 没有无关改动
- 没有一次性大改
- 代码库始终可构建
