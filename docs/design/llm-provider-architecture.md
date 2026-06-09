# LLM Provider 架构

## 核心原则

```
所有 LLM Provider
  │
  ├─ 兼容 OpenAI API 的 → OpenAICompatibleProvider（/v1/chat/completions）
  │    ├─ DeepSeek chat/flash, Qwen, Moonshot, 通用OpenAI...
  │    └─ 这是**首选**，因为CHATS基于OpenAI格式设计
  │
  └─ 不兼容 OpenAI 的 → AnthropicProvider（/v1/messages）
       ├─ Anthropic Claude 系列
       └─ DeepSeek v4-pro（Anthropic兼容接口 + web_search_20250305）
```

**不是每个 provider 建一个类。只有两条代码路径：**

| 接口格式 | Provider 类 | 端点 |
|---------|------------|------|
| OpenAI 兼容 | `OpenAICompatibleProvider` | `/v1/chat/completions` |
| Anthropic 原生 | `AnthropicProvider` | `/v1/messages` |

## 多接口支持

一个 Provider（如 DeepSeek）可以注册**多个接口**：

```json
{
  "name": "DeepSeek",
  "interfaceType": "anthropic",
  "endpointUrl": "https://api.deepseek.com",
  "model": "deepseek-v4-pro",
  "interfaces": {
    "openai_compatible": {
      "endpointUrl": "https://api.deepseek.com",
      "extraParams": { "search": true }
    }
  },
  "haikuModel": "deepseek-v4-flash",
  "sonnetModel": "deepseek-chat"
}
```

- `model: deepseek-v4-pro` → 走主接口 `anthropic` → `/v1/messages` + `web_search_20250305`
- `haikuModel: deepseek-v4-flash` → 匹配到 `interfaces.openai_compatible` → `/v1/chat/completions`
- `sonnetModel: deepseek-chat` → 同上

## 路由逻辑

```
请求 LLM（model slot: "main" / "haiku" / "subagent"...）
  │
  ├─ 解析 model slot → 得到具体 model name
  │    main → config.model
  │    haiku → config.haikuModel
  │    subagent → config.subagentModel
  │
  ├─ 查找 model name 属于哪个 interface
  │    model 匹配 config.model → 主接口
  │    model 匹配 config.interfaces[xxx].models → 该 secondary 接口
  │
  └─ 用对应 Provider 发请求
```

## ModelConfig 类型

```typescript
interface ProviderInterface {
  interfaceType: 'openai_compatible' | 'anthropic'
  endpointUrl?: string  // 省略则继承主 endpointUrl
  models?: string[]     // 哪些 model 走这个接口
  extraParams?: Record<string, unknown>
}

interface ModelConfig {
  // 主接口
  interfaceType: 'openai_compatible' | 'anthropic'
  endpointUrl: string
  model: string
  // 附加接口
  interfaces?: Record<string, ProviderInterface>
  // Model slots（原字段不变）
  haikuModel?: string
  sonnetModel?: string
  opusModel?: string
  smallFastModel?: string
  subagentModel?: string
  strongModel?: string
  fallbackModel?: string
  classifierModel?: string
  compactModel?: string
  searchModel?: string
}
```

## 添加新 Provider 指南

### 只需 OpenAI 兼容（绝大多数）

settings.json:
```json
{
  "interfaceType": "openai_compatible",
  "endpointUrl": "https://api.example.com/v1",
  "model": "example-model"
}
```

无需额外配置。`ProviderFactory` 自动创建 `OpenAICompatibleProvider`。

### 需要 Anthropic 兼容

settings.json:
```json
{
  "interfaceType": "anthropic",
  "endpointUrl": "https://api.anthropic.com",
  "model": "claude-sonnet-4-6"
}
```

### 混合（主 Anthropic + 备 OpenAI）

像 DeepSeek：pro 用 Anthropic 接口 + web_search，chat/flash 用 OpenAI 接口。

```json
{
  "interfaceType": "anthropic",
  "model": "deepseek-v4-pro",
  "haikuModel": "deepseek-v4-flash",
  "sonnetModel": "deepseek-chat",
  "interfaces": {
    "openai_compatible": {
      "interfaceType": "openai_compatible",
      "extraParams": { "search": true }
    }
  }
}
```

因为 `deepseek-v4-flash` 和 `deepseek-chat` 不在主接口的 models 列表里，系统会匹配到 `interfaces.openai_compatible`，走 `/v1/chat/completions` + `search: true`。
