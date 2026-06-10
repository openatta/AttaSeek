/**
 * Artifact content tab atoms — manage tabs that display agent-produced
 * artifacts (Markdown, Code, SVG, Table, Diff, etc.) inside the AP.
 *
 * ===== 两套 Tab 系统的职责边界 =====
 *
 *  outputTabsAtom / OutputTab  →  artifact 内容显示
 *    - 类型基于 ArtifactType（markdown/code/svg/table/diff 等）
 *    - 由 InlineArtifactPreview 创建（agent 产出内容卡片点击）
 *    - useArtifactActivitySwitch 跨 Activity 保存/恢复
 *    - 未来可能被新 Artifact Panel 替代，但目前是活跃的功能代码
 *
 *  apTabsAtom / ApTab          →  Pane 工具面板
 *    - 类型基于 PaneType（browser/terminal/file/review）
 *    - 定义在 src/renderer/components/Artifact/ApAtoms.ts
 *    - 由 ApEmptyState / ApTabBar [+] 菜单创建
 *    - 这是 AP 面板的主体 Tab 系统
 *
 * ===== 可见性/全屏原子 =====
 *
 *  outputAreaVisibleAtom → 规范原子 apVisibleAtom, 定义在 ApAtoms.ts
 *  outputFullscreenAtom  → 规范原子 apFullscreenAtom, 定义在 ApAtoms.ts
 *  这两个是 SAME atom 实例（re-export），读取一个等于读取另一个。
 */

import { atom } from 'jotai'
import type { ArtifactType } from '../../shared/types/Artifact'
import {
  apVisibleAtom,
  apFullscreenAtom,
} from '../components/Artifact/ApAtoms'

/** Artifact content tab type — extends ArtifactType with 'review' */
export type OutputTabType = ArtifactType | 'review'

/** A tab in the artifact content area (not a Pane tool tab) */
export interface OutputTab {
  id: string
  type: OutputTabType
  label: string
}

/** Open artifact content tabs (rendered by legacy ArtifactPane, now handled inline) */
export const outputTabsAtom = atom<OutputTab[]>([])

/** Active artifact content tab ID */
export const activeOutputTabAtom = atom<string | null>(null)

// ── Visibility / fullscreen atoms ──
// Re-export the canonical atoms from ApAtoms under their legacy names.
// These are the SAME atom instances — reading from one writes the other.

/** AP panel visibility — canonical atom is apVisibleAtom in ApAtoms.ts */
export const outputAreaVisibleAtom = apVisibleAtom

/** AP panel fullscreen mode — canonical atom is apFullscreenAtom in ApAtoms.ts */
export const outputFullscreenAtom = apFullscreenAtom
