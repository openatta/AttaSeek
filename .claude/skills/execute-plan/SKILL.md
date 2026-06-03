---
name: execute-plan
description: Execute a plan incrementally by reviewing the plan first then implementing task by task while keeping the build working at each step
---

# 按计划实施

开始声明："正在使用 execute-plan。"

> **注意**：此 skill 用于执行**已有的正式计划文档**（`docs/plans/*.md`）。
> 日常开发请使用 `/implement`——它将轻量规划与执行合并为一次调用。

## 执行循环

对每个 task：

```
1. 理解任务 → 读相关代码
2. 写代码  → 仅改任务要求的文件
3. 检视   → 检视实现的代码有没有缺陷不足并修复
4. 验证    → 运行测试 + typecheck + build
5. 提交    → git commit
6. 下一个  →
```

每个增量后项目必须可构建。

## 规则

- **范围纪律**：只改任务要求的内容。发现无关问题不顺手改——记录下来询问用户
- **简单优先**：写最简可工作版本。不过度抽象，不为假想需求设计
- **遇到阻塞就停下**：不要硬猜，向用户求助

## 优先用 TDD

每个 task 内部优先遵循 RED→GREEN→REFACTOR：
1. 写失败测试 → 2. 确认失败 → 3. 最小实现 → 4. 确认通过 → 5. 重构

## 完成

所有 task 完成后：
- `npx vitest run` — 全量测试
- `npx tsc --noEmit` — typecheck
- `npm run build` — 构建
- `/summarize-changes` — 总结变更
