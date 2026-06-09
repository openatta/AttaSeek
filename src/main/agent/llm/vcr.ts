/**
 * VCR — Record & Replay for LLM API calls.
 *
 * Provides deterministic replay of LLM responses for testing and debugging.
 * When recording, captures every API request/response pair to JSONL files.
 * When replaying, matches incoming requests to recorded responses and returns
 * them without making real API calls.
 *
 * Usage:
 *   ATTA_VCR_RECORD=my_scenario  → records all calls to .atta/seek/vcr/my_scenario.jsonl
 *   ATTA_VCR_REPLAY=my_scenario  → replays from .atta/seek/vcr/my_scenario.jsonl
 *
 * Mirrors Claude Code's withStreamingVCR() in src/services/api/claude.ts.
 */

import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import type { ModelProvider, LLMChatParams, LLMChatResult, LLMChunkCallback, LLMChunk } from './ModelProvider'

// ── Types ──

interface VCREntry {
  /** Hash of the request (messages content + system prompt + tools + model). */
  requestHash: string
  /** The original LLMChatParams (without signal). */
  request: {
    systemPrompt: string
    messages: Array<{ role: string; content: unknown }>
    tools: Array<{ name: string; description: string; input_schema: Record<string, unknown> }>
    model?: string
  }
  /** The recorded LLMChatResult. */
  response: {
    content: Array<{ type: string; [key: string]: unknown }>
    stopReason: string
    usage: { inputTokens: number; outputTokens: number }
  }
  /** Recorded streaming chunks (for stream replay). */
  chunks?: Array<{
    type: string
    text?: string
    id?: string
    name?: string
    input_json?: string
    index?: number
  }>
  timestamp: number
}

// ── Environment detection ──

const VCR_DIR = path.join(
  process.env.HOME || process.env.USERPROFILE || '/tmp',
  '.atta', 'seek', 'vcr',
)

/** Override VCR directory for testing. Set to null to reset to default. */
let _vcrDirOverride: string | null = null

/** Set a custom VCR directory (for testing). Pass null to reset. */
export function setVCRDir(dir: string | null): void {
  _vcrDirOverride = dir
}

function getVCRDir(): string {
  return _vcrDirOverride ?? VCR_DIR
}

function getRecordMode(): string | undefined {
  return process.env['ATTA_VCR_RECORD'] || undefined
}

function getReplayMode(): string | undefined {
  return process.env['ATTA_VCR_REPLAY'] || undefined
}

function getVCRPath(name: string): string {
  return path.join(getVCRDir(), `${name}.jsonl`)
}

// ── Hashing ──

function hashRequest(params: LLMChatParams): string {
  const payload = JSON.stringify({
    system: params.systemPrompt,
    messages: params.messages.map(m => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content.slice(0, 500) : JSON.stringify(m.content).slice(0, 500),
    })),
    tools: params.tools.map(t => t.name).sort(),
    model: params.model,
  })
  return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 16)
}

// ── Recorder ──

class VCRRecorder {
  private stream: fs.WriteStream | null = null
  private name: string

  constructor(name: string) {
    this.name = name
    const dir = getVCRDir()
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    this.stream = fs.createWriteStream(getVCRPath(name), { flags: 'a' })
  }

  record(
    params: LLMChatParams,
    result: LLMChatResult,
    chunks?: LLMChunk[],
  ): void {
    if (!this.stream) return
    const entry: VCREntry = {
      requestHash: hashRequest(params),
      request: {
        systemPrompt: params.systemPrompt,
        messages: params.messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        tools: params.tools.map(t => ({
          name: t.name,
          description: t.description,
          input_schema: t.input_schema,
        })),
        model: params.model,
      },
      response: {
        content: result.content.map(b => ({ ...b })),
        stopReason: result.stopReason,
        usage: result.usage,
      },
      chunks: chunks?.map(c => ({ ...c })),
      timestamp: Date.now(),
    }
    this.stream.write(JSON.stringify(entry) + '\n')
  }

