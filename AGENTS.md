# AttaSeek

Agent 工作台桌面应用。视觉与功能以 Codex Desktop 为源头参考（Codex Desktop 同样构建于 Codex UI 框架之上）。

## 边界

- AttaSeek 是独立项目，**不要搜索更上级目录**（`/Users/xbits/Workspace/Atta/` 下的其他项目与本项目无关）
- 所有设计文档在 `docs/` 目录下
- 本项目不依赖 Atta monorepo 中的任何其他子项目

## 技术栈

| 层 | 选型 |
|---|------|
| 桌面框架 | **Electron** |
| 前端 | React 18 + TypeScript |
| 样式 | Tailwind CSS |
| 状态管理 | Jotai（轻量原子化，适合面板级状态隔离） |
| 持久化 | SQLite（better-sqlite3，会话 / 设置 / 缓存） + 文件系统（产物 Artifact） |
| 编辑器 | Monaco Editor（代码 / Diff 面板） |
| 终端 | xterm.js（集成终端面板） |
| 协议 | Atta Proto（与 Bridge / Cloud 通信，如需） |
| 插件 | MCP 协议，插件以独立子进程运行 |
| 打包 | electron-builder |
| 平台 | macOS / Windows / Linux 桌面优先 |

### 窗口配置

```jsonc
// Electron BrowserWindow 关键配置
{
  titleBarStyle: "hiddenInset",  // macOS: 标题栏与侧边栏融合，traffic lights 嵌入侧边栏顶部
  titleBarOverlay: true,         // Windows/Linux: 窗口控制按钮叠加在侧边栏区域
  frame: true,                   // 保留原生窗口边框
  vibrancy: "sidebar",           // macOS: 侧边栏区域使用半透明毛玻璃效果
}
```

## 项目结构（规划）

```
AttaSeek/
├── AGENTS.md
├── docs/
│   └── ui.md                    # UI/UX 设计规格
├── package.json
├── electron-builder.yml
├── tsconfig.json
├── tailwind.config.ts
├── src/
│   ├── main/                    # Electron 主进程
│   │   ├── index.ts             # BrowserWindow 创建、窗口管理
│   │   ├── ipc/                 # IPC 处理：文件系统、终端、MCP、Bridge
│   │   └── store/               # SQLite 持久化
│   ├── preload/                 # contextBridge 暴露的安全 API
│   │   └── index.ts
│   └── renderer/                # React 渲染进程
│       ├── App.tsx              # 根组件：Activity Bar + Main Canvas 布局
│       ├── layouts/
│       │   └── Shell.tsx        # 整体 Shell 布局（titlebar + sidebar + canvas）
│       ├── components/
│       │   ├── ActivityBar/     # 48px 左轨导航
│       │   ├── TitleBar/        # Sidebar 区域标题栏（traffic lights 区域）
│       │   ├── Sidebar/         # 上下文面板（260px，内容随 Activity 切换）
│       │   ├── Conversation/    # Agent 对话面板
│       │   │   ├── SessionHeader.tsx    # 会话标题栏（内联）
│       │   │   ├── MessageFlow.tsx      # 消息流
│       │   │   ├── AgentStatusBar.tsx   # AI 输出区状态指示器
│       │   │   ├── ToolCallCard.tsx     # 工具调用卡片（可折叠，带撤销按钮）
│       │   │   ├── PermissionInline.tsx # 权限确认内联
│       │   │   └── Composer.tsx         # 输入区
│       │   ├── Artifact/        # 产物面板
│       │   ├── Terminal/        # 集成终端
│       │   └── Diff/            # Diff 查看器
│       └── panels/              # 可拖拽面板系统
├── resources/                   # 图标、字体等静态资源
└── test/
```

## 本地开发

```sh
# 安装依赖
npm install

# 开发模式（Vite HMR + Electron）
npm run dev

# 构建
npm run build

# 打包为桌面应用
npm run package
```

## 设计参考

- **源头参考**：Codex Desktop（OpenAI）—— Session Header、权限模式、工具调用卡片、上下文指示器
- **扩展参考**：Codex Desktop（Anthropic）—— 可拖拽面板系统、Side Chat、多会话管理、Diff 审查
- 详细 UI 规格见 `docs/ui.md`

## 代码风格

- TypeScript 严格模式，ESLint + Prettier
- React 函数组件 + Hooks，无 class 组件
- IPC 通信：主进程暴露 API 经 contextBridge，渲染进程不直接访问 Node.js
- CSS：Tailwind 原子类为主，必要时 `components/` 层提取复用样式
