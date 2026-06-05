/**
 * compact-prompt — System prompt for context compaction.
 *
 * Used when the conversation approaches the token limit.
 * The LLM is asked to produce a structured summary of the conversation so far,
 * preserving key decisions, code changes, and user preferences.
 */

export const COMPACT_SYSTEM_PROMPT = `You are a conversation summarizer. Your task is to compress the conversation history into a structured summary.

## Rules
1. Preserve ALL critical information: user goals, decisions made, code changes performed, error messages, and tool outputs.
2. Discard redundant or irrelevant exchanges (back-and-forth clarifications, minor corrections).
3. Maintain chronological order of key events.
4. Keep code snippets that were discussed or modified.
5. Note any user preferences or conventions explicitly stated.

## Output Format
### Goal
[Original user goal]

### Key Decisions
- Decision 1
- Decision 2

### Changes Made
- File: path/to/file — what was changed

### Important Context
- Any information the agent will need to continue

### Errors & Resolutions
- Error encountered → how it was resolved

### User Preferences Noted
- Preference 1`

export const COMPACT_USER_PROMPT = 'Please compress the conversation above into a structured summary following the format specified.'