  close(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (this.stream) {
        this.stream.end(() => {
          this.stream = null
          resolve()
        })
      } else {
        resolve()
      }
    })
  }
}

// ── Replayer ──

class VCRReplayer {
  private entries: VCREntry[] = []
  private name: string

  constructor(name: string) {
    this.name = name
    const filePath = getVCRPath(name)
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8')
      this.entries = content
        .split('\n')
        .filter(Boolean)
        .map(line => JSON.parse(line))
    }
  }

  find(params: LLMChatParams): VCREntry | undefined {
    const hash = hashRequest(params)
    return this.entries.find(e => e.requestHash === hash)
  }

  replayChat(params: LLMChatParams): LLMChatResult | null {
    const entry = this.find(params)
    if (!entry) {
      console.warn(`[VCR] No recorded response for request hash ${hashRequest(params)} in "${this.name}"`)
      return null
    }
    return {
      content: entry.response.content as unknown as LLMChatResult['content'],
      stopReason: entry.response.stopReason as LLMChatResult['stopReason'],
      usage: entry.response.usage,
    }
  }

  async replayStream(
    params: LLMChatParams,
    onChunk: LLMChunkCallback,
  ): Promise<LLMChatResult | null> {
    const entry = this.find(params)
    if (!entry) {
      console.warn(`[VCR] No recorded stream for request hash ${hashRequest(params)} in "${this.name}"`)
      return null
    }
    if (entry.chunks) {
      // Replay chunks with realistic timing
      for (const chunk of entry.chunks) {
        await new Promise(r => setTimeout(r, 5)) // 5ms inter-chunk delay
        onChunk(chunk as LLMChunk)
      }
    }
    return {
      content: entry.response.content as unknown as LLMChatResult['content'],
      stopReason: entry.response.stopReason as LLMChatResult['stopReason'],
      usage: entry.response.usage,
    }
  }
}

// ── VCR Wrapper Provider ──

/**
 * Wraps a real ModelProvider with VCR recording/replay capabilities.
 *
 * In record mode: delegates to the real provider, captures responses.
 * In replay mode: returns recorded responses without making API calls.
 * In normal mode: transparent pass-through.
 */
export function wrapWithVCR(provider: ModelProvider): ModelProvider {
  const recordMode = getRecordMode()
  const replayMode = getReplayMode()

  if (!recordMode && !replayMode) return provider

  const recorder = recordMode ? new VCRRecorder(recordMode) : null
  const replayer = replayMode ? new VCRReplayer(replayMode) : null

  return {
    name: provider.name,
    models: provider.models,

    async chat(params: LLMChatParams): Promise<LLMChatResult> {
      if (replayer) {
        const replayResult = replayer.replayChat(params)
        if (replayResult) return replayResult
        // Fall through to real provider if no match
      }
      const result = await provider.chat(params)
      if (recorder) recorder.record(params, result)
      return result
    },

    async chatStream(params: LLMChatParams, onChunk: LLMChunkCallback): Promise<LLMChatResult> {
      if (replayer) {
        const replayResult = await replayer.replayStream(params, onChunk)
        if (replayResult) return replayResult
        // Fall through to real provider if no match
      }
      const chunks: LLMChunk[] = []
      const wrappedCallback: LLMChunkCallback = (chunk) => {
        chunks.push(chunk)
        onChunk(chunk)
      }
      const result = await provider.chatStream(params, wrappedCallback)
      if (recorder) recorder.record(params, result, chunks)
      return result
    },

    async validateKey(apiKey: string): Promise<boolean> {
      if (replayer) return true // In replay mode, pretend the key is valid
      return provider.validateKey(apiKey)
    },
  }
}

// ── Export for testing ──

export { VCRRecorder, VCRReplayer, hashRequest, getVCRPath }
export type { VCREntry }
