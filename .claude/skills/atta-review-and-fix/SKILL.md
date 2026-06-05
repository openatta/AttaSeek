---
name: atta-review-and-fix
description: 检视与修复 — 审查变更的正确性/可读性/架构/安全/性能，修复发现的问题，产出变更总结。流程终点。
---

# 检视与修复

> **本阶段目标：** 对已完成的变更集做最终审查，修复发现的问题，产出变更总结。这是实施流程的终点。

## 前置条件

- 代码变更已完成（由 `/atta-plan-and-execute` 或 `/atta-implement` 产出）
- 全量测试、typecheck、build 已通过

## 流程

### Phase 1: 审查

按五维逐文件检查变更：

**正确性：** null/空值处理、错误路径、竞态条件、边界值。改动的逻辑是否真的正确？

**可读性：** 命名是否清楚？嵌套是否过深？抽象是否必要？是否引入了不必要的复杂度？

**架构：** 是否符合项目分层（main / preload / renderer）？模块边界是否清晰？是否存在循环依赖？

**安全：** contextBridge 暴露是否最小化？`nodeIntegration: false` 是否保持？IPC 是否有输入校验？secret 是否出现在日志中？

**性能：** 是否有不必要的 re-render？N+1 查询？同步阻塞？

问题分级：
- **Critical** — 安全漏洞、`nodeIntegration: true`、secret 泄露（阻塞合并）
- **Important** — 缺测试、无输入校验（必须修）
- **Nit** — 可选小问题
- **Suggestion** — 建议

### Phase 2: 修复

- Critical 和 Important 问题必须修复
- 修复后重新验证（typecheck + test + build）
- 修复本身也要自检，不引入新问题

### Phase 3: 总结

```markdown
## 变更总结

### 改动清单
- `path/file.ts` — 改了什么（一行说明）

### 未触碰
- `path/other.ts` — 发现 X 问题但不在本任务范围

### 潜在关注点
- 风险 1
- 风险 2

### 验证结果
- `npm test` — ...
- `npm run build` — ...
- 手工验证 — ...

### 后续建议
- ...
```

## 铁律

- **不新增功能** — 审查发现"应该加个 X"记为 Suggestion，不做。修 bug 不顺手加 feature。
- **不重构超出变更范围的代码** — 发现"这个模块整体写得不好"记录为后续建议，不在本次顺手改。
- **不死磕** — 发现 Critical 问题超过 3 个或架构级问题，退回到 `/atta-design-fix` 重新设计。

## 简报

审查与修复完成后，输出以下简报：

```markdown
## 检视与修复完成

### 审查结论
- 审查: ✅ Approved / ⚠️ Changes requested
- 问题: N 个 (Critical: X, Important: Y, Nit: Z)
- 已修复: N 个
- 状态: 就绪 / 需回退修改

### 变更总结
- ...（Phase 3 的完整总结）

### 如需回退

审查发现需要重大修改时：
→ `/atta-design-fix` → `/atta-plan-and-execute` → `/atta-review-and-fix`
或切到简化全流程：`/atta-bug-fix`

这是流程的**终点**。
```
