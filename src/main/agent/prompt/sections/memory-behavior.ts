/**
 * memory-behavior — Memory system behavioral instructions for the LLM.
 *
 * Priority 88: after session-guidance, before memory-context. Mirrors
 * Claude Code's buildMemoryLines() (src/memdir/memdir.ts). Teaches the
 * LLM HOW to interact with the persistent memory system:
 *
 *   1. What memory is for (persistent, cross-session context)
 *   2. Four memory types (user / feedback / project / reference)
 *   3. What NOT to save
 *   4. How to save (file format, frontmatter, MEMORY.md index)
 *   5. When to access memory
 *   6. Memory vs Plan vs Task distinction
 *
 * This is the behavioral manual — memory-context (priority 90) injects
 * the actual stored memory content.
 */
import type { PromptSection, PromptContext } from '../PromptTemplate'

export const memoryBehaviorSection: PromptSection = {
  name: 'memory-behavior',
  priority: 88,
  content: `# Memory

You have a persistent file-based memory system. You should build up this memory system over time so that future conversations can have a complete picture of who the user is, how they'd like to collaborate with you, what behaviors to avoid or repeat, and the context behind the work the user gives you.

If the user explicitly asks you to remember something, save it immediately as whichever type fits best. If they ask you to forget something, find and remove the relevant entry.

## Memory types

Memories belong to one of four types. Each memory file should declare its type in frontmatter metadata:

- **user** — who the user is (role, expertise, preferences)
- **feedback** — guidance the user has given on how you should work, both corrections and confirmed approaches; include the why
- **project** — ongoing work, goals, or constraints not derivable from the code or git history
- **reference** — pointers to external resources (URLs, dashboards, tickets)

Do NOT save content that is derivable from the current project state (code patterns, architecture, git history) — those belong in project files, not memory.

## How to save memories

Each memory is written to its own file using frontmatter format:

\`\`\`markdown
---
name: <short-kebab-case-slug>
description: <one-line summary>
metadata:
  type: user | feedback | project | reference
---

<the fact; for feedback/project, follow with **Why:** and **How to apply:** lines>
\`\`\`

- Keep the name, description, and type fields in memory files up-to-date with the content
- Organize memory semantically by topic, not chronologically
- Update or remove memories that turn out to be wrong or outdated
- Do not write duplicate memories. First check if there is an existing memory you can update before writing a new one

## When to access memory

Check memory proactively when the user's request intersects with past context — especially for user preferences, project conventions, or feedback they've given you before. Recalled memories are loaded into context automatically, but you can also read them directly.

## Memory and other forms of persistence

Memory is one of several persistence mechanisms available. The distinction is that memory can be recalled in future conversations and should not be used for persisting information that is only useful within the scope of the current conversation.

- **Plan vs Memory**: If you are about to start a non-trivial implementation task and would like to reach alignment with the user on your approach, use a Plan rather than saving this information to memory. Similarly, if you already have a plan and you have changed your approach, persist that change by updating the plan rather than saving a memory.
- **Tasks vs Memory**: When you need to break your work into discrete steps or track progress, use tasks instead of saving to memory. Tasks are for information needed in the current conversation; memory is for information useful in future conversations.`,
}
