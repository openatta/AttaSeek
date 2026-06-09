/**
 * Mock OpenAI-Compatible LLM Server for E2E tests.
 *
 * Implements POST /v1/chat/completions with streaming (SSE) and non-streaming responses.
 * Uses a simple JSON scenario file or inline defaults to simulate LLM behavior.
 *
 * Usage:
 *   npx tsx e2e/mock-server.ts              # start with defaults
 *   npx tsx e2e/mock-server.ts --port=19999  # custom port
 */

import http from 'http'

const PORT = parseInt(process.env['MOCK_PORT'] || '19999', 10)

// ── Scenario config ──
// Scenarios are defined by matching a JSON path prefix on the first user message.
// Each scenario returns a sequence of responses for multi-turn conversations.

interface ScenarioStep {
  /** Content chunks to stream (simulates SSE tokens) */
  chunks: string[]
  /** Delay between chunks in ms (simulates streaming) */
  chunkDelayMs?: number
  /** Final content after streaming (for non-streaming response) */
  content?: string
  /** Optional: emit a SessionTitleGenerated-like title suggestion */
  title?: string
  /** Optional: inject a tool_use block to test tool call rendering */
  tool_use?: { name: string; input: Record<string, unknown> }
}

interface Scenario {
  steps: ScenarioStep[]
}

const DEFAULT_STEPS: ScenarioStep[] = [
  {
    chunks: ['Hello', '! ', 'I', "'d ", 'be ', 'happy ', 'to ', 'help ', 'you ', 'with ',
      'that', '. ', '\n\n', 'Here', "'s ", 'what ', 'I ', 'can ', 'tell ', 'you:',
      '\n\n', 'This ', 'is ', 'a ', 'mock ', 'response ', 'from ',
      'the ', 'AttaSeek ', 'test ', 'server', '.'],
    chunkDelayMs: 15,
    title: 'Mock test conversation',
  },
]

const SCENARIOS: Record<string, Scenario> = {
  /** Default scenario for any message */
  default: { steps: DEFAULT_STEPS },

  /** Multi-turn scenario for conversation testing */
  multiturn: {
    steps: [
      // Turn 1: answer a question about TypeScript
      {
        chunks: ['TypeScript ', 'is ', 'a ', 'strongly ', 'typed ', 'programming ', 'language ',
          'that ', 'builds ', 'on ', 'JavaScript', '. ', 'It ', 'adds ', 'static ', 'type ',
          'checking', ', ', 'interfaces', ', ', 'generics', ', ', 'and ', 'other ', 'features',
          '.'],
        chunkDelayMs: 12,
        title: 'What is TypeScript',
      },
      // Turn 2: follow-up
      {
        chunks: ['TypeScript ', 'offers ', 'several ', 'advantages:',
          '\n\n', '1. ', '**Type ', 'Safety**', ' - ', 'catch ', 'errors ', 'at ', 'compile ', 'time',
          '\n', '2. ', '**Better ', 'IDE ', 'Support**', ' - ', 'autocomplete', ', ', 'refactoring',
          '\n', '3. ', '**Self', '-Document', 'ing**', ' - ', 'types ', 'serve ', 'as ', 'documentation',
          '\n', '4. ', '**Large', ' Ecosystem**', ' - ', 'DefinitelyTyped', ', ', 'popular ', 'frameworks',
        ],
        chunkDelayMs: 10,
      },
      // Turn 3: code example
      {
        chunks: ['```typescript\n',
          'interface User {\n',
          '  id: string;\n',
          '  name: string;\n',
          '  email: string;\n',
          '}\n',
          '\n',
          'function greet(user: User): string {\n',
          '  return `Hello, ${user.name}!`;\n',
          '}\n',
          '```',
          '\n\n',
          'This ', 'is ', 'a ', 'simple ', 'TypeScript ', 'example', '.'],
        chunkDelayMs: 10,
      },
      // Turn 4: tool usage
      {
        chunks: ['Let ', 'me ', 'run ', 'a ', 'command ', 'for ', 'you', '.'],
        chunkDelayMs: 8,
        tool_use: { name: 'Bash', input: { command: 'echo "Hello from mock"', description: 'Test command' } },
      },
      // Turn 5: final answer
      {
        chunks: ['The ', 'command ', 'executed ', 'successfully', '. ', 'Is ', 'there ', 'anything ',
          'else ', 'I ', 'can ', 'help ', 'with', '?'],
        chunkDelayMs: 12,
      },
    ],
  },

  /** Scenario that triggers compaction (long conversation) */
  long: {
    steps: Array.from({ length: 12 }, (_, i) => ({
      chunks: [
        `Turn ${i + 1} response. `,
        'This is a detailed response that contains a lot of content. '.repeat(10),
        `End of turn ${i + 1}.`,
      ],
      chunkDelayMs: 5,
    })),
  },

  /** Error scenario */
  error: {
    steps: [
      {
        chunks: ['This response will trigger an error state.'],
        chunkDelayMs: 10,
      },
    ],
  },
}

// ── Helper: generate SSE stream chunks ──

