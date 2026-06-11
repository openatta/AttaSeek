# AP 文件面板优化 架构设计

**日期：** 2026-06-11
**基于需求：** `docs/reqs/2026-06-11-ap-file-pane-overhaul.md`

---

## 1. 组件结构

| 组件 | 新建/修改 | 职责 |
|------|----------|------|
| `src/renderer/components/Artifact/panes/FilePane/FileSubHeader.tsx` | **删除** | 路径栏+展开按钮，不再需要 |
| `src/renderer/components/Artifact/panes/FilePane/FilePane.tsx` | **重写** | 布局改为 TAB-bar-on-top + 查看区 + 右侧文件树；单实例约束下内部 TAB 管理 |
| `src/renderer/components/Artifact/panes/FilePane/FilePreviewArea.tsx` | **重写** | 取消 Markdown 双模式；统一查看器路由：Monaco(代码) / Image(图片) / PDF / HEX(二进制)；Monaco 文件扩展覆盖所有编程语言 |
| `src/renderer/components/Artifact/panes/FilePane/FileExplorer.tsx` | 不变 | 虚拟化文件树，无需改动 |
| `src/renderer/utils/languageMap.ts` | **扩展** | 从 18 个扩展 → 60+ 扩展，覆盖所有常见编程语言和配置格式 |
| `src/shared/types/mime.ts` | **扩展** | 补充缺失的 MIME 类型映射（.swift/.kt/.dart/.lua/.r 等） |
| `src/renderer/components/Artifact/ApAtoms.ts` | **修改** | 新增 `fileInstanceAtom`、`reviewInstanceAtom`（单实例 guard） |
| `src/renderer/components/Artifact/ApContainer.tsx` | **修改** | 扩展 single-instance sync effect 到 file + review |
| `src/renderer/hooks/useAvailablePanes.ts` | **修改** | 泛化 singleInstance 过滤（不再硬编码 browser），file/review 也受单实例约束 |
| `src/renderer/registries/init.ts` | **修改** | file/review 的 `singleInstance` 改为 `true` |

---

## 2. 布局设计

### 2.1 目标布局

```
┌─ FilePane ── [utils.ts] [api.ts] [Dockerfile] [+] ── [☰] ─┐  ← AP TabBar (40px) — 这里显示文件内部 TAB
│                                                           │
│  ┌─────────────────────────────────────┐ ┌──────────────┐ │
│  │                                     │ │  FileExplorer │ │
│  │        统一查看器区域               │ │  (240px)     │ │
│  │   Monaco / Image / PDF / HEX        │ │  [☰ 开/关]   │ │
│  │                                     │ │              │ │
│  │                                     │ │              │ │
│  └─────────────────────────────────────┘ └──────────────┘ │
└───────────────────────────────────────────────────────────┘
```

**关键变更：**
- **`FileSubHeader` 删除**。原来路径栏占的 28px 区域不再存在。
- **文件内部 TAB 上移到 AP TabBar 层**。原先 `FilePreviewArea` 内部的二级 TAB 栏（28px）融入到 AP 面板的 TabBar（40px）中。文件面板不再是"面板内嵌 TAB"，而是每个打开的文件对应一个 AP 级 TAB。
- **右侧文件树保留**。展开/收缩按钮移到 AP TabBar 右侧（`[☰]` 图标）。
- 这与浏览器/终端/审查面板的布局一致（都是内容区全高，无二级 header）。

### 2.2 文件 TAB 策略变更

**变更前：** 文件面板内部有自己的 `openTabs` 状态和内部 TAB 栏。文件面板本身在 AP TabBar 中只占一个 TAB（"文件"）。

**变更后：** 每个打开的文件在 AP 级别创建一个 TAB（如 `utils.ts`、`api.ts`）。文件面板变为 AP 级的单实例容器——当用户点击第二个文件时，添加新的 AP TAB 而非文件内部 TAB。这使文件 TAB 与浏览器/终端/审查 TAB 处于同一层级。

| 行为 | 变更前 | 变更后 |
|------|--------|--------|
| 打开文件 | 文件面板内新增内部 TAB | AP TabBar 新增 TAB（`paneType='file'`, `label=文件名`） |
| 文件 TAB 位置 | 文件面板内部 28px 栏 | AP TabBar (40px)，与浏览器/终端同级 |
| 关闭文件 | 关闭内部 TAB | 关闭 AP TAB |
| 文件面板实例数 | 可多个 | 最多 1 个（单实例约束） |
| 重复文件 | 激活已有内部 TAB | 激活已有 AP TAB（匹配 `label` 或 `apTabId`） |

**设计理由：** 这与 Codex Desktop 的文件 TAB 行为一致——打开文件=创建 AP 级 TAB。用户不需要理解"面板内 TAB"和"AP 级 TAB"两层概念。

---

## 3. 数据模型

