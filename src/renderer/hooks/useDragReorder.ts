/**
 * useDragReorder — generic hook for drag-to-reorder within a list.
 *
 * Uses native HTML5 Drag and Drop. Returns bindings to spread onto each
 * item's DOM element. Works with any item type via the `id` field.
 *
 * Usage:
 *   const { getDragProps, dragOverIndex } = useDragReorder(items, setItems)
 *   items.map((item, i) => (
 *     <div {...getDragProps(item.id, i)}>
 *       {item.label}
 *     </div>
 *   ))
 */

import { useState, useCallback } from 'react'

interface Identifiable {
  id: string
}

interface DragProps {
  draggable: true
  onDragStart: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDragEnter: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  onDragEnd: () => void
  style?: React.CSSProperties
}

export function useDragReorder<T extends Identifiable>(
  items: T[],
  setItems: (items: T[]) => void,
): {
  getDragProps: (id: string, index: number) => DragProps
  dragOverIndex: number | null
} {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const getDragProps = useCallback(
    (id: string, index: number): DragProps => ({
      draggable: true,
      onDragStart: (e: React.DragEvent) => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', id)
        setDragIndex(index)
      },
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
      },
      onDragEnter: (e: React.DragEvent) => {
        e.preventDefault()
        if (dragIndex !== null && dragIndex !== index) {
          setDragOverIndex(index)
        }
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault()
        if (dragIndex === null || dragIndex === index) return
        const reordered = [...items]
        const [moved] = reordered.splice(dragIndex, 1)
        const insertAt = index > dragIndex ? index - 1 : index
        reordered.splice(insertAt, 0, moved)
        setItems(reordered)
      },
      onDragEnd: () => {
        setDragIndex(null)
        setDragOverIndex(null)
      },
      style:
        dragOverIndex === index && dragIndex !== index
          ? { borderLeft: '2px solid var(--app-accent, #7c3aed)' }
          : undefined,
    }),
    [items, dragIndex, dragOverIndex, setItems],
  )

  return { getDragProps, dragOverIndex }
}