function sseChunk(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`
}

// ── OpenAI-compatible chat completions response ──

function buildStreamChunks(
  model: string,
  content: string,
  chunkDelayMs: number,
  toolUse?: { name: string; input: Record<string, unknown> },
): string[] {
  const id = `chatcmpl-mock-${Date.now()}`
  const words = content.split(/(?<=\s)/) // Split after whitespace to simulate token streaming

  const chunks: string[] = []

  // Initial chunk with role
  chunks.push(sseChunk({
    id,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{
      index: 0,
      delta: { role: 'assistant', content: '' },
      finish_reason: null,
    }],
  }))

  // Content chunks
  for (let i = 0; i < words.length; i++) {
    const word = words[i]
    // Occasionally batch a few words together for realism
    const batch = i % 3 === 0 ? words.slice(i, Math.min(i + 3, words.length)).join('') : word
    chunks.push(sseChunk({
      id,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [{
        index: 0,
        delta: { content: batch },
        finish_reason: null,
      }],
    }))
  }

  // If tool use, inject it before the final chunk
  if (toolUse) {
    chunks.push(sseChunk({
      id,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [{
        index: 0,
        delta: {
          tool_calls: [{
            index: 0,
            id: `toolu_mock_${Date.now()}`,
            type: 'function',
            function: {
              name: toolUse.name,
              arguments: JSON.stringify(toolUse.input),
            },
          }],
        },
        finish_reason: 'tool_calls',
      }],
    }))
  } else {
    // Final chunk
    chunks.push(sseChunk({
      id,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [{
        index: 0,
        delta: {},
        finish_reason: 'stop',
      }],
    }))
  }

  // [DONE] marker
  chunks.push('data: [DONE]\n\n')

  return chunks
}

// ── Request counter per test session (for multi-turn) ──

let turnCounters: Record<string, number> = {}

// ── Server ──

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', mock: true }))
    return
  }

  if (req.method === 'POST' && req.url === '/reset') {
    turnCounters = {}
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ reset: true }))
    return
  }

  if (req.method === 'POST' && (req.url === '/v1/chat/completions' || req.url === '/chat/completions')) {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body)
        const isStream = parsed.stream === true
        const model = parsed.model || 'mock-model'
        const messages = parsed.messages || []

        // Extract user message to match scenario
        const lastUserMsg = [...messages].reverse().find((m: { role: string }) => m.role === 'user')
        const userContent = typeof lastUserMsg?.content === 'string' ? lastUserMsg.content : ''

        // Scenario selection
        let scenarioName = 'default'
        if (userContent.toLowerCase().includes('typescript') && userContent.toLowerCase().includes('what is')) {
          scenarioName = 'multiturn'
        } else if (userContent.toLowerCase().includes('long conversation')) {
          scenarioName = 'long'
        } else if (userContent.toLowerCase().includes('error test')) {
          scenarioName = 'error'
        }

        const scenario = SCENARIOS[scenarioName] || SCENARIOS['default']
        if (!scenario) {
          res.writeHead(500)
          res.end(JSON.stringify({ error: 'No scenario configured' }))
          return
        }

        // Get turn counter for this scenario
        const turnKey = scenarioName
        if (!(turnKey in turnCounters)) turnCounters[turnKey] = 0
        const turnIdx = turnCounters[turnKey]++ % scenario.steps.length
        const step = scenario.steps[turnIdx]
        if (!step) {
          res.writeHead(500)
          res.end(JSON.stringify({ error: `No step for turn ${turnIdx}` }))
          return
        }

        const content = step.content || step.chunks.join('')

        if (isStream) {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          })

          const chunks = buildStreamChunks(model, content, step.chunkDelayMs || 15, step.tool_use)
          let delay = 0
          for (const chunk of chunks) {
            setTimeout(() => {
              if (!res.destroyed) res.write(chunk)
            }, delay)
            delay += (step.chunkDelayMs || 15)
          }

          // End after all chunks
          setTimeout(() => {
            if (!res.destroyed) res.end()
          }, delay + 10)
        } else {
          // Non-streaming response
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({
            id: `chatcmpl-mock-${Date.now()}`,
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model,
            choices: [{
              index: 0,
              message: { role: 'assistant', content },
              finish_reason: 'stop',
            }],
            usage: {
              prompt_tokens: 50,
              completion_tokens: content.split(/\s+/).length,
              total_tokens: 50 + content.split(/\s+/).length,
            },
          }))
        }
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Invalid JSON body' }))
      }
    })
    return
  }

  // List models endpoint (OpenAI-compatible)
  if (req.method === 'GET' && (req.url === '/v1/models' || req.url === '/models')) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      object: 'list',
      data: [
        { id: 'mock-model', object: 'model', created: Date.now(), owned_by: 'mock' },
      ],
    }))
    return
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not found' }))
})

// ── Start ──

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.includes('mock-server')) {
  server.listen(PORT, () => {
    console.log(`[mock-llm] listening on http://localhost:${PORT}`)
    console.log(`[mock-llm] health: http://localhost:${PORT}/health`)
    console.log(`[mock-llm] reset: POST http://localhost:${PORT}/reset`)
  })
}

export { server, SCENARIOS, PORT }
