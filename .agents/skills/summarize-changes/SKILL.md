---
name: summarize-changes
description: Summarize what changed, what was not touched, risks identified, verification steps, and next steps
---

# 变更总结

开始声明："正在使用 summarize-changes。"

## 输出格式

```markdown
## CHANGES MADE

- `path/file.ts` — 改了什么
- `path/file2.ts` — 改了什么

## THINGS I DIDN'T TOUCH

- `path/other.ts` — 发现 X 问题但不在本任务范围

## POTENTIAL CONCERNS

- 风险点 1
- 风险点 2

## VERIFICATION

- `npm test` — 结果
- `npm run build` — 结果
- 手工验证 — 结果

## NEXT STEPS

- 建议下一步
```

## 原则

不夸大、不隐藏失败、明确分清"做了"和"没做"
