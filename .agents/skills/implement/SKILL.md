---
name: implement
description: Plan then execute — write lightweight inline task list, get confirmation, then implement incrementally with TDD and verification
---

# 规划与实施

开始声明："正在使用 implement。"

此 skill 将"计划"和"执行"合并为一次流程，适用于大多数开发场景。大规模重构或需正式计划文档时，仍可使用 `/write-plan` + `/execute-plan`。

## 流程

**Phase 1: 规划（轻量，不产出独立文档）**

1. **读需求与设计** — 确认输入已就绪（需求分析 / 架构设计）
2. **产出内联任务列表** — 直接在对话中列出 task，格式简洁：
   ```
   ## Task List (~N tasks)
   - T1: [标题] — [涉及文件]
   - T2: [标题] — [涉及文件]
   - ...
   ```
   不写 `docs/plans/*.md` 文件。任务粒度 10-20 分钟，按依赖排序。
3. **用户确认** — 展示 task list，等待用户批准后进入执行

**Phase 2: 执行**

对每个 task：
```
1. 理解任务 → 读相关代码
2. 写代码  → 仅改任务要求的文件
3. 检视   → 检视实现的代码有没有缺陷不足并修复
4. 验证    → 运行测试 + typecheck + build
5. 下一个  →
```

**Phase 3: 收尾**

全部 task 完成后：
- `npx vitest run` — 全量测试
- `npx tsc -p tsconfig.web.json --noEmit` — typecheck
- `npm run build` — 构建
- `/summarize-changes` — 总结变更

## 规则

- **范围纪律**：只改任务要求的内容。发现无关问题不顺手改——记录下来询问用户
- **简单优先**：写最简可工作版本。不过度抽象，不为假想需求设计
- **遇到阻塞就停下**：不要硬猜，向用户求助
- **每个增量后可构建**：typecheck + build 必须始终通过

## 优先用 TDD

每个 task 内部优先遵循 RED→GREEN→REFACTOR：
1. 写失败测试 → 2. 确认失败 → 3. 最小实现 → 4. 确认通过 → 5. 重构

## 何时用此 skill

| 场景 | 用哪个 |
|------|--------|
| 日常功能开发（最常见） | `/implement` ← 这个 |
| 需要正式设计文档且多人审阅 | `/design-architecture` → `/write-plan` → `/execute-plan` |
| 已有现成实现计划文件，只需执行 | `/execute-plan` |
| 只需写计划文档（不执行） | `/write-plan` |
| 单文件小改动 | 直接干，无需 skill |

## 交接

完成后执行 → `/summarize-changes`
