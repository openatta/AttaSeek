# 完备性差距关闭计划

**日期：** 2026-06-12
**输入：** 产品完备性对比简报（vs Codex Desktop / Claude Code Desktop）
**原则：** 只分析方案，不动代码。每个差距给出实现路径、涉及文件、风险点、估时。

---

## 总览优先级

| 优先级 | 差距 | 影响面 | 估时 | 风险 |
|--------|------|--------|------|------|
| P1 | LSP 工具接线 | Agent 代码智能能力为空 | 3-4d | 进程管理复杂度 |
| P1 | 插件子进程隔离 | 安全 + 稳定性 | 4-5d | 进程通信架构 |
| P2 | MCP SSE 传输 | 远程 MCP 不可用 | 1d | 低，标准协议 |
| P2 | ModelResolver 自动路由 | 成本 + 延迟未优化 | 2-3d | 需灰度验证 |
| P2 | SubAgent token 追踪 | 数据不准确 | 0.5d | 极低 |
| P2 | Code Signing 验证 | 更新安全性 | 1d | 阻塞于证书 |
| P3 | Terminal 会话持久化 | 终端体验 | 2d | 低 |
| P3 | Voice Input | 输入方式单一 | 2d | Web Speech API 兼容性 |

---

## 1. LSP 工具接线（P1）

### 1.1 现状

3 个 LSP 实现函数在 `src/main/agent/tools/implementations/lsp.ts` 中返回硬编码 stub 消息：

```
"LSP diagnostic not available: no language server configured"
"LSP go-to-definition not available: no language server configured"  
"LSP find-references not available: no language server configured"
```

没有 `src/main/lsp/` 目录—— LSP 管理层完全空白。

### 1.2 方案

**整体思路：** 创建 `LSPManager` 作为主进程的 LSP 会话管理器，按需启动语言服务器子进程，通过 stdio JSON-RPC 通信。不引入 LSP 客户端库（如 `vscode-languageserver/node`），用原生 JSON-RPC 以保持零外部依赖——协议简单，只需 initialize、didOpen、diagnostic、definition、references 几个方法。

**新建文件：**

```
src/main/lsp/
├── LSPManager.ts              # 语言服务器生命周期管理
├── LSPClient.ts               # 单个 LSP 会话的 JSON-RPC 封装
├── LSPConfigStore.ts           # 语言→服务器命令的配置读写
└── default-config.ts          # 内置默认配置（常见语言）
```

**架构：**

```
Tool: lsp_diagnostic(filePath)
  → LSPManager.getClient(filePath)
    → 按文件扩展名查配置 → 语言 ID
    → 检查是否已有运行的 LSP Client
      → 有 → 复用
      → 无 → LSPClient.start(command, args)
             → child_process.spawn(cmd, args, {stdio: ['pipe','pipe','pipe']})
             → JSON-RPC initialize → textDocument/didOpen
    → client.sendRequest('textDocument/diagnostic', {textDocument: {uri}})
    → 返回诊断结果
```

**LSPClient 核心流程：**

```
start()
  1. spawn 语言服务器进程
  2. initialize: 发送 workspace root、capabilities
  3. 收到 initialize result → 保存 serverCapabilities
  4. 发送 initialized notification

sendRequest(method, params):
  1. 包装为 JSON-RPC: {jsonrpc:"2.0", id: nextId(), method, params}
  2. 写入 stdin
  3. 等待对应 id 的 response（Promise + 超时 10s）
  4. 解析返回 result/error

shutdown():
  1. 发送 shutdown request
  2. 发送 exit notification
  3. kill 进程（超时 5s 后强制 SIGKILL）
```

**LSPManager 关键方法：**

```typescript
class LSPManager {
  /** 为给定文件路径获取（或创建）LSP 客户端 */
  getClient(filePath: string): Promise<LSPClient | null>
  
  /** 获取文件诊断 */
  getDiagnostics(filePath: string): Promise<LSPDiagnostic[]>
  
  /** 跳转到定义 */
  getDefinition(filePath: string, line: number, character: number): Promise<LSPLocation[]>
  
  /** 查找引用 */
  getReferences(filePath: string, line: number, character: number): Promise<LSPLocation[]>
  
  /** 关闭所有语言服务器 */
  shutdownAll(): Promise<void>
}
```

**default-config.ts 内置默认配置：**

