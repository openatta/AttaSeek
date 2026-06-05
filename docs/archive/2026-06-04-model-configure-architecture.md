# Model Configure 架构设计

> **日期：** 2026-06-04
> **基于需求：** `docs/requirements/2026-06-04-llm-configuration.md`
> **状态：** 设计草稿

---

## 1. 组件结构

```
src/main/
  model/                              [新 目录]
    ModelConfigService.ts             [新] SQLite CRUD for model configs; boot-time provider instantiation
    OpenAICompatibleProvider.ts       [新] LLMProvider impl over /v1/chat/completions
    ModelUsageTracker.ts              [新] Token usage recording + aggregated queries
  agent/
    LLMProvider.ts                    [改] LLMProviderRegistry extended: multi-instance, getById(), per-model API key
    AgentLoop.ts                      [改] Accept optional model config ID, record usage after chat
  ipc/
    model.ts                          [新] IPC handlers: list/create/update/delete/set-default/test/usage/has-config
  store/
    schema.ts                         [改] Add model_configs + token_usage tables
    secrets.ts                        [不改] Already supports multi-key storage via provider name prefix

src/preload/
  index.ts                            [改] Add window.api.model namespace

src/renderer/
  atoms/
    modelConfigAtom.ts                [新] modelConfigsAtom, activeModelIdAtom, hasModelConfiguredAtom
    settingsAtom.ts                   [改] Add 'model' section + SETTINGS_SECTIONS entry
    sessionAtom.ts                    [改] Add activeModelId to session state
  components/Settings/
    Settings.tsx                      [改] Add 'model' to PAGE_MAP
    SettingsSidebar.tsx               [改] No change needed (auto-reads from SETTINGS_SECTIONS)
    pages/
      ModelSettings.tsx               [新] List view: all configs, default badge, test status, actions
      ModelConfigForm.tsx             [新] Add/edit form with test-connection button
  components/Conversation/
    ModelSelector.tsx                 [改] From static placeholder → functional dropdown
    Composer.tsx                      [改] Wire ModelSelector + no-config guard
    MessageFlow.tsx                   [改] NoModelPrompt card when models empty
    NoModelPrompt.tsx                 [新] "No model configured" hint card with CTA
```

---

## 2. 数据模型

```text
model_configs:
  id            TEXT PK
  name          TEXT NOT NULL UNIQUE        -- 用户命名 "My DeepSeek"
  interface_type TEXT NOT NULL               -- 'openai_compatible' | 'anthropic'
  endpoint_url  TEXT NOT NULL               -- API base URL
  default_model TEXT NOT NULL               -- 默认模型名
  extra_params  TEXT                         -- JSON nullable
  is_default    INTEGER NOT NULL DEFAULT 0
  created_at    INTEGER NOT NULL
  updated_at    INTEGER NOT NULL

token_usage:
  id                TEXT PK
  config_id         TEXT NOT NULL  -- FK → model_configs.id
  session_id        TEXT
  task_id           TEXT
  model             TEXT NOT NULL  -- 实际调用的模型名
  input_tokens      INTEGER NOT NULL
  output_tokens     INTEGER NOT NULL
  created_at        INTEGER NOT NULL

  INDEX idx_token_usage_config ON token_usage(config_id, created_at)
  INDEX idx_token_usage_session ON token_usage(session_id)
```

---

## 3. LLMProvider 接口扩展

现有 `LLMProvider` 接口保留不变（`chat` / `chatStream` / `validateKey`）。变化在 `LLMProviderRegistry`：

```ts
// 现有: 按 provider name (如 'anthropic') 单例注册
// 目标: 按 config ID (如 'config_abc123') 多实例注册

class LLMProviderRegistry {
  // 按 config ID 注册（替代按 name）
  registerById(id: string, provider: LLMProvider): void

  // 按 config ID 获取
  getById(id: string): LLMProvider | undefined

  // 获取默认 provider
  getDefault(): LLMProvider | undefined

  // 移除
  unregister(id: string): boolean

  // 列表: [ { id, name, models, interfaceType } ]
  listProviders(): ProviderInfo[]
}
```

