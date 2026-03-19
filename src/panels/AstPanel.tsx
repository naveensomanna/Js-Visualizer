import type { Node } from '@babel/types'
import { AstTreeNode } from '../components/AstTreeNode'
import { ErrorState } from '../components/ErrorState'
import { PanelShell } from '../components/PanelShell'
import type { ParseState } from '../types'

export function AstPanel({
  parsed,
  selectedAstKey,
  onSelect,
}: {
  parsed: ParseState
  selectedAstKey: string | null
  onSelect: (node: Node) => void
}) {
  return (
    <PanelShell
      title="AST tree"
      description="Browse the parsed syntax tree and jump back to code."
    >
      {parsed.error || !parsed.ast ? (
        <ErrorState
          message={parsed.error ?? 'Fix the syntax error to inspect the AST.'}
        />
      ) : (
        <div className="space-y-4">
          <div className="rounded-[1.35rem] border border-[#24324f] bg-[linear-gradient(180deg,rgba(11,18,33,0.94),rgba(8,14,26,0.98))] px-4 py-3">
            <p className="text-xs leading-6 text-slate-400">
              Expand nodes to inspect structure. Click any node to highlight its
              matching location in the editor.
            </p>
          </div>
          <div className="overflow-auto rounded-[1.5rem] border border-[#24324f] bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.08),transparent_30%),linear-gradient(180deg,rgba(8,14,26,0.96),rgba(5,10,20,0.99))] p-4">
            <div className="min-w-[640px] rounded-[1.4rem] border border-white/5 bg-black/10 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <AstTreeNode
                label="root"
                node={parsed.ast.program}
                depth={0}
                selectedKey={selectedAstKey}
                onSelect={onSelect}
              />
            </div>
          </div>
        </div>
      )}
    </PanelShell>
  )
}
