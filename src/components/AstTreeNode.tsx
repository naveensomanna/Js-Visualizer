import { useMemo, useState } from 'react'
import type { Node } from '@babel/types'
import type { AstChild } from '../types'
import {
  getAstChildren,
  getAstNodeCategory,
  getAstNodeDetails,
} from '../utils/analysis'

function getAstNodeColors(node: Node, isSelected: boolean) {
  if (isSelected) {
    return 'border-sky-300/55 bg-[linear-gradient(180deg,rgba(20,56,90,0.96),rgba(8,28,47,0.98))] shadow-[0_0_0_1px_rgba(125,211,252,0.08)]'
  }

  switch (getAstNodeCategory(node)) {
    case 'program':
      return 'border-slate-400/25 bg-[linear-gradient(180deg,rgba(40,48,60,0.9),rgba(19,24,34,0.98))]'
    case 'declaration':
      return 'border-fuchsia-400/28 bg-[linear-gradient(180deg,rgba(74,28,91,0.9),rgba(31,14,42,0.98))]'
    case 'statement':
      return 'border-sky-400/28 bg-[linear-gradient(180deg,rgba(18,57,94,0.88),rgba(9,26,48,0.98))]'
    case 'expression':
      return 'border-emerald-400/28 bg-[linear-gradient(180deg,rgba(17,71,58,0.88),rgba(9,31,28,0.98))]'
    case 'identifier':
      return 'border-amber-300/30 bg-[linear-gradient(180deg,rgba(92,68,18,0.88),rgba(40,28,8,0.98))]'
    case 'literal':
      return 'border-orange-400/30 bg-[linear-gradient(180deg,rgba(97,47,18,0.88),rgba(43,20,8,0.98))]'
    default:
      return 'border-[#24314a] bg-[linear-gradient(180deg,rgba(10,16,29,0.95),rgba(5,11,20,0.98))]'
  }
}

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
  const details = useMemo(() => getAstNodeDetails(node), [node])
  const nodeKey = `${node.type}-${node.start}-${node.end}`
  const isSelected = selectedKey === nodeKey
  const hasChildren = children.length > 0
  const relationLabel = label === 'root' ? null : label
  const connectorColor = isSelected ? 'bg-sky-300/55' : 'bg-[#31405c]'

  return (
    <div className="relative">
      {depth > 0 ? (
        <>
          <div className={`absolute left-4 top-0 bottom-0 w-px ${connectorColor}`} />
          <div className={`absolute left-4 top-8 h-px w-5 ${connectorColor}`} />
        </>
      ) : null}

      <div className={`${depth > 0 ? 'pl-8' : ''}`}>
        <div
          className={`rounded-3xl border px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-300 ${getAstNodeColors(node, isSelected)}`}
        >
          <div className="flex items-start gap-3">
            {hasChildren ? (
              <button
                type="button"
                onClick={() => setExpanded((current) => !current)}
                className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/15 text-sm text-slate-100 transition hover:border-sky-300/40 hover:bg-sky-300/10"
                aria-label={expanded ? 'Collapse node' : 'Expand node'}
              >
                <span className={`transition-transform duration-300 ${expanded ? 'rotate-90' : ''}`}>
                  ▸
                </span>
              </button>
            ) : (
              <div className="mt-1 h-3 w-3 shrink-0 rounded-full border border-white/10 bg-white/12" />
            )}

            <button
              type="button"
              onClick={() => onSelect(node)}
              className="min-w-0 flex-1 text-left"
            >
              {relationLabel ? (
                <span className="inline-flex rounded-full border border-white/10 bg-black/15 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-200/85">
                  {relationLabel}
                </span>
              ) : null}
              <p className="mt-2 text-base font-semibold leading-6 text-white sm:text-lg">
                {node.type}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {details.length > 0 ? (
                  details.map((detail) => (
                    <span
                      key={`${nodeKey}-${detail}`}
                      className="rounded-full border border-white/10 bg-black/15 px-2.5 py-1 text-xs text-slate-100/85"
                    >
                      {detail}
                    </span>
                  ))
                ) : (
                  <span className="text-xs uppercase tracking-[0.18em] text-slate-200/65">
                    {hasChildren ? `${children.length} child nodes` : 'Leaf node'}
                  </span>
                )}
              </div>
            </button>
          </div>
        </div>
      </div>

      <div
        className={`grid transition-[grid-template-rows,opacity,margin] duration-300 ease-out ${
          hasChildren && expanded
            ? 'mt-3 grid-rows-[1fr] opacity-100'
            : 'mt-0 grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="space-y-3">
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
        </div>
      </div>
    </div>
  )
}