```typescript
const DEFAULT_CONFIGS: Record<string, LSPConfig> = {
  typescript: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    languageId: 'typescript',
    command: 'typescript-language-server',
    args: ['--stdio'],
    // 如果 typescript-language-server 未安装，降级提示用户安装
  },
  rust: {
    extensions: ['.rs'],
    languageId: 'rust',
    command: 'rust-analyzer',
    args: [],
  },
  python: {
    extensions: ['.py'],
    languageId: 'python',
    command: 'pyright-langserver',
    args: ['--stdio'],
  },
  go: {
    extensions: ['.go'],
    languageId: 'go',
    command: 'gopls',
    args: [],
  },
  // ...更多语言
}
```

**降级策略（分三层）：**

| 层级 | 条件 | 行为 |
|------|------|------|
| L1 就绪 | LSP server 已安装并可启动 | 正常返回诊断/定义/引用 |
| L2 未安装 | 默认配置的语言服务器命令未找到 | 返回友好消息："typescript-language-server not installed. Run `npm install -g typescript-language-server` to enable LSP" |
| L3 无配置 | 文件扩展名不在默认配置中 | 返回当前 stub 消息，提示用户在设置中手动配置 |

**设置页集成：**

在 `Settings > Agent` 或新 Tab `Settings > LSP` 中新增：
- 语言服务器列表（语言 / 命令 / 状态）
- 启用/禁用开关
- 手动添加自定义语言服务器
- "Test Connection" 按钮

**涉及修改的现有文件：**

| 文件 | 改动 |
|------|------|
| `src/main/agent/tools/implementations/lsp.ts` | 替换 stub 实现为 LSPManager 调用 |
| `src/main/ipc/agent.ts` 或新文件 | 可能需要 IPC 支持 LSP 管理 UI |
| `src/main/boot.ts` | 初始化 LSPManager |
| `Package.json` | 无需新增依赖（纯 Node.js stdio + JSON-RPC） |

**风险点：**
- 语言服务器进程管理：需处理僵尸进程、启动超时、crash 重启
- 大项目初始化慢（TypeScript 项目可能需要 10s+ 扫描）→ 用 initialize 超时 + loading 态
- 并发限制：相同语言的多个文件共享一个 LSP 客户端实例
- Linux 上需要 `shell: true` 以找到全局安装的 language server

**估时：** 3-4 天
- LSPClient + JSON-RPC 协议层：1d
- LSPManager + 配置：1d
- 语言适配 + 默认配置：0.5d
- 设置 UI：0.5d
- 测试 + 边界情况：0.5-1d

---

## 2. 插件子进程隔离（P1）

### 2.1 现状

`PluginLoader` 同步加载本地 TypeScript manifest，插件代码与主进程共享同一 Node.js 上下文。`PluginRegistry.activate()` 注释写明："MVP: synchronous local ts manifests. Future: async subprocess/MCP."

### 2.2 方案

**整体思路：** 引入 `PluginHost` 概念——每个第三方（marketplace）插件运行在独立 `child_process.fork()` 子进程中，通过结构化 IPC 消息与主进程交互。内置插件（builtin packs）保持同步加载不变，以降低复杂度。

**架构：**

```
┌────────── Main Process ──────────┐
│  PluginLoader                     │
│    │                              │
│    ├── BuiltinPack (同步)         │  ← 不变
│    │   → PluginManifest.ts        │
│    │                              │
│    └── MarketplacePlugin (隔离)   │  ← 新建
│          │                        │
│          ▼                        │
│  PluginHostManager                │
│    ├── spawns child_process       │
│    ├── message dispatch           │
│    └── health monitoring          │
└──────────┬───────────────────────┘
           │ IPC (child_process.fork)
┌──────────▼─ Plugin Process ──────┐
│  PluginHost entry                 │
│    ├── loads plugin code          │
│    ├── registers contributions    │
│    │   (tools/skills/hooks/...)   │
│    ├── handles tool execution     │
│    └── heartbeat + shutdown       │
└──────────────────────────────────┘
```

**新建文件：**

```
src/main/plugins/
├── PluginHostManager.ts          # 管理所有子进程
├── PluginProcess.ts              # 单个插件的进程包装
├── PluginIPCProtocol.ts          # 进程间消息类型定义
└── host/
    └── PluginHostEntry.ts        # 子进程入口（被 fork）
```