**关键变化**: 从 `provider.name` 单例 → `config.id` 多实例。同一种接口类型（如两个 Anthropic 配置）对应两个独立 provider 实例，各自持有自己的 API client。

---

## 4. OpenAICompatibleProvider

实现 `LLMProvider` 接口，封装 `/v1/chat/completions` 调用。

```
OpenAICompatibleProvider implements LLMProvider
  constructor(config: ModelConfig, apiKey: string)

  chat(params: LLMChatParams): Promise<LLMChatResult>
    → POST { endpointUrl }/v1/chat/completions
    → request body: { model, messages, tools?, stream: false }
    → response → LLMContentBlock[] (function_call → tool_use 映射)

  chatStream(params, onChunk): Promise<LLMChatResult>
    → POST { endpointUrl }/v1/chat/completions with stream: true
    → SSE 解析 → onChunk(text_delta / tool_call_delta)
    → 流结束 → 聚合 LLMChatResult

  validateKey(apiKey): Promise<boolean>
    → 发送最小请求 (max_tokens=1) 验证连通性

  // Tool calling 映射:
  // LLMToolDef → OpenAI function 格式
  // tool_use response → LLMToolUseBlock
  // tool_result → OpenAI tool message 格式
```

**特殊处理**：
- Anthropic 原生 tool_use 是 `{ type: "tool_use", id, name, input }` 结构
- OpenAI function_call 是 `{ role: "assistant", function_call: { name, arguments } }` 结构
- 两者在 `LLMContentBlock` 层面统一，Provider 各自做格式转换

---

## 5. 数据流

### 5.1 配置管理流程

```
Settings/ModelSettings
  → [List] IPC model:list → ModelConfigService.listAll() → SQLite → return
  → [Add]  ModelConfigForm → 填写字段 → [Save]
      → IPC model:create → ModelConfigService.create()
        → SQLite INSERT
        → instantiate provider (Anthropic or OpenAICompatible)
        → register in LLMProviderRegistry
        → store API key via secrets.storeApiKey("model:<id>", key)
        → return config
  → [Test] IPC model:test → ModelConfigService.test(id)
        → get provider from registry → provider.validateKey()
        → return { success, latencyMs, model?, error? }
  → [Delete] IPC model:delete → ModelConfigService.delete(id)
        → unregister from LLMProviderRegistry
        → secrets.deleteApiKey("model:<id>")
        → SQLite DELETE
        → if was default → auto-promote next config to default
```

### 5.2 启动加载流程

```
boot() → ModelConfigService.loadAll()
  → SQLite SELECT all model_configs
  → for each: secrets.getApiKey("model:<id>") → instantiates provider → registers in registry
  → if no configs: registry empty (renderer shows prompt)
```

### 5.3 Agent 调用流程

```
Composer.handleSend()
  → check hasModelConfiguredAtom
  → false → render NoModelPrompt card, stop
  → true →
    → get activeModelId from atom (or default from config list)
    → IPC agent:create-task(goal, sessionId, projectId?, { modelConfigId })
    → AgentRuntime → AgentLoop.run(task with modelConfigId)
      → LLMProviderRegistry.getById(modelConfigId) || getDefault()
      → chatStream() ...
      → on complete: ModelUsageTracker.record(inputTokens, outputTokens, model, configId, sessionId, taskId)
```

### 5.4 Per-conversation 选择流程

```
Composer → ModelSelector 下拉
  → 读取 modelConfigsAtom → 渲染列表
  → 默认项标注 ⭐
  → 用户选择 → activeModelIdAtom ← config.id
  → 下次发送使用 activeModelIdAtom 的值
  → 新建会话 → activeModelIdAtom 重置为 null（fallback 到默认）
```

---

## 6. IPC Contract

