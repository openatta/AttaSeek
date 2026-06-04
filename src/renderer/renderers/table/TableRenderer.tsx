/**
 * TableRenderer — renders JSON array data as an interactive table.
 * Content should be JSON: { columns: string[], rows: Record<string, unknown>[] }
 */

import { useMemo } from 'react'
import type { ArtifactRendererProps } from '../../registries/artifactRendererRegistry'

interface TableData {
  columns: string[]
  rows: Record<string, unknown>[]
}

function parseTableData(content: string): TableData | null {
  try {
    const data = JSON.parse(content)
    if (data && Array.isArray(data.columns) && Array.isArray(data.rows)) {
      return data as TableData
    }
    // Fallback: if content is a JSON array, treat each item as a row
    if (Array.isArray(data) && data.length > 0) {
      const columns = Object.keys(data[0])
      return { columns, rows: data }
    }
    return null
  } catch {
    return null
  }
}

export default function TableRenderer({ content, title }: ArtifactRendererProps) {
  const tableData = useMemo(() => parseTableData(content), [content])

  if (!tableData) {
    return (
      <div className="p-4 text-[var(--app-text-tertiary)]">
        <h2 className="text-lg font-semibold mb-3 text-[var(--app-text-primary)]">{title}</h2>
        <p>Invalid table data. Expected JSON with columns and rows.</p>
        <pre className="mt-2 text-xs whitespace-pre-wrap">{content}</pre>
      </div>
    )
  }

  return (
    <div className="p-4 h-full overflow-auto">
      <h2 className="text-lg font-semibold mb-3 text-[var(--app-text-primary)]">{title}</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-[var(--app-border)]">
              {tableData.columns.map((col) => (
                <th
                  key={col}
                  className="text-left px-3 py-2 text-[var(--app-text-secondary)] font-medium"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableData.rows.map((row, i) => (
              <tr key={i} className="border-b border-[var(--app-border)] hover:bg-[var(--app-bg-hover)]">
                {tableData.columns.map((col) => (
                  <td key={col} className="px-3 py-2 text-[var(--app-text-primary)]">
                    {String(row[col] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