**PluginIPCProtocol 消息格式：**

```typescript
// 主进程 → 子进程
type HostToPlugin =
  | { type: 'init'; manifestPath: string; pluginDir: string }
  | { type: 'activate' }
  | { type: 'deactivate' }
  | { type: 'executeTool'; callId: string; toolName: string; input: Record<string, unknown> }
  | { type: 'shutdown' }
  | { type: 'heartbeatResponse' }

// 子进程 → 主进程
type PluginToHost =
  | { type: 'ready'; contributions: PluginContributions }
  | { type: 'toolResult'; callId: string; result: ToolExecResult }
  | { type: 'toolError'; callId: string; error: string }
  | { type: 'heartbeat' }
  | { type: 'error'; error: string; fatal: boolean }
  | { type: 'log'; level: string; message: string }
```

**PluginProcess 生命周期：**

```
spawn()      → child_process.fork(hostEntry, [], { env, stdio: 'pipe' })
              → 等待 'ready' 消息（超时 10s）
              → 注册 contributions 到主进程

activate()   → 发送 'activate' 消息
              → 子进程中执行 PluginManifest 的初始化逻辑

deactivate() → 发送 'deactivate' 消息
              → 子进程清理资源

shutdown()   → 发送 'shutdown' 消息
              → 等 5s → 强制 kill

crash        → 自动重启（最多 3 次，间隔 1s/2s/4s）
              → 超过上限 → 标记为 'error' 状态
```

**安全隔离机制：**

| 维度 | 措施 |
|------|------|
| 进程隔离 | `child_process.fork()` — 独立 V8 isolate，崩溃不影响主进程 |
| 文件系统 | 子进程 cwd 限制在插件安装目录内；父进程验证返回路径 |
| 网络 | 可选的 per-process proxy 配置（v2） |
| 内存 | `--max-old-space-size` 限制每个子进程内存（默认 256MB） |
| CPU | 心跳超时检测 → 卡死进程强制 kill |
| 权限 | 插件的工具执行仍需经过 PermissionService（主进程侧） |

**PluginLoader 改动：**

```typescript
// 加载路径分叉
boot(): BootResult {
  for (const factory of this.builtInPacks) {
    // 现有路径：同步加载、直接注册
  }

  for (const manifest of this.installedMarketplacePlugins) {
    // 新路径：spawn 子进程
    if (manifest.loadMode === 'sync') {
      // 信任的 marketplace 插件可选同步模式（用户手动授权）
    } else {
      this.hostManager.spawn(manifest)  // 默认隔离
    }
  }
}
```

**涉及修改的现有文件：**

| 文件 | 改动 |
|------|------|
| `src/main/plugins/PluginRegistry.ts` | 新增 `registerContributions()` 批量注册方法 |
| `src/main/plugins/PluginLoader.ts` | 分叉加载路径，集成 PluginHostManager |
| `src/main/plugins/types.ts` | 导出 PluginContributions（已有） |
| `src/main/boot.ts` | 初始化 PluginHostManager |

**风险点：**
- 子进程启动延迟（~200ms）：首屏加载时批量 spawn，可用 `Promise.all` 并行
- 错误隔离的语义：插件 crash 后其 tools 调用已在进行中的怎么处理 → 返回 error 给 Agent，不 crash 主进程
- `child_process.fork()` 路径解析：需确保 ts-node 或预编译的 js 文件可在子进程中执行；建议 marketplace 插件预编译为 js
- 调试困难：子进程日志需通过 IPC 转发到主进程日志流

**估时：** 4-5 天
- PluginIPCProtocol + PluginProcess：1d
- PluginHostManager + 生命周期：1d
- PluginLoader 集成 + 路径分叉：1d
- 错误处理 + 边界情况：1d
- 测试：0.5-1d

---

## 3. MCP SSE 传输（P2）

### 3.1 现状

`SSETransport.connect()` 在 `MCPTransport.ts:125` 是纯 stub：

```typescript
async connect(): Promise<void> {
  if (!this.config.url) throw new Error('SSE transport requires a URL')
  this.connected = true
  console.warn('[MCP:SSE] SSE transport not fully implemented — using stub')
}
```

POST 发送端（`send()` 方法，133-139 行）已实现但**只在 connect 后可用**，而 connect 是空的。消息接收（`onMessage`）完全未接线。