| Channel | 方向 | 请求 | 响应 |
|---|---|---|---|
| `model:list` | R→M | `{}` | `{ configs: ModelConfig[] }` |
| `model:get` | R→M | `{ id }` | `{ config: ModelConfig \| null }` |
| `model:create` | R→M | `{ config: CreateModelConfig }` | `{ config: ModelConfig }` |
| `model:update` | R→M | `{ id, patch }` | `{ config: ModelConfig \| null }` |
| `model:delete` | R→M | `{ id }` | `{ success, needNewDefault? }` |
| `model:set-default` | R→M | `{ id }` | `{ success }` |
| `model:test` | R→M | `{ id }` | `{ success, latencyMs?, model?, error? }` |
| `model:usage` | R→M | `{ configId?, period? }` | `{ totalInput, totalOutput, byModel: [...], byDay: [...] }` |
| `model:has-config` | R→M | `{}` | `{ configured: boolean }` |

---

## 7. Jotai Atoms

| Atom | 类型 | 作用范围 | 持久化 | 说明 |
|---|---|---|---|---|
| `modelConfigsAtom` | `ModelConfig[]` | global | no | 全量配置列表，启动时从 main process 加载 |
| `activeModelIdAtom` | `string \| null` | session | no | 当前会话选择的 model config ID；null = 使用默认 |
| `hasModelConfiguredAtom` | `boolean` | global | no | derived: `modelConfigsAtom.length > 0` |
| `modelUsageAtom` | `UsageStats \| null` | local | no | 单个 config 的用量统计，按需加载 |

---

## 8. UI 组件设计

### 8.1 ModelSettings（列表页）

```
┌─────────────────────────────────────────────────┐
│ Model Configure                                  │
│                                                  │
│ ┌─────────────────────────────────────────────┐  │
│ │ ⭐ My Claude          Anthropic  │ ✓ Connected │  │
│ │    claude-sonnet-4-6               [Edit] [Test] [Del] │
│ ├─────────────────────────────────────────────┤  │
│ │   My DeepSeek         OpenAI Compat │ ⚠ Untested   │  │
│ │    deepseek-chat                 [Edit] [Test] [Del] │
│ ├─────────────────────────────────────────────┤  │
│ │   Workplace GPT       OpenAI Compat │ ✓ Connected │  │
│ │    gpt-4o                         [Edit] [Test] [Del] │
│ └─────────────────────────────────────────────┘  │
│                                                  │
│  [+ Add Model]                                   │
│                                                  │
│ ── Usage ────────────────────────────────────   │
│  Today: 12,340 in / 4,567 out                   │
│  This Week: 89,000 in / 34,200 out              │
└─────────────────────────────────────────────────┘
```

### 8.2 ModelConfigForm（添加/编辑）

```
┌─────────────────────────────────────────────────┐
│ Add Model / Edit "My DeepSeek"                   │
│                                                  │
│  Name:        [My DeepSeek              ]        │
│  Interface:   [OpenAI Compatible ▼      ]        │
│  Endpoint URL:[https://api.deepseek.com/v1]      │
│  API Key:     [••••••••••••••••] [👁]           │
│  Default Model:[deepseek-chat          ]         │
│  Extra Params: { "temperature": 0.7 }  [JSON]    │
│                                                  │
│  [Test Connection]  ← "✓ Connected (230ms)"     │
│                                                  │
│  [Cancel]  [Save]                                │
└─────────────────────────────────────────────────┘
```

### 8.3 ModelSelector（Composer 底部下拉）

```
┌──────────────────────────┐
│ ⭐ My Claude / sonnet ▲  │  ← 折叠态：默认 provider + 模型
└──────────────────────────┘
         ↓ 点击展开
┌──────────────────────────┐
│ ⭐ My Claude              │  ← 默认标记
│    claude-sonnet-4-6      │
│    claude-opus-4-8        │  ← 同 provider 的其他模型
│ ─────────────────────── │
│   My DeepSeek             │
│    deepseek-chat          │
│ ─────────────────────── │
│   Workplace GPT           │
│    gpt-4o                 │
│    gpt-4o-mini            │
└──────────────────────────┘
```

### 8.4 NoModelPrompt（无配置提示卡片）

```
┌─────────────────────────────────────────────┐
│ ⚠ No model configured                       │
│                                              │
│ You need to configure at least one LLM       │
│ provider before the agent can respond.       │
│                                              │
│ [Open Model Settings →]                      │
└─────────────────────────────────────────────┘
```

---

## 9. 技术决策

