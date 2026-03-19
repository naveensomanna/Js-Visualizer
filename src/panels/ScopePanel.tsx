import { ErrorState } from '../components/ErrorState'
import { PanelShell } from '../components/PanelShell'
import { getBindingBadgeClasses } from '../utils/analysis'
import type { ParseState, ScopeInfo } from '../types'

export function ScopePanel({
  parsed,
  scopeReport,
}: {
  parsed: ParseState
  scopeReport: ScopeInfo[]
}) {
  return (
    <PanelShell
      title="Scope chain"
      description="Scopes ordered from outermost to innermost."
    >
      {parsed.error || !parsed.ast ? (
        <ErrorState
          message={parsed.error ?? 'Fix the syntax error to inspect scope.'}
        />
      ) : (
        <div className="space-y-4">
          {scopeReport.map((scope) => (
            <div
              key={scope.id}
              className="rounded-[1.35rem] border border-[#24324f] bg-[linear-gradient(180deg,rgba(11,18,33,0.94),rgba(8,14,26,0.98))] p-4"
              style={{ marginLeft: `${scope.depth * 18}px` }}
            >
              <div className="flex flex-wrap items-center gap-3">
                <h4 className="text-sm font-semibold text-white">{scope.label}</h4>
                <span className="rounded-full border border-[#32405f] bg-[#0b1524] px-2 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-400">
                  Lines {scope.startLine}-{scope.endLine}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {scope.variables.length > 0 ? (
                  scope.variables.map((variable) => (
                    <span
                      key={`${scope.id}-${variable.name}`}
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${getBindingBadgeClasses(variable.kind)}`}
                    >
                      {variable.kind}: {variable.name}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-slate-500">No bindings in this scope.</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </PanelShell>
  )
}