### 3.2 方案

**协议回顾：** MCP SSE 传输基于两个 HTTP 连接：
1. **GET `/sse`** — 客户端打开 SSE 长连接，服务器通过此通道推送消息（`endpoint` 事件 + 后续消息流）
2. **POST `/messages?sessionId=...`** — 客户端向服务器发送 JSON-RPC 消息；`sessionId` 来自 SSE 的第一个 `endpoint` 事件

**实现方案：**

```typescript
// 替换 SSETransport.connect()

async connect(): Promise<void> {
  if (!this.config.url) throw new Error('SSE transport requires a URL')

  this.abortController = new AbortController()
  const signal = this.abortController.signal

  // 1. 打开 SSE 长连接
  const sseUrl = this.config.url.endsWith('/sse')
    ? this.config.url
    : `${this.config.url}/sse`

  const response = await fetch(sseUrl, {
    headers: { Accept: 'text/event-stream', ...this.config.headers },
    signal,
  })

  if (!response.ok) throw new Error(`SSE connection failed: HTTP ${response.status}`)
  if (!response.body) throw new Error('SSE: no response body')

  // 2. 解析 SSE 流
  this.connected = true
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const readLoop = async (): Promise<void> => {
    while (true) {
      const { done, value } = await reader.read()
      if (done) { this.connected = false; break }
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      let eventType = '', data = ''
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7).trim()
        } else if (line.startsWith('data: ')) {
          data += line.slice(6)
        } else if (line === '') {
          // 空行 = 事件结束
          if (data) {
            const parsed = JSON.parse(data)
            // 第一个事件是 endpoint 事件，携带 sessionId
            if (eventType === 'endpoint') {
              this.sessionId = parsed.sessionId || parsed
            }
            for (const h of this.messageHandlers) h(parsed)
          }
          eventType = ''; data = ''
        }
      }
    }
  }

  // 3. 后台持续读取
  readLoop().catch((err) => {
    if (err.name !== 'AbortError') {
      console.warn('[MCP:SSE] read loop error:', err.message)
    }
    this.connected = false
  })
}

// 修改 send() 以携带 sessionId
async send(message: unknown): Promise<void> {
  if (!this.config.url) throw new Error('Not connected')
  const postUrl = this.sessionId
    ? `${this.config.url}/messages?sessionId=${this.sessionId}`
    : `${this.config.url}/messages`

  await fetch(postUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...this.config.headers },
    body: JSON.stringify(message),
    signal: this.abortController?.signal,
  })
}
```

**涉及修改的文件：**

| 文件 | 改动 |
|------|------|
| `src/main/agent/mcp/MCPTransport.ts` | 重写 `SSETransport.connect()` 为真实 SSE 解析 |

**关键细节：**
- 使用浏览器内置 `fetch()` + `ReadableStream` 解析 SSE —— 零新增依赖
- SSE 断线自动重连（3 次，指数退避 1s/2s/4s）
- 不需要引入 `EventSource` polyfill（Electron Node.js 侧可用 `fetch`）
- `sessionId` 从 `endpoint` 事件提取，后续 POST 携带到 `?sessionId=xxx`

**风险点：**
- `ReadableStream` 在 Node.js 18+ 和 Electron 中可用，需确认 Electron 版本内置的 Node.js 支持
- 如果 SSE 端点使用重定向（302），`fetch` 默认跟随，不需要额外处理
- 大消息分片：SSE 协议没有消息大小限制，一个 `data:` 行可能很长，当前按行缓冲即可

**估时：** 1 天

---

## 4. ModelResolver 自动路由（P2）

### 4.1 现状

`ModelResolver` 有 5 个 `@reserved` 方法返回了正确的 slot 值，但没有调用方。这些 slot 在 `ResolvedProvider` 中已定义并可配置，只是 auto-routing、overload detection、permission classifier 这些**调度逻辑**没有写。

### 4.2 方案

逐项分析：

#### 4.2.1 Quick Tool Call 路由（smallFast slot）

**触发条件：** Agent 生成的 tool use 满足"轻量条件"时，将后续 tool result 的 LLM 处理路由到 smallFast 模型。

**轻量条件判定：**
- 工具是只读的（`riskLevel: 'read'`）
- 工具确定性高（bash `cat`/`ls`，file `read`，web `fetch`）
- 预期输出小于 ~4000 tokens