| 决策 | 方案 | 理由 | 替代方案 |
|---|---|---|---|
| Provider 多实例 | Registry 按 config ID 索引，每个 config 一个 provider 实例 | 每个 provider 有独立 endpoint/key/client，隔离清晰 | 单例 provider + 运行时切换 key（代码复杂，切换有副作用） |
| OpenAI 兼容实现 | 直接用 fetch() + SSE 解析，不依赖 openai SDK | 减少依赖，endpoint URL 自由，兼容任何 `/v1/chat/completions` 服务 | openai SDK（增加依赖，且 SDK 绑定 api.openai.com） |
| Tool calling 映射 | Provider 内部做 `function_call` ↔ `tool_use` 转换 | AgentLoop 只消费统一的 `LLMContentBlock` 格式 | 在 AgentLoop 层做转换（耦合度高） |
| API key 分离 | 每个 config 的 key 独立存储：`model:<configId>` | 支持同一 provider 类型多个 key（个人/公司），删除 config 时 key 级联删除 | 按 provider type 共享 key（不支持多实例） |
| 默认 model 选择 | `is_default` 字段，唯一约束由 service 层保证 | SQLite 不支持 partial unique index 的通用写法 | 应用层保证唯一默认（已实现） |
| ModelSelector 数据 | 直接从 `modelConfigsAtom` 读取，不额外 IPC | 数据已在 renderer 内存中，零延迟 | 每次打开下拉时 IPC 刷新（延迟可感知） |
| Token 统计写入 | AgentLoop 完成后同步写入 SQLite | better-sqlite3 P95 <10ms，不阻塞用户体验 | 异步批量写入（复杂度高，断电可能丢数据） |
| No-model 检测 | renderer 侧 `hasModelConfiguredAtom` 派生检查 | 不需 IPC 往返，即时判断 | main process 返回（多一次 IPC） |

---

## 10. 实现顺序

```
Phase 1: 数据层 + 主进程基础设施
  P1.1: model_configs + token_usage 表 → schema.ts
  P1.2: ModelConfigService (CRUD + boot loading)
  P1.3: LLMProviderRegistry 扩展（多实例）
  P1.4: secrets.ts 适配多 key (model:<id>)
  P1.5: IPC model:* handler + preload API

Phase 2: OpenAI 兼容 Provider
  P2.1: OpenAICompatibleProvider (chat + chatStream + tool mapping)
  P2.2: ModelUsageTracker (record + query)

Phase 3: Agent Loop 适配
  P3.1: AgentLoop 接受 modelConfigId 参数
  P3.2: createTask IPC 扩展 modelConfigId 字段
  P3.3: AgentLoop 完成后记录 token usage

Phase 4: Settings UI
  P4.1: modelConfigAtom + settingsAtom 扩展
  P4.2: ModelSettings 列表页
  P4.3: ModelConfigForm 添加/编辑/测试
  P4.4: SettingsSidebar 新增 "Model Configure" section

Phase 5: Composer + Conversation 适配
  P5.1: ModelSelector 从静态→功能下拉
  P5.2: Composer 集成 activeModelId + no-config 拦截
  P5.3: NoModelPrompt 卡片 + MessageFlow 集成

Phase 6: 测试
  P6.1: ModelConfigService 单测
  P6.2: OpenAICompatibleProvider 单测 (mock HTTP)
  P6.3: ModelUsageTracker 单测
```

## 简报

需要在6个层面增加和修改软件的功能：主进程数据层增加两张SQL表+ModelConfigService(CRUD+ 启动时加载所有配置)、LLMProviderRegistry 从单例改为按 config ID 多实例注册、新建 OpenAICompatibleProvider(封装/v1/chat/completions + tool calling 映射)、IPC 新增 model:* 9 个 channel，渲染进程增加 ModelSettings 列表页、ModelConfigForm 添加/编辑/测试表单、ModelSelector 从静态占位改为 Composer 底下拉、NoModelPrompt 无配置提示卡片，AgentLoop 扩展接受 modelConfigId 并在完成后记录 token 用量，per-conversation 选择通过 Jotai activeModelIdAtom 驱动。
