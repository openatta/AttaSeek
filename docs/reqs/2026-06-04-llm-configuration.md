# LLM 多Provider 配置管理 需求分析

**目标：** 用户可以配置多个 LLM provider，为每个会话选择不同模型，系统统计每个 provider 的 token 用量
**背景：** 当前只有单一 Anthropic provider 硬编码实现，无配置界面、无多模型选择、无用量统计

---

## 范围

### In scope

1. **LLM Provider 配置 CRUD** — 添加/编辑/删除/查看 LLM provider 配置
2. **双接口抽象** — OpenAI 兼容格式 (`/v1/chat/completions`) + Anthropic 原生格式 (Messages API)
3. **默认 provider** — 多个配置中指定一个为默认，无指定时自动使用
4. **Per-conversation 选择** — Composer 底部 ModelSelector 下拉可选当前会话使用的 LLM
5. **无配置时引导** — 未配置任何 LLM 时，Composer 发送消息 → Conversation 中展示提示卡片，点击跳转到 LLM Settings
6. **连通性测试** — 每个 provider 配置可手动触发连通性验证
7. **Token 用量统计** — 每次 LLM 调用记录 input/output tokens（明细），按天/模型提供汇总查询
8. **Settings 独立页面** — 新建 LLM Providers 设置 section

### Out of scope

- LLM 供应商自动发现 / marketplace
- 负载均衡 / 故障转移（多个 provider 间的 fallback）
- API key 共享 / 团队管理
- 用量限额 / 预算告警
- 本地模型 (Ollama/LM Studio) 的直接集成（可通过 OpenAI 兼容 endpoint 间接支持）
- 与 AttaCloud 的 LLM 代理服务对接（后续）

### 依赖

- 现有 `LLMProvider` 接口 + `LLMProviderRegistry`（需重构）
- 现有 `safeStorage` API key 加密存储（`secrets.ts`，需扩展）
- 现有 `ModelSelector` 组件（当前为静态占位，需改造）
- 现有 `Settings` 框架（`SettingsSidebar` + `settingsAtom`）

### 涉及面板

| 面板 | 改动 |
|---|---|
| Settings | 新增 LLM Providers section（独立页面，与 General/Agent 平级） |
| Conversation/Composer | ModelSelector 从静态占位改为可用下拉，绑定当前会话 LLM |
| Conversation/MessageFlow | 无 LLM 配置时展示提示卡片 |
| Main Process | LLMProviderRegistry 重构为多实例管理，新增 OpenAI 兼容 provider |

---

## 用户场景

### 1. 首次使用 — 无配置引导

```
用户打开 AttaSeek → 进入 Chat → 在 Composer 输入问题 → 按 Enter
→ 系统检测无 LLM 配置
→ Conversation 中插入提示卡片："No LLM configured — Please set up a provider in Settings"
→ 卡片上有 "Open Settings" 按钮
→ 用户点击 → 跳转到 Settings → LLM Providers
→ 用户添加第一个 LLM → 测试连通性成功 → 设为默认
→ 返回 Chat → 重新发送 → 正常对话
```

### 2. 配置多个 LLM

```
用户进入 Settings → LLM Providers
→ 看到列表：当前已配置的 provider（名称 / 接口类型 / 默认标记 / 最近测试状态）
→ 点击 [+ Add Provider]
→ 弹出配置表单：
  - Name: "My DeepSeek"
  - Interface Type: [OpenAI Compatible ▼]
  - API Endpoint URL: "https://api.deepseek.com/v1"
  - API Key: [********] (点击可显示/隐藏)
  - Default Model: "deepseek-chat"
  - Extra Parameters: { "temperature": 0.7 }  (JSON textarea)
→ 点击 [Test Connection] → 显示 "Connected ✓ — model: deepseek-chat"
→ 点击 [Save] → 列表中出现新条目
→ 点击某条目的 ⭐ 图标 → 设为默认
```

### 3. 编辑/删除 LLM

```
LLM Providers 列表 → 点击某个条目 → 进入编辑模式（或展开详情）
→ 修改字段 → [Save] 或 [Delete]
→ 删除时如为默认 provider 且还有其他配置 → 提示选择新默认
→ 删除时如为唯一配置 → 允许删除（下次对话触发无配置引导）
```

### 4. Per-conversation 选择

```
用户在 Composer 底部看到 ModelSelector → 当前显示默认 LLM 名称和模型
→ 点击下拉 → 看到所有已配置的 LLM
  - ✅ My Claude (claude-sonnet-4-6) ← 默认标记
  -   My DeepSeek (deepseek-chat)
  -   Workplace GPT (gpt-4o)
→ 选择 "My DeepSeek" → 下拉关闭，显示 "My DeepSeek / deepseek-chat"
→ 发送消息 → 该会话使用 DeepSeek
→ 新建会话 → 恢复为默认 "My Claude"
```

### 5. 连通性测试

```
用户在 LLM Providers 页面 → 点击某个 provider 的 [Test] 按钮
→ 系统用配置的 endpoint + key + model 发送最小请求
→ 显示结果：
  成功: "✓ Connected — model: deepseek-chat, latency: 230ms"
  失败: "✗ Connection failed — 401 Unauthorized (check API key)"
  超时: "✗ Connection timed out after 10s"
```

### 6. Token 用量查询

```
用户进入 Settings → LLM Providers → 点击某个 provider → 查看 Usage 标签
→ 显示：
  Today:      input 12,340 | output 4,567 tokens
  This Week:  input 89,000 | output 34,200 tokens
  This Month: input 320,000 | output 145,000 tokens
→ 可展开查看每日明细图表 (后续版本)
```

---

## 边界条件

- **同名 provider**：不允许重名，保存时校验唯一性
- **无效 endpoint**：保存不校验连通性（仅 [Test] 按钮做），避免保存阻塞
- **API key 为空**：允许保存（部分本地模型不需要 key），但标注 "No API key"
- **默认 provider 被删除**：如仍有其他配置 → 自动选第一个为默认；如无 → 回到无配置状态
- **会话中切换 LLM**：切换后该会话后续消息使用新 LLM，已完成的消息不受影响
- **Provider 下线/不可用**：调用失败时在 Conversation 中展示错误卡片，不阻塞其他 provider

---

## 风险

| 风险 | 缓解 |
|---|---|
| OpenAI 兼容格式各有小差异（如 DeepSeek 不支持某些参数） | Extra Parameters 字段让用户自行调整差异 |
| Anthropic 原生格式与 OpenAI 格式的 tool calling 格式差异大 | 接口层分别处理 tool_use ↔ function_call 映射 |
| API key 存储安全 — 多 provider 多 key 管理 | 复用现有 safeStorage，按 provider id 加密存储 |
| Token 统计表写入频繁（每次 LLM 调用都写） | SQLite 同步写入延迟 <10ms（P95），可接受 |

---

## 数据模型（概念）

```
LLMProviderConfig:
  id: string
  name: string              # 用户命名 "My DeepSeek"
  interfaceType: enum       # 'openai_compatible' | 'anthropic'
  endpointUrl: string       # API base URL
  apiKey: string            # encrypted via safeStorage
  defaultModel: string      # 默认使用的模型名
  extraParams: json         # 额外参数 {"temperature": 0.7, "top_p": 0.9}
  isDefault: boolean        # 是否为默认 provider
  createdAt / updatedAt: timestamp

LLMTokenUsage:
  id: string
  providerConfigId: string  # FK → LLMProviderConfig
  sessionId / taskId
  model: string             # 实际使用的模型
  inputTokens / outputTokens: number
  createdAt: timestamp
```