### 3.1 AP TAB 扩展

```typescript
// ApAtoms.ts — ApTab 不变，仅通过 label 和内部状态区分文件
interface ApTab {
  id: string          // 文件 TAB 的 id = `file-${filePath}` (稳定的去重 key)
  paneType: PaneType  // 'file'
  label: string       // 文件名（如 "utils.ts"）
}
```

### 3.2 新增 Atom

```typescript
// ApAtoms.ts — 新增
export const fileInstanceAtom = atom(false)
export const reviewInstanceAtom = atom(false)
```

### 3.3 文件 TAB 元数据（组件本地）

```typescript
// FilePane.tsx — 内部维护
interface FileTabMeta {
  filePath: string      // 文件绝对路径
  mime?: string         // MIME 类型
}
// 用 Map<string, FileTabMeta> keyed by apTabId
```

---

## 4. 数据流

### 4.1 打开文件

```
FileExplorer.onFileClick(filePath)
  → 检查 apTabsAtom 是否存在 paneType='file' && label === fileName
  → 已存在 → setActiveApTab(existingTab.id)
  → 不存在 →
      addApTab({ paneType: 'file', label: fileName })  ← 复用 useAddTab，但需改为支持自定义 label
      → apTabsAtom 更新
      → ApContainer 渲染 FilePane(newTab)
      → FilePane 从 apTabsAtom 获取所有 file 类型 TAB
      → FilePane 内部维护 filePath→apTabId 映射
      → FilePreviewArea 读取 filePath 并加载内容
```

### 4.2 关闭文件

```
ApTabBar 上的 × 按钮
  → closeApTab(tabId)
  → 如果关闭的是最后一个 file 类型 TAB → fileInstanceAtom = false
  → apTabsAtom 移除该 TAB
  → FilePane 检测 TAB 变化，清理内部状态
```

### 4.3 单实例约束

```
useAvailablePanes() 过滤逻辑（泛化）:
  if pane.constraints.singleInstance:
    if pane.type === 'file' && fileInstanceAtom → 过滤掉
    if pane.type === 'browser' && browserInstanceAtom → 过滤掉
    if pane.type === 'review' && reviewInstanceAtom → 过滤掉

ApContainer useEffect（新增强同步）:
  fileInstanceAtom = apTabsAtom.some(t => t.paneType === 'file')
  reviewInstanceAtom = apTabsAtom.some(t => t.paneType === 'review')
  browserInstanceAtom = apTabsAtom.some(t => t.paneType === 'browser')  // 已有
```

### 4.4 查看器路由（统一模式）

```
FilePreviewArea 接收 filePath + mime
  → mime.startsWith('image/') → <ImageViewer>
  → mime === 'application/pdf' → <PdfViewer>
  → isBinary(mime) → <HexViewer>
  → 默认 → <MonacoEditor language={languageFromPath(path)}>
```

没有 Markdown 特殊处理。Markdown 文件通过 Monaco 打开（`language='markdown'`），语法高亮正常工作。

---

## 5. IPC Contract

无需新增 IPC 通道。全部复用已有：

| Channel | 用途 |
|---------|------|
| `fs:read-file` | 读取文件内容（已有） |
| `fs:file-info` | 判断文件类型/MIME（已有） |
| `fs:read-dir` | FileExplorer 目录列表（已有） |

---

## 6. Monaco 语言配置扩展

### 6.1 `languageMap.ts` 扩展清单

当前 18 个扩展 → 扩展到 60+:

```typescript
// 新增编程语言
swift: 'swift', kotlin: 'kotlin', dart: 'dart',
ruby: 'ruby', php: 'php', lua: 'lua', r: 'r',
cs: 'csharp', scala: 'scala', kt: 'kotlin', kts: 'kotlin',
mjs: 'javascript', cjs: 'javascript',
pyw: 'python', pyi: 'python', cxx: 'cpp', cc: 'cpp', hpp: 'cpp',

// 新增配置/数据
jsonc: 'json', csv: 'plaintext', ini: 'ini', cfg: 'ini',
env: 'ini', scss: 'scss', less: 'less', svg: 'xml',
mdx: 'markdown', diff: 'diff', patch: 'diff',
zsh: 'shell', fish: 'shell', dockerfile: 'dockerfile',
makefile: 'makefile',

// 键名（无扩展名文件自动检测）
// Dockerfile, Makefile, LICENSE 等通过文件名匹配
```

### 6.2 文件名推断（新增）

```typescript
// languageMap.ts — 新增函数
function languageFromFilename(name: string): string | undefined {
  const upper = name.toUpperCase()
  if (upper === 'DOCKERFILE') return 'dockerfile'
  if (upper === 'MAKEFILE') return 'makefile'
  if (upper === 'LICENSE') return 'plaintext'
  if (upper === 'VAGRANTFILE') return 'ruby'
  // ...
}
```