**实现位置：** `QueryEngine.query-loop.ts` 中 tool result 处理阶段：

```
// 伪代码
if (toolResult.outputLength < 4000 && tool.riskLevel === 'read') {
  model = resolver.smallFast()  // 用轻量模型处理结果
} else {
  model = resolver.main()       // 正常模型
}
```

#### 4.2.2 过载检测 + 降级（fallback slot）

**触发条件：** LLM API 返回 503（Overloaded）或 529（Overloaded）时自动切换到 fallback 模型。

**实现位置：** `src/main/agent/llm/withRetry.ts` — 在现有的重试逻辑中加入：

```
// 伪代码
if (error.status === 503 || error.status === 529) {
  if (attempt < maxOverloadRetries) {
    const fallbackModel = resolver.fallback()
    if (fallbackModel !== currentModel) {
      console.warn(`[overload] switching from ${currentModel} to ${fallbackModel}`)
      currentModel = fallbackModel
      continue  // 用 fallback 模型重试
    }
  }
}
```

**关键：** fallback 必须是**不同 provider** 的模型才有意义（如 Anthropic 过载时切换到 OpenAI 兼容端点）。需要在配置中支持跨 provider fallback。

#### 4.2.3 权限分类器（classifier slot）

**用途：** 用轻量模型预判工具调用的权限级别，减少用户打断。只允许 `riskLevel: 'read'` 的工具调用。

**实现位置：** `src/main/permission/PermissionService.ts` 中的权限检查流程：

```
// 伪代码: 在 PermissionService.authorize() 中
if (tool.riskLevel === 'read' && permissionMode === 'auto') {
  const classifierModel = resolver.classifier()
  // 发一个极简 prompt 给 classifier 模型
  const decision = await classifyPermission(classifierModel, tool, input)
  if (decision === 'allow') return 'allow'
  // 否则走正常 AskUserQuestion 流程
}
```

**Classify prompt 极简化：** 只用 ~200 tokens，单一 tool definition，单条用户输入，返回 `{allow: true/false}`。

#### 4.2.4 Auto-Routing（opus/strong slot）

**用途：** 检测复杂查询并自动升级到更强的模型。

**触发条件（启发式）：**
- 用户消息长度 > 500 tokens
- 包含关键词："design, architecture, refactor, implement, debug, analyze"
- session 长度 > 5 轮（深度讨论）

**实现位置：** `QueryEngine.query-loop.ts` 中每次 turn 开始前：

```
// 伪代码
function shouldUpgradeToStrong(message: string, conversationLength: number): boolean {
  if (conversationLength > 5) return true
  if (message.length > 500) return true
  const complexityKeywords = /design|architecture|refactor|implement|debug|analyze|audit/i
  if (complexityKeywords.test(message)) return true
  return false
}
```

**可选替代方案（更精确但更重）：** 用一个轻量 classifier prompt 判断复杂度，返回 `{complexity: 'low'|'medium'|'high'}`。但这种方式每次 turn 多一次 API 调用，ROI 不如启发式。

#### 4.2.5 WebFetch/WebSearch 分类器集成

**用途：** WebFetch/WebSearch 提取的网页内容用分类器模型做摘要/结构化提取，而不是用主模型。

**实现位置：** `src/main/agent/tools/implementations/web-tools.ts`：

```
// WebFetch 工具实现中，获取到网页内容后
const classifierModel = resolver.classifier()
const summary = await llmCall(classifierModel, [
  { role: 'system', content: 'Summarize the following web page content...' },
  { role: 'user', content: fetchedContent.slice(0, 8000) }
])
return summary
```

### 4.3 涉及文件汇总

| 文件 | 改动 |
|------|------|
| `src/main/agent/orchestrator/query-loop.ts` | quick-tool-call 路由 + auto-routing |
| `src/main/agent/llm/withRetry.ts` | overload → fallback 切换 |
| `src/main/permission/PermissionService.ts` | 权限分类器钩子 |
| `src/main/agent/tools/implementations/web-tools.ts` | WebFetch 分类器集成 |
| `src/main/agent/tools/implementations/research-tools.ts` | WebSearch 分类器集成 |

### 4.4 风险点

