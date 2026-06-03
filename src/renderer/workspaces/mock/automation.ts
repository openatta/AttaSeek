export interface AutomationTask {
  id: string
  name: string
  description: string
  trigger: string
  triggerType: 'cron' | 'hook' | 'manual'
  status: 'running' | 'idle' | 'scheduled' | 'stopped'
  lastRun?: string
}

export const MOCK_TASKS: AutomationTask[] = [
  {
    id: 'task-1',
    name: 'Daily Backup',
    description: '备份 ~/Work 目录到 NAS 服务器，保留最近 7 天快照',
    trigger: 'Cron: 0 2 * * *',
    triggerType: 'cron',
    status: 'running',
    lastRun: '3m ago'
  },
  {
    id: 'task-2',
    name: 'Sync Repos',
    description: '自动同步所有 git 仓库，检测上游变化并 pull 最新代码',
    trigger: 'Hook: on file change',
    triggerType: 'hook',
    status: 'idle',
    lastRun: '12m ago'
  },
  {
    id: 'task-3',
    name: 'Report Generator',
    description: '生成项目周报，汇总 commit、issue 和 PR 变更',
    trigger: 'Manual trigger',
    triggerType: 'manual',
    status: 'stopped',
    lastRun: '2d ago'
  },
  {
    id: 'task-4',
    name: 'Clean Logs',
    description: '清理超过 30 天的日志文件，释放磁盘空间',
    trigger: 'Cron: 0 9 * * 1',
    triggerType: 'cron',
    status: 'scheduled'
  },
  {
    id: 'task-5',
    name: 'Health Check',
    description: '检查所有 Bridge 连接状态，异常时发通知',
    trigger: 'Cron: */30 * * * *',
    triggerType: 'cron',
    status: 'running',
    lastRun: '28m ago'
  }
]
