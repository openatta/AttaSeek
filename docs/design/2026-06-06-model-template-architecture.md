# 模型配置模板系统 架构设计

**日期：** 2026-06-06
**基于需求：** `docs/reqs/2026-06-06-model-template-system.md`

---

## 澄清结论

| 问题 | 结论 |
|------|------|
| 模板更新 | 手动刷新（UI 按钮），不从网络自动拉取 |
| 模板导入/导出 | 不需要 |
| API Key 来源 | 支持从环境变量自动导入（`ANTHROPIC_API_KEY`、`OPENAI_API_KEY` 等） |
| 支持的厂商 | 仅 LLM 开发厂商，不含运营商/路由商（如 OpenRouter、OneAPI） |
| 配置流程 | 默认只需 API Key，高级按键展开修改其他配置 |
| Provider 类型 | 仅两种接口：Anthropic Messages API + OpenAI Chat Completions API，覆盖全部厂商 |

---

## 内置模板清单（11 个）

### 国际厂商

| # | 厂商 | 接口模式 | Endpoint | 环境变量 | 默认模型 |
|---|------|---------|----------|---------|---------|
| 1 | **Anthropic** | Anthropic Native | `https://api.anthropic.com` | `ANTHROPIC_API_KEY` | `claude-sonnet-4-6`, `claude-haiku-4-5`, `claude-opus-4-8` |
| 2 | **OpenAI** | OpenAI Compatible | `https://api.openai.com/v1` | `OPENAI_API_KEY` | `gpt-4o`, `gpt-4o-mini`, `gpt-4.1` |
| 3 | **Google Gemini** | OpenAI Compatible | `https://generativelanguage.googleapis.com/v1beta/openai` | `GEMINI_API_KEY` | `gemini-2.5-pro`, `gemini-2.5-flash` |
| 4 | **xAI Grok** | OpenAI Compatible | `https://api.x.ai/v1` | `XAI_API_KEY` | `grok-4`, `grok-4-mini` |
| 5 | **Mistral** | OpenAI Compatible | `https://api.mistral.ai/v1` | `MISTRAL_API_KEY` | `mistral-large`, `mistral-small`, `codestral` |
| 6 | **Cohere** | OpenAI Compatible | `https://api.cohere.com/v1` | `COHERE_API_KEY` | `command-r-plus`, `command-r` |

### 国内厂商

| # | 厂商 | 接口模式 | Endpoint | 环境变量 | 默认模型 |
|---|------|---------|----------|---------|---------|
| 7 | **DeepSeek** | OpenAI Compatible | `https://api.deepseek.com/v1` | `DEEPSEEK_API_KEY` | `deepseek-chat`, `deepseek-reasoner` |
| 8 | **Qwen (阿里)** | OpenAI Compatible | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `DASHSCOPE_API_KEY` | `qwen-max`, `qwen-plus`, `qwen-turbo` |
| 9 | **Kimi (月之暗面)** | OpenAI Compatible | `https://api.moonshot.cn/v1` | `MOONSHOT_API_KEY` | `moonshot-v1-8k`, `moonshot-v1-32k`, `moonshot-v1-128k` |
| 10 | **GLM (智谱)** | OpenAI Compatible | `https://open.bigmodel.cn/api/paas/v4` | `ZHIPU_API_KEY` | `glm-4-plus`, `glm-4-flash` |
| 11 | **MiniMax** | OpenAI Compatible | `https://api.minimax.chat/v1` | `MINIMAX_API_KEY` | `abab7-chat`, `abab6.5s-chat` |

---

## 组件结构

