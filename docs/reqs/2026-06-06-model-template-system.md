# 模型配置模板系统 需求规格

**目标：** 建立模型配置模板系统，内置主流 LLM 提供商的完整配置模板。用户只需输入 API Key 即可使用，无需手动填写 endpoint URL、模型列表等参数。支持自定义模板和社区共享。

**背景：** 当前 ModelConfigForm 需要用户手动填写 endpoint URL、模型列表、默认模型等 6+ 个字段。对于非技术用户和不熟悉 API 端点的新用户，这是一个显著的入门障碍。Claude Code 内置了 Anthropic 的配置（只需 API Key），Codex Desktop 内置了 OpenAI 的配置。AttaSeek 作为通用 Agent 工作台，应当内置主流提供商的配置模板，降低使用门槛。

---

## 范围

### In scope

**1. 两种接口模式模板**

所有 LLM 模板基于两种底层接口模式：

- **Anthropic Native 模式** — 使用 Anthropic Messages API（`/v1/messages`），适用：Claude 系列模型
- **OpenAI Compatible 模式** — 使用 OpenAI Chat Completions API（`/v1/chat/completions`），适用：绝大多数第三方模型

用户在添加新模型时首先选择接口模式，系统自动填充对应的 endpoint URL、默认模型列表和参数格式。

**2. 内置提供商模板（8 个）**

| 提供商 | 接口模式 | Endpoint URL | 内置默认模型 |
|--------|---------|-------------|------------|
| **Anthropic** | Anthropic Native | `https://api.anthropic.com` | `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`, `claude-opus-4-8` |
| **OpenAI** | OpenAI Compatible | `https://api.openai.com/v1` | `gpt-4o`, `gpt-4o-mini`, `gpt-4.1` |
| **Grok (xAI)** | OpenAI Compatible | `https://api.x.ai/v1` | `grok-4`, `grok-4-mini`, `grok-3` |
| **Gemini (Google)** | OpenAI Compatible | `https://generativelanguage.googleapis.com/v1beta/openai` | `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.0-flash` |
| **DeepSeek** | OpenAI Compatible | `https://api.deepseek.com/v1` | `deepseek-chat`, `deepseek-reasoner` |
| **Qwen (通义千问)** | OpenAI Compatible | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-max`, `qwen-plus`, `qwen-turbo` |
| **Kimi (月之暗面)** | OpenAI Compatible | `https://api.moonshot.cn/v1` | `moonshot-v1-8k`, `moonshot-v1-32k`, `moonshot-v1-128k` |
| **MiniMax** | OpenAI Compatible | `https://api.minimax.chat/v1` | `abab7-chat`, `abab6.5s-chat` |

每个模板包含：提供商名称、logo/图标标识、接口模式、endpoint URL、默认模型列表、推荐参数（temperature、maxTokens 等）、认证方式说明（API Key 放在 Header 的哪个字段）、获取 API Key 的链接。

**3. 用户自定义模板**

用户可以基于内置模板修改并保存为自定义模板，也可以从零创建新模板。自定义模板存储为 JSON 文件（`~/.atta/seek/model-templates/*.json`），支持导出/导入。

**4. 模板选择 UI**

在 ModelConfigForm 中，将当前的自由填写表单改为"选择模板 + 填写 API Key"的两步流程：
- **Step 1：选择模板** — 展示网格或列表，每个模板显示提供商名称、logo、接口模式标签。搜索/过滤功能。
- **Step 2：填写 API Key + 微调** — API Key 输入框（带显示/隐藏切换 + 获取链接）。高级选项折叠面板（可修改 endpoint、模型列表等预填值）。

**5. 配置存储**

模型配置（模板填充后的实际配置）存储在明文 JSON 文件中：
- `~/.atta/seek/model-configs.json`（全局，替代当前的 SQLite `model_configs` 表）
- 格式：`ModelConfig[]` 数组，与现有 `ModelConfig` 类型兼容

### Out of scope

- 模型模板的在线市场/社区共享
- 自动检测 API Key 有效性的预检机制（已有 `model:test` 接口）
- 模板的版本管理和自动更新
- 从 Claude Code / Codex 自动导入已配置的 API Key

