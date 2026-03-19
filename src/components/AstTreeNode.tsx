import { useMemo, useState } from 'react'
import type { Node } from '@babel/types'
import type { AstChild } from '../types'
import { getAstChildren, getNodeLabel } from '../utils/analysis'

export function AstTreeNode({
  label,
  node,
  depth,
  selectedKey,
  onSelect,
}: {
  label: string
  node: Node
  depth: number
  selectedKey: string | null
  onSelect: (node: Node) => void
}) {
  const [expanded, setExpanded] = useState(depth < 1)
  const children = useMemo<AstChild[]>(() => getAstChildren(node), [node])
  const nodeKey = `${node.type}-${node.start}-${node.end}`
  const isSelected = selectedKey === nodeKey

  return (
    <div className="space-y-2">
      <div
        className={`rounded-2xl border px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] ${
          isSelected
            ? 'border-sky-300/40 bg-[linear-gradient(180deg,rgba(18,47,77,0.88),rgba(8,26,44,0.96))]'
            : 'border-[#24314a] bg-[linear-gradient(180deg,rgba(10,16,29,0.95),rgba(5,11,20,0.98))]'
        }`}
        style={{ marginLeft: `${depth * 14}px` }}
      >
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={() => onSelect(node)}
            className="text-left transition hover:opacity-100"
          >
            <p className="text-sm font-medium text-slate-100">{label}</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">{getNodeLabel(node)}</p>
          </button>
          {children.length > 0 ? (
            <button
              type="button"
              onClick={() => setExpanded((current) => !current)}
              className="rounded-full border border-[#32405f] bg-[#0d1627] px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-300 transition hover:border-sky-300/40 hover:text-white"
            >
              {expanded ? 'Collapse' : 'Expand'}
            </button>
          ) : null}
        </div>
      </div>
      {expanded ? (
        <div className="space-y-2">
          {children.map((child) => (
            <AstTreeNode
              key={`${nodeKey}-${child.key}`}
              label={child.key}
              node={child.node}
              depth={depth + 1}
              selectedKey={selectedKey}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
