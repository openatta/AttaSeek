---
name: write-plan
description: Write implementation plan with dependency order, vertical slices, precise file paths and verify commands
---

# 编写实现计划

开始声明："正在使用 write-plan。"

> **注意**：此 skill 产出**正式的独立计划文档**（`docs/plans/*.md`），适用于需要多人审阅或存档的大规模重构。
> 日常开发请使用 `/implement`——它用轻量内联任务列表替代独立文档，更高效。

## 核心原则

计划是**执行指令**——告诉实施者改哪个文件、做什么操作、如何验证。不是教程，不写实现代码。

- 任务粒度：10-20 分钟可完成
- 每个任务只改一个逻辑点
- 按依赖排序——先底层后上层
- 垂直切片优先——先交付端到端路径

## 任务格式

```markdown
### Task N: [标题]

**Files:**
- Create: `path/to/new-file.ts`
- Modify: `path/to/existing-file.ts`
- Delete: `path/to/old-file.ts`

- [ ] 做什么操作（一句描述，不给代码）
- [ ] 验证命令: `npx vitest run test/path/`
- [ ] 提交: `git commit -m "scope: description"`
```

每个 task 描述清楚**要写什么功能**，但**不写实现代码**。

## 禁止

计划中不出现：
- 完整代码块（TypeScript/TSX/CSS/SQL/HTML）
- TODO / TBD / "完善错误处理" / "处理边界情况" / "类似 Task N"
- 引用还没定义的函数/类型/接口

## 计划头

```markdown
# [功能名] 实现计划

**目标：** 一句话
**涉及进程：** main / preload / renderer
**预期任务数：** ~N
```

## 产出位置

`docs/plans/YYYY-MM-DD-[name].md`

## 自检

- 每个需求有对应任务
- 无占位符
- 依赖顺序正确
- 每个 task 文件路径精确

## 交接

完成后执行 → `/execute-plan`
