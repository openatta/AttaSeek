/**
 * Web research tool implementations — web_search, web_fetch, source_verify, cite_source
 */

import type { ToolImpl } from '../../../tools/ToolImplementations'

export const webSearchImpl: ToolImpl = {
  toolId: 'web_search',
  execute: async (input: Record<string, unknown>) => {
    const query = String(input.query || '')
    const maxResults = Number(input.maxResults || 10)
    if (!query) throw new Error('query is required')

    try {
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
      const resp = await fetch(url)
      const data = await resp.json() as Record<string, unknown>

      const results: string[] = []

      // Abstract (main answer snippet)
      if (data.AbstractText) {
        results.push(`**Answer:** ${data.AbstractText}`)
        if (data.AbstractURL) results.push(`Source: ${data.AbstractURL}`)
        results.push('')
      }

      // Instant answer
      if (data.Answer) {
        results.push(`**Instant Answer:** ${data.Answer}`)
      }

      // Related topics
      const topics = data.RelatedTopics as Array<Record<string, unknown>> | undefined
      if (topics && topics.length > 0) {
        results.push('**Related Results:**')
        let count = 0
        for (const topic of topics) {
          if (count >= maxResults) break
          const text = topic.Text as string | undefined
          const url = topic.FirstURL as string | undefined
          if (text) {
            results.push(`- ${text}${url ? ` (${url})` : ''}`)
            count++
          }
        }
      }

      if (results.length === 0) {
        // Fallback: build a simple search URL
        return `No instant results found for "${query}". Try: https://duckduckgo.com/?q=${encodeURIComponent(query)}`
      }

      return results.join('\n')
    } catch (err) {
      // Fallback on network error
      return `Search for "${query}" failed: ${err instanceof Error ? err.message : 'Network error'}. Try: https://duckduckgo.com/?q=${encodeURIComponent(query)}`
    }
  },
}

export const webFetchImpl: ToolImpl = {
  toolId: 'web_fetch',
  execute: async (input: Record<string, unknown>) => {
    const url = String(input.url || '')
    if (!url) throw new Error('url is required')
    try {
      const resp = await fetch(url)
      const text = await resp.text()
      return text.slice(0, 10_000) // Truncate to avoid context overflow
    } catch (err) {
      throw new Error(`Failed to fetch ${url}: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  },
}

export const sourceVerifyImpl: ToolImpl = {
  toolId: 'source_verify',
  execute: async (input: Record<string, unknown>) => {
    const claim = String(input.claim || '')
    if (!claim) throw new Error('claim is required')
    // Placeholder — real implementation would cross-reference sources
    return `Source verification for claim: "${claim}"\n` +
      `[Cross-reference engine pending — will search multiple sources and compare results]`
  },
}

export const citeSourceImpl: ToolImpl = {
  toolId: 'cite_source',
  execute: async (input: Record<string, unknown>) => {
    const title = String(input.title || 'Untitled')
    const author = String(input.author || 'Unknown')
    const url = String(input.url || '')
    const date = String(input.date || new Date().getFullYear().toString())
    const style = String(input.style || 'apa')

    const citations: Record<string, string> = {
      apa: `${author} (${date}). ${title}.${url ? ` Retrieved from ${url}` : ''}`,
      mla: `${author}. "${title}."${url ? ` ${url}` : ''}. ${date}.`,
      chicago: `${author}. "${title}."${url ? ` ${url}` : ''} (${date}).`,
    }

    return citations[style] || citations.apa
  },
}