### 前置依赖

- `ModelConfigForm.tsx` 现有组件
- `modelConfigAtom.ts` 现有原子
- `model:create` / `model:test` IPC 通道
- `store/settings.ts` / `ConfigManager` 配置系统
- `store/FileStore.ts` JSON 读写

---

## 用户场景

### 场景 1: 首次使用 — 一键配置 Anthropic

- **给定:** 用户首次启动 AttaSeek，未配置任何模型
- **当:** 用户打开 Settings → Model，点击"添加模型"
- **则:**
  1. 显示 8 个提供商模板卡片（Anthropic、OpenAI、Grok、Gemini、DeepSeek、Qwen、Kimi、MiniMax）
  2. 用户点击 Anthropic 卡片
  3. 表单自动填充：endpoint `https://api.anthropic.com`、默认模型列表（3 个 Claude 模型）、接口模式 `Anthropic Native`
  4. 用户只需输入 API Key（从 `https://console.anthropic.com/` 获取）
  5. 点击"测试连接" → 显示"连接成功，可用模型: claude-sonnet-4-6, ..."
  6. 点击"保存" → 模型配置生效，Composer 中可以开始对话

### 场景 2: 国内用户 — 配置 DeepSeek

- **给定:** 中国用户，有 DeepSeek API Key
- **当:** 用户在模板列表中选择"DeepSeek"
- **则:**
  1. 表单自动填充 DeepSeek 的 endpoint 和模型列表
  2. 认证说明显示："API Key 放在 Header `Authorization: Bearer {key}`。获取地址: https://platform.deepseek.com/api_keys"
  3. 用户输入 API Key，测试连接通过
  4. 保存后即可使用

### 场景 3: 高级用户 — 自定义模板

- **给定:** 用户使用某个小众 OpenAI 兼容服务，不在内置列表中
- **当:** 用户点击"自定义模板"
- **则:**
  1. 选择接口模式（OpenAI Compatible）
  2. 手动填写 endpoint URL、模型列表
  3. 保存为自定义模板（存储在 `~/.atta/seek/model-templates/custom-provider.json`）
  4. 下次添加模型时，该自定义模板出现在模板列表中

### 场景 4: 多模型切换

- **给定:** 用户已配置 Anthropic 和 DeepSeek 两个模型
- **当:** 用户在 Composer 的 ModelSelector 中切换
- **则:**
  1. 下拉菜单显示两个配置的名称（"Anthropic Claude" / "DeepSeek"）
  2. 选择后，对应模型的 `activeModelId` 更新
  3. 下一次 Agent 执行时使用新选择的模型

### 场景 5: 异常 — API Key 无效

- **给定:** 用户输入了错误的 API Key
- **当:** 用户点击"测试连接"
- **则:**
  1. 测试请求返回 401
  2. UI 显示："连接失败 — API Key 无效。请检查 Key 是否正确，或访问获取链接重新生成。"
  3. 不阻止用户保存配置（用户可以稍后修复）

---

## 待澄清

- [ ] 内置模板的模型列表是否需要定期更新？如何更新（应用更新时更新 / 用户手动刷新 / 在线获取最新模型列表）？
- [ ] 自定义模板是否需要导出/导入功能（分享给团队）？格式是什么？
- [ ] 是否需要"从 Claude Code 导入已有 API Key"的功能？（安全敏感，需要用户确认）

---

## 风险

- **模板信息过时风险** — 模型名称和 endpoint URL 可能变更。需要模板版本号机制和更新提醒。
- **API Key 明文存储风险** — JSON 文件中 API Key 为明文。需要 safeStorage 加密（已有 `store/secrets.ts` 逻辑可复用）。
- **模板配置错误风险** — 内置模板的 endpoint URL 或默认模型可能有误，导致用户测试连接失败。需要定期验证。
- **安全提示缺失风险** — 用户可能不知道从哪里获取 API Key。每个模板需附带获取链接和安全提示（"不要分享你的 API Key"）。