```
src/main/model/
├── ModelTemplateService.ts          [新建] 模板加载 + 刷新 + 环境变量导入
├── ModelConfigService.ts            [修改] 从 SQLite → JSON 文件存储
├── ProviderFactory.ts               [不变] 已有 Anthropic + OpenAI Compatible 双模式
├── OpenAICompatibleProvider.ts      [不变] 已有，覆盖全部 10 个 OpenAI 兼容厂商
└── templates/                       [新建] 内置模板 JSON 文件
    ├── anthropic.json
    ├── openai.json
    ├── gemini.json
    ├── grok.json
    ├── mistral.json
    ├── cohere.json
    ├── deepseek.json
    ├── qwen.json
    ├── kimi.json
    ├── glm.json
    └── minimax.json

src/main/agent/llm/
├── LLMProvider.ts                    [不变] 接口定义
├── AnthropicProvider.ts             [不变] Anthropic Native 实现
└── LLMProviderRegistry.ts           [不变] 注册表

src/renderer/components/Settings/pages/
├── ModelSettings.tsx                 [修改] 模板列表 + 添加模型
├── ModelConfigForm.tsx              [重写] 两步流程（选模板→填Key+高级）
└── ModelTemplateCard.tsx            [新建] 模板卡片组件

src/renderer/atoms/
└── modelConfigAtom.ts               [修改] 新增 modelTemplatesAtom

~/.atta/seek/
├── model-templates/                  [新建] 用户自定义模板
│   └── {name}.json
└── model-configs.json                [新建] 所有模型配置（替代 SQLite model_configs 表）
```

---

## 模板 JSON 格式

```typescript
interface ModelTemplate {
  id: string                    // 唯一标识，如 "anthropic"
  name: string                  // 显示名称，如 "Anthropic Claude"
  provider: string              // 厂商名
  interfaceType: 'anthropic' | 'openai_compatible'
  endpointUrl: string           // API 端点
  defaultModels: string[]       // 默认模型列表
  defaultModel: string          // 默认选中的模型
  envKey: string                // 环境变量名，如 "ANTHROPIC_API_KEY"
  apiKeyUrl: string             // 获取 API Key 的网址
  apiKeyHeader: string          // API Key 放在哪个 Header，如 "x-api-key"
  recommendedParams: {          // 推荐参数
    temperature?: number
    maxTokens?: number
    topP?: number
  }
  iconType: 'anthropic' | 'openai' | 'gemini' | 'grok' | 'mistral' | 'cohere'
          | 'deepseek' | 'qwen' | 'kimi' | 'glm' | 'minimax'
  region: 'international' | 'china'
  version: number               // 模板版本号，手动刷新时递增
}
```

### 示例：`deepseek.json`

```json
{
  "id": "deepseek",
  "name": "DeepSeek",
  "provider": "DeepSeek (深度求索)",
  "interfaceType": "openai_compatible",
  "endpointUrl": "https://api.deepseek.com/v1",
  "defaultModels": ["deepseek-chat", "deepseek-reasoner"],
  "defaultModel": "deepseek-chat",
  "envKey": "DEEPSEEK_API_KEY",
  "apiKeyUrl": "https://platform.deepseek.com/api_keys",
  "apiKeyHeader": "Authorization",
  "apiKeyPrefix": "Bearer ",
  "recommendedParams": { "temperature": 0.7, "maxTokens": 4096 },
  "iconType": "deepseek",
  "region": "china",
  "version": 1
}
```

---

## 数据流

### 配置模型 — 两步流程

```
用户打开 Model Settings → 点击"添加模型"
  │
  ▼
Step 1: 选择模板
  ModelTemplateCard 网格（11 张卡片）
  ├─ 按 region 分组（国际 / 国内）
  ├─ 搜索过滤（名称、厂商）
  ├─ 每张卡片显示: 图标 + 名称 + 接口模式标签 + 默认模型预览
  └─ 用户点击卡片 → 进入 Step 2
  │
  ▼
Step 2: 填写配置
  ┌─────────────────────────────────┐
  │  DeepSeek                        │
  │  https://api.deepseek.com/v1     │
  │                                  │
  │  API Key: [________________]  👁️  │  ← 仅此项必填
  │  💡 从环境变量 DEEPSEEK_API_KEY 自动导入  │  ← 环境变量检测
  │  🔗 获取 Key: platform.deepseek.com    │
  │                                  │
  │  [高级 ▸]                         │  ← 折叠面板（默认隐藏）
  │    Endpoint: [______________]    │
  │    默认模型: [deepseek-chat  ▾] │
  │    模型列表: [______________]    │
  │    推荐参数: temperature [0.7]  │
  │  [测试连接]  [保存]              │
  └─────────────────────────────────┘
  │
  ▼
保存 → IPC model:create → ModelTemplateService.fillTemplate()
  → ProviderFactory.createProvider() → LLMProviderRegistry.registerById()
  → JSONStore 写入 model-configs.json
```