- **Quick tool call 路由可能劣化质量**：某些 read 工具的结果也需要主模型理解（如 diff 输出）。建议初期只对确定性高的 read 工具（`cat`、`ls`、`FileRead`）启用，其他保持主模型。
- **Auto-routing 的启发式过于粗糙**：可能出现简单问题被误升级，浪费 opus 成本。建议加一个"最大复杂 turn 占比"限制（不超过 30%）。
- **Overload fallback 的跨 provider 切换**：需要 ResolvedProvider 支持多个 provider 同时配置，而不是当前的"一个 provider 多 slot"。这个可能需要更大的配置结构调整。

### 4.5 分阶段实施建议

| 阶段 | 内容 | 估时 |
|------|------|------|
| Phase 1 | overload → fallback 切换（影响最大，逻辑最简单） | 0.5d |
| Phase 2 | quick-tool-call → smallFast 路由 | 0.5d |
| Phase 3 | auto-routing 启发式 | 0.5d |
| Phase 4 | 权限分类器 + WebFetch 分类器集成 | 0.5-1d |
| **总计** | | **2-3d** |

---

## 5. SubAgent Token 追踪（P2）

### 5.1 现状

`SubAgentManager.ts:557` 硬编码 `totalTokens: 0`，注释：`// TODO: track actual usage from engine`。

`QueryEngine` 已有 token 计数能力（通过 `cost-tracker.ts` 和 `UsageSummary` 类型）。只是没有在子代理结束时汇总。

### 5.2 方案

**步骤：**
1. 在 `QueryEngine` 上新增方法 `getUsage(): UsageSummary`
2. `SubAgentManager` 在子代理完成时调用 `engine.getUsage()` 获取实际 token 数
3. 填充到 notification payload

**涉及文件：**

| 文件 | 改动 |
|------|------|
| `src/main/agent/orchestrator/QueryEngine.ts` | 新增 `getUsage()` 公开方法 |
| `src/main/agent/subagent/SubAgentManager.ts` | 替换 `totalTokens: 0` 为实际值 |

**估时：** 0.5 天

---

## 6. Code Signing 验证（P2）

### 6.1 现状

`UpdateVerifier.ts:50` 跳过签名验证："code signature verification skipped (certificates not yet provisioned)"。SHA256 校验正常。

### 6.2 方案

**实现已就绪，只是被证书阻塞。** 代码中的注释已给出精确实现路径：

```typescript
// macOS
execSync(`codesign --verify --deep "${bundlePath}"`)

// Windows  
execSync(`powershell -Command "Get-AuthenticodeSignature -FilePath '${installerPath}'"`)

// Linux
execSync(`gpg --verify "${signatureFile}" "${packageFile}"`)
```

**解除阻塞后需做的事（1 天）：**
1. 在 `verifySignature()` 中加入平台分支的实际命令调用
2. 证书指纹/公钥配置化（从 config 或环境变量读取允许的签名者身份）
3. 测试各平台的签名验证流程

**阻塞状态：** 等待运营层面提供代码签名证书（Apple Developer ID + Windows Authenticode + Linux GPG key）。

**估时：** 1 天（证书就绪后）

---

## 7. Terminal 会话持久化（P3）

### 7.1 现状

Terminal 通过 `node-pty` 工作良好（xterm.js + WebGL），但：
- 终端关闭后状态全部丢失
- 无法保存/恢复终端会话
- 没有命名终端 profile
- 启动时总是新终端

### 7.2 方案

**三级持久化：**

#### Level 1: 终端会话恢复（最小可行）

```
终端关闭 → 保存到 SQLite:
  - terminalId
  - cwd (工作目录)
  - 创建时间
  - 最后活跃时间

App 重启 → 读取上次未关闭的终端
  → 在 TerminalPane 中显示 "恢复上次终端会话？[恢复] [新建]"
  → 恢复：用相同 cwd 创建新 PTY
```

#### Level 2: 命名终端 Profile

```
设置中配置 Profiles:
  - name: "Dev Server"
  - cwd: "/Users/xbits/myproject"
  - command: "npm run dev"  # 可选，创建后自动执行

TerminalPane 顶部新增 Profile 选择器下拉菜单
```

#### Level 3: 终端书签

```
右键终端 → "添加书签"
  → 保存 (cwd, 当时的前 200 字符 scrollback)
  → 书签列表在 TerminalPane 侧边
  → 点击书签 → 打开新终端在书签目录
```

**涉及文件：**

