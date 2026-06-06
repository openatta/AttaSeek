/**
 * Document/writing tool implementations — review_document, format_document, outline_document
 */

import type { ToolImpl } from '../../../tools/ToolImplementations'

export const reviewDocumentImpl: ToolImpl = {
  toolId: 'review_document',
  execute: async (input: Record<string, unknown>) => {
    const content = String(input.content || '')
    if (!content) throw new Error('content is required')
    const focus = (input.focus as string[]) || ['clarity', 'tone', 'grammar', 'structure']

    const wordCount = content.split(/\s+/).length
    const sentences = content.split(/[.!?]+/).filter(Boolean).length
    const paragraphs = content.split(/\n\n+/).length
    const avgSentenceLength = sentences > 0 ? Math.round(wordCount / sentences) : 0

    return `## Document Review

**Stats:** ${wordCount} words, ${sentences} sentences, ${paragraphs} paragraphs
**Avg sentence length:** ${avgSentenceLength} words

**Focus areas:** ${focus.join(', ')}

**Quick checks:**
${focus.includes('grammar') ? '- Grammar: Check for subject-verb agreement, tense consistency, punctuation\n' : ''}
${focus.includes('clarity') ? `- Clarity: Avg sentence length is ${avgSentenceLength} (ideal: 15-20). ${avgSentenceLength > 25 ? 'Consider shortening sentences.' : 'Looks good.'}\n` : ''}
${focus.includes('structure') ? `- Structure: ${paragraphs} paragraphs. ${paragraphs < 3 ? 'Consider adding more structure.' : 'Adequate paragraph count.'}\n` : ''}
${focus.includes('tone') ? '- Tone: Review for consistent voice and appropriate formality level\n' : ''}
${focus.includes('brevity') ? '- Brevity: Identify redundant phrases and filler words\n' : ''}

[Full LLM review pending — this is a statistical pre-check]`
  },
}

export const formatDocumentImpl: ToolImpl = {
  toolId: 'format_document',
  execute: async (input: Record<string, unknown>) => {
    const content = String(input.content || '')
    if (!content) throw new Error('content is required')
    const style = String(input.style || 'markdown')

    // Normalize line endings, trim trailing whitespace
    let formatted = content
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+$/gm, '')
      .replace(/\n{3,}/g, '\n\n')

    if (style === 'markdown') {
      // Ensure blank line before/after headings and lists
      formatted = formatted
        .replace(/([^\n])\n(#{1,6}\s)/g, '$1\n\n$2')
        .replace(/(#{1,6}\s[^\n]+)\n([^\n#-])/g, '$1\n\n$2')
    }

    return formatted
  },
}

export const outlineDocumentImpl: ToolImpl = {
  toolId: 'outline_document',
  execute: async (input: Record<string, unknown>) => {
    const topic = String(input.topic || '')
    if (!topic) throw new Error('topic is required')
    const audience = String(input.audience || 'general')
    const depth = Math.min(4, Math.max(1, Number(input.depth || 3)))

    const indent = '  '.repeat(depth)
    return `## Document Outline: ${topic}

**Audience:** ${audience}

1. Introduction
   - Background and context
   - Problem statement or thesis
   - Scope and objectives

2. Main Content
${Array.from({ length: depth }, (_, i) => `   ${i + 1}. Section ${i + 1}\n      - Key point A\n      - Key point B\n      - Supporting evidence\n`).join('')}
3. Analysis & Discussion
   - Implications
   - Alternative perspectives
   - Limitations

4. Conclusion
   - Summary of findings
   - Recommendations
   - Call to action / next steps

[Generated outline with depth=${depth}. Customize sections for your specific topic.]
`
  },
}
