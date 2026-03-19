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
        <div className="space-y-3">
          <AstTreeNode
            label="root"
            node={parsed.ast.program}
            depth={0}
            selectedKey={selectedAstKey}
            onSelect={onSelect}
          />
        </div>
      )}
    </PanelShell>
  )
}