| 文件 | 改动 |
|------|------|
| `src/main/ipc/terminal.ts` | 新增 `terminal:save-session`, `terminal:list-sessions`, `terminal:restore-session` handler |
| `src/main/store/schema.ts` | 新增 `terminal_sessions`, `terminal_profiles`, `terminal_bookmarks` 表 |
| `src/main/store/db.ts` | 新增 TerminalStore |
| `src/renderer/components/Artifact/panes/TerminalPane/TerminalPane.tsx` | 集成恢复提示 + Profile 选择器 |
| `src/renderer/components/Settings/pages/` | 新增 TerminalSettings |

**估时：** 2 天
- Schema + Store：0.5d
- 会话恢复：0.5d
- Profile 系统：0.5d
- UI：0.5d

---

## 8. Voice Input（P3）

### 8.1 现状

`Composer.tsx` 中有一个 `<Mic />` 图标按钮（第 182-189 行），但没有 `onClick` handler，纯装饰。

### 8.2 方案

**技术选型：Web Speech API (SpeechRecognition / webkitSpeechRecognition)**

Electron 的 Chromium 内核对 Web Speech API 的支持情况：
- macOS：✅ `webkitSpeechRecognition` 可用
- Windows：✅ 需要系统语音识别已配置
- Linux：⚠️ 可能不可用，需降级

**实现：**

```typescript
// src/renderer/hooks/useVoiceInput.ts

function useVoiceInput(onResult: (text: string) => void): VoiceInputState {
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const start = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      console.warn('SpeechRecognition not available')
      return  // 静默降级：Mic 按钮点击无反应
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      onResult(transcript)
    }

    recognition.onend = () => setIsListening(false)
    recognition.onerror = () => setIsListening(false)

    recognition.start()
    setIsListening(true)
    recognitionRef.current = recognition
  }, [onResult])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    setIsListening(false)
  }, [])

  return { isListening, isAvailable: !!window.SpeechRecognition || !!window.webkitSpeechRecognition, start, stop }
}
```

**Composer 集成：**
- `isListening` 为 true 时：Mic 按钮变红 + 脉动动画
- 识别结果追加到 composer 文本末尾
- 不可用时不显示 Mic 按钮（`isAvailable` 检查）

**降级策略：**

| 平台 | 行为 |
|------|------|
| macOS | Web Speech API 正常（使用系统语音引擎） |
| Windows 11+ | Web Speech API 正常（需在线） |
| Windows 10 | 可能降级为 offline 不可用 |
| Linux | 大概率不支持，隐藏按钮 |

**涉及文件：**

| 文件 | 改动 |
|------|------|
| `src/renderer/hooks/useVoiceInput.ts` | 新建 — Web Speech API 封装 |
| `src/renderer/components/Conversation/Composer.tsx` | 接入 useVoiceInput，Mic 按钮 onClick |

**风险点：**
- Web Speech API 的浏览器支持差异大，需要 feature detection
- 识别精度依赖系统语音引擎和语言设置
- 中文识别需要设置 `lang='zh-CN'`
- Electron 的 media 权限：需要确保 `navigator.mediaDevices.getUserMedia` 可用（macOS 需在 Info.plist 中声明 `NSMicrophoneUsageDescription`）

**估时：** 2 天
- useVoiceInput hook：0.5d
- Composer 集成 + UI：0.5d
- 平台测试 + 降级 + 权限：0.5d
- macOS entitlements 配置：0.5d

---

## 附录：实施优先级建议

```
Phase 1 (本周) — P1 决定性项
  ├── LSP 工具接线              [3-4d]
  └── 插件子进程隔离             [4-5d]  可并行

Phase 2 (下周) — P2 补齐项
  ├── MCP SSE 传输              [1d]
  ├── ModelResolver 自动路由     [2-3d]
  ├── SubAgent token 追踪        [0.5d]
  └── Code Signing               [1d]    (需证书)

Phase 3 (后续) — P3 体验项
  ├── Terminal 会话持久化         [2d]
  ├── Voice Input                [2d]
  └── Plugin Marketplace 客户端   [见独立设计文档]
```

**注：** Phase 1 和 Phase 2 之间有部分依赖——LSP 工具的 tool implementations 改动是独立的，但 LSPManager 需要先就位；插件隔离可以与 LSP 并行开发（两个开发者各自进行）。
