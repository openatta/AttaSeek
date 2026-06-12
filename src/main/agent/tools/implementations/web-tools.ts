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

    // Optional prompt to extract/answer from page content
    const prompt = input.prompt ? String(input.prompt) : null

    try {
      const resp = await fetch(url)
      let text = await resp.text()

      // Strip HTML tags to plain text for LLM consumption
      const plainText = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

      // For short content, return directly
      if (plainText.length <= 4000) {
        return plainText
      }

      // For long content, attempt LLM summarization using classifier/haiku model
      try {
        const { loadLLMConfig } = await import('../../llm/AttaSettingsLoader')
        const { ModelResolver } = await import('../../llm/ModelResolver')
        const { modelProviderRegistry } = await import('../../llm/ModelProviderRegistry')

        const config = loadLLMConfig()
        if (config.provider) {
          const resolver = new ModelResolver(config.provider)
          const summaryModel = resolver.haiku() // Use haiku for cheap summarization

          const provider = modelProviderRegistry.getDefault()
          if (provider) {
            const truncLen = prompt ? 6000 : 8000
            const truncatedContent = plainText.slice(0, truncLen)

            const summaryPrompt = prompt
              ? `URL: ${url}\n\nPage content:\n\n${truncatedContent}\n\nInstruction: ${prompt}`
              : `Summarize the following web page content concisely (key points only, < 500 words):\n\nURL: ${url}\n\n${truncatedContent}`

            const result = await provider.chat({
              systemPrompt: 'You are a helpful assistant. Summarize the given content accurately and concisely.',
              messages: [{ role: 'user', content: summaryPrompt }],
              tools: [],
              model: summaryModel,
              config: { maxTokens: prompt ? 2000 : 500, temperature: 0 },
            })

            const resultContent = typeof result.content === 'string'
              ? result.content
              : Array.isArray(result.content)
                ? result.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('')
                : ''

            if (resultContent) {
              return `## Content from ${url}\n\n${resultContent}`
            }
          }
        }
      } catch {
        // LLM summarization failed — fall through to truncation
      }

      // Fallback: return truncated content
      return `## Content from ${url} (truncated)\n\n${plainText.slice(0, 10_000)}`
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