---

## 7. HEX 查看器

### 7.1 组件

新建 `src/renderer/components/Artifact/panes/FilePane/HexViewer.tsx`

- Props: `{ filePath: string }`
- 从 `api.fs.readFile` 读取文件内容（二进制 → Uint8Array 需 IPC 支持）
- 布局：三列（偏移 | HEX 值 | ASCII）
- 虚拟滚动（大文件兼容）
- 每行 16 字节

### 7.2 IPC 需求

当前 `fs:read-file` 返回 `{ content: string }`（UTF-8 文本）。HEX 查看需要二进制内容。两种方案：

| 方案 | 描述 |
|------|------|
| A | 新增 `fs:read-file` 参数 `encoding?: 'utf-8' | 'base64'`，base64 返回可在前端解码为 Uint8Array |
| B | 保持 `content: string`，前端用 `TextEncoder/TextDecoder` 处理（不可靠，非 UTF-8 文件会损坏） |

**选择方案 A**。`fs:read-file` 响应新增可选 `encoding` 字段，调用方传入 `encoding: 'base64'` 时返回 base64 编码内容。

---

## 8. 技术决策

| 决策 | 选择 | 理由 | 替代方案 |
|------|------|------|---------|
| 文件 TAB 层级 | 文件→AP 级 TAB（每个文件一个 AP TAB） | 与 Codex Desktop 一致；消除"面板内 TAB"和"AP TAB"双层概念；统一关闭/切换交互 | 保持内部 TAB（双层不一致，[+] 菜单和 TAB 栏行为不统一） |
| 单实例约束机制 | 泛化 `useAvailablePanes` 的 `singleInstance` 检查，新增 `fileInstanceAtom` / `reviewInstanceAtom` | 复用浏览器已有的约束模式（atom + useEffect 同步） | 在 `useAddTab` 中强制拦截（但渲染侧也需要知道"是否已有实例"来过滤菜单） |
| Markdown 查看 | 取消预览/源双模式，统一用 Monaco（`language='markdown'`） | 需求明确要求；Monaco 对 Markdown 的语法高亮足够清晰；减少 UI 复杂度 | 保留 Markdown 渲染预览（与需求冲突） |
| HEX 查看 | `fs:read-file` 新增 `encoding: 'base64'` 参数 | 最小 IPC 改动；前端用 `atob` + `Uint8Array` 解码 | 新增独立 `fs:read-raw` 通道（过度设计） |
| PDF 查看 | 保留现有 `<embed src="file://...">` 方案 | 无需额外依赖；Chrome 内置 PDF 查看器功能完整 | PDF.js（+2MB 包体积） |
| SVG 渲染安全 | 用 `<img src="file://...">` 而非 inline SVG | 避免 XSS（`<script>` 不执行） | sandbox iframe（复杂，对本地文件 `file://` 有 CSP 问题） |
| 文件 TAB ID | `file-${filePath}`（稳定，可去重） | 同一文件重复点击→激活已有 TAB 而非创建新 TAB | 随机 ID（无法去重） |

---

## 9. 受影响的测试

| 测试文件 | 影响 | 需要做什么 |
|---------|------|-----------|
| `e2e/tests/ap-file-pane-full.spec.ts` | TAB 行为变了（AP 级 vs 内部） | 重写 TAB 相关断言 |
| `e2e/tests/ap-panes.spec.ts` | 单实例约束变了 | 更新 gating 断言 |
| `e2e/tests/ap-layout.spec.ts` | 文件面板不再有 subheader | 更新高度/元素断言 |
| `e2e/tests/project-system.spec.ts` | P6/P7 引用文件面板 | 可能需要更新选择器 |

---

## 10. 文件清单

```
修改:
  src/renderer/components/Artifact/ApAtoms.ts              (+2 atoms)
  src/renderer/components/Artifact/ApContainer.tsx          (+file/review sync)
  src/renderer/components/Artifact/ApTabBar.tsx             (TAB 显示文件名)
  src/renderer/hooks/useAvailablePanes.ts                   (泛化 singleInstance)
  src/renderer/hooks/useAddTab.ts                           (支持自定义 label)
  src/renderer/registries/init.ts                           (singleInstance=true)
  src/renderer/utils/languageMap.ts                         (18→60+ 扩展)
  src/shared/types/mime.ts                                  (补充 MIME 映射)
  src/main/ipc/filesystem.ts                               (fs:read-file 支持 encoding)

重写:
  src/renderer/components/Artifact/panes/FilePane/FilePane.tsx
  src/renderer/components/Artifact/panes/FilePane/FilePreviewArea.tsx

新建:
  src/renderer/components/Artifact/panes/FilePane/HexViewer.tsx

删除:
  src/renderer/components/Artifact/panes/FilePane/FileSubHeader.tsx
```