### 环境变量导入

```
ModelConfigForm 加载时:
  1. 读取模板的 envKey（如 "DEEPSEEK_API_KEY"）
  2. 检查 process.env[envKey] 是否存在
  3. 若存在 → 自动填充 API Key 输入框 + 显示提示 "已从环境变量导入"
  4. 用户可修改或保留
  5. 同一环境变量可被多个同厂商的配置使用
```

### 手动刷新模板

```
用户点击 Model Settings 中的 "刷新模板" 按钮:
  1. ModelTemplateService.refresh()
  2. 重新读取 src/main/model/templates/*.json（内置模板作为应用资源打包）
  3. 比较 version 字段 → 仅更新版本号更高的模板
  4. 用户自定义模板不受影响
  5. 重启后生效（或即时更新模板元数据，已创建的配置不受影响）
```

---

## Provider 接口模式覆盖

```
                    ┌──────────────────────────┐
                    │    LLMProvider 接口        │
                    │  chat / chatStream         │
                    └──────────┬───────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            │                                      │
   AnthropicProvider                      OpenAICompatibleProvider
   (Anthropic Messages API)              (Chat Completions API)
            │                                      │
    Anthropic Claude                       ┌───────┼───────┬──────┬──────┐
                                           │       │       │      │      │
                                         OpenAI  Gemini  Grok  Mistral Cohere
                                           │       │       │      │      │
                                        DeepSeek  Qwen   Kimi   GLM  MiniMax
```

**结论：仅需两种 Provider 实现即可覆盖全部 11 个厂商。** Anthropic 使用原生 SDK，其余 10 个全部使用 OpenAI 兼容端点。无需新增 Provider 代码。

---

## IPC Contract

| Channel | 方向 | 变更 |
|---------|------|------|
| `model:list` | renderer→main | 返回新增 `templateId` 字段 |
| `model:create` | renderer→main | 新增 `templateId?: string` 参数，触发模板填充 |
| `model:templates` | renderer→main | [新建] 获取所有内置+自定义模板列表 |
| `model:refresh-templates` | renderer→main | [新建] 手动刷新模板 |
| `model:import-env-key` | renderer→main | [新建] 检查环境变量并返回已检测到的 API Key |

---

## Jotai Atoms

| Atom | 类型 | 说明 |
|------|------|------|
| `modelTemplatesAtom` | `ModelTemplate[]` | 所有可用模板列表 |
| `modelConfigsAtom` | `ModelConfig[]` | 已有（增加 `templateId` 字段） |
| `selectedTemplateAtom` | `ModelTemplate \| null` | 当前表单中选择的模板 |

---

## 技术决策

| 决策 | 选择 | 理由 | 替代方案 |
|------|------|------|---------|
| 模板存储 | 编译时打包 .json 到应用资源 | 内置模板随应用更新而更新，不需要网络请求。11 个模板文件总计 <5KB | 网络获取（依赖外部服务、离线不可用） |
| Provider 类型 | 仅 Anthropic + OpenAI Compatible 两种 | 所有现代 LLM 都提供 OpenAI 兼容端点。Gemini、DeepSeek、Qwen 等全部通过 OpenAI Compatible 接入，零额外开发 | 每厂商单独 Provider（爆炸式增长，不可维护） |
| 高级配置 | 默认隐藏，按键展开 | 降低入门门槛。90% 用户只需 API Key。高级用户点击展开可修改 endpoint/模型/参数 | 全部展开（新用户困惑）；全部隐藏（高级用户无法定制） |
| API Key 存储 | safeStorage 加密后存 JSON | 已有 `store/secrets.ts` 逻辑。JSON 文件中的 apiKey 字段为加密后的 base64 字符串 | 纯明文（安全风险）；Keychain（跨平台不一致） |
| 环境变量导入 | 自动检测 `process.env[key]` | 开发者和 CLI 用户的常见实践。Docker/CI 环境中尤其有用 | 手动输入（对开发者不友好） |
| 模型配置迁移 | SQLite `model_configs` → `model-configs.json` | DataMigrator 一次性迁移，与存储层 V3 一致 | 保留双写（违背明文优先） |
