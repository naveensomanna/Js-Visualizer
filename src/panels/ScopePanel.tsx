import { ErrorState } from '../components/ErrorState'
import { PanelShell } from '../components/PanelShell'
import { getBindingBadgeClasses } from '../utils/analysis'
import type { ParseState, ScopeInfo } from '../types'

function getVariableTooltip(
  variable: ScopeInfo['variables'][number],
  scope: ScopeInfo,
) {
  if (variable.kind === 'hoisted') {
    return `This is hoisted - available from line ${variable.availableFromLine}.`
  }

  if (variable.kind === 'var') {
    return `This is hoisted - available from line ${variable.availableFromLine}.`
  }

  if (variable.kind === 'let' || variable.kind === 'const') {
    return `This is in TDZ until line ${variable.tdzUntilLine ?? variable.declarationLine}. This is block scoped.`
  }

  return `Declared in ${scope.label}.`
}

function buildScopeTree(scopeReport: ScopeInfo[]) {
  const childrenByParent = new Map<string | undefined, ScopeInfo[]>()

  scopeReport.forEach((scope) => {
    const siblings = childrenByParent.get(scope.parentId) ?? []
    siblings.push(scope)
    childrenByParent.set(scope.parentId, siblings)
  })

  return childrenByParent
}

function ScopeNode({
  scope,
  childrenByParent,
  depth,
}: {
  scope: ScopeInfo
  childrenByParent: Map<string | undefined, ScopeInfo[]>
  depth: number
}) {
  const children = childrenByParent.get(scope.id) ?? []

  return (
    <div
      className="scope-box-appear relative"
      style={{ animationDelay: `${depth * 80}ms` }}
    >
      <div
        className={`relative overflow-visible rounded-[1.2rem] border p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:rounded-[1.45rem] sm:p-4 ${
          depth === 0
            ? 'border-slate-400/30 bg-[linear-gradient(180deg,rgba(39,45,57,0.78),rgba(15,19,27,0.98))]'
            : scope.label.startsWith('Function')
              ? 'border-fuchsia-400/24 bg-[linear-gradient(180deg,rgba(66,26,79,0.52),rgba(18,12,30,0.96))]'
              : 'border-sky-400/22 bg-[linear-gradient(180deg,rgba(17,42,74,0.44),rgba(8,16,29,0.96))]'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-white">{scope.label}</h4>
            <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-slate-400 sm:text-[11px] sm:tracking-[0.18em]">
              Lines {scope.startLine}-{scope.endLine}
            </p>
          </div>

          {depth > 0 ? (
            <div className="rounded-full border border-[#32405f] bg-[#0b1524] px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-slate-300 sm:px-3 sm:text-[11px] sm:tracking-[0.16em]">
              inner <span className="mx-1 text-amber-300">{'->'}</span> outer
            </div>
          ) : (
            <div className="rounded-full border border-[#32405f] bg-[#0b1524] px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-slate-300 sm:px-3 sm:text-[11px] sm:tracking-[0.16em]">
              outermost scope
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5 sm:mt-4 sm:gap-2">
          {scope.variables.length > 0 ? (
            scope.variables.map((variable) => (
              <div key={`${scope.id}-${variable.name}`} className="group relative">
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium sm:px-3 sm:text-xs ${getBindingBadgeClasses(variable.kind)}`}
                >
                  {variable.kind}: {variable.name}
                </span>
                <div className="pointer-events-none absolute left-0 top-full z-20 mt-2 w-64 rounded-2xl border border-[#32405f] bg-[#091323] p-3 text-xs leading-5 text-slate-200 opacity-0 shadow-[0_18px_40px_rgba(0,0,0,0.32)] transition-opacity duration-150 group-hover:opacity-100">
                  {getVariableTooltip(variable, scope)}
                </div>
              </div>
            ))
          ) : (
            <span className="text-sm text-slate-500">No bindings in this scope.</span>
          )}
        </div>

        {children.length > 0 ? (
          <div className="mt-4 space-y-3 border-l border-dashed border-slate-500/25 pl-3 sm:mt-5 sm:space-y-4 sm:pl-4">
            {children.map((child) => (
              <div key={child.id} className="relative">
                <div className="absolute top-6 -left-3 h-px w-3 bg-slate-500/35 sm:-left-4 sm:w-4" />
                <ScopeNode
                  scope={child}
                  childrenByParent={childrenByParent}
                  depth={depth + 1}
                />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

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
      description="Scopes are drawn as nested boxes so lookup flow is visible from inner scopes back to outer scopes."
    >
      {parsed.error || !parsed.ast ? (
        <ErrorState
          message={parsed.error ?? 'Fix the syntax error to inspect scope.'}
        />
      ) : (
        (() => {
          const childrenByParent = buildScopeTree(scopeReport)
          const rootScopes = childrenByParent.get(undefined) ?? []

          return (
            <div className="space-y-4">
              <div className="rounded-[1.2rem] border border-[#24324f] bg-[linear-gradient(180deg,rgba(11,18,33,0.94),rgba(8,14,26,0.98))] px-3 py-3 sm:rounded-[1.35rem] sm:px-4">
                <p className="text-xs leading-6 text-slate-400">
                  Follow the nesting to see where variables live. Inner scopes
                  resolve outward through the scope chain.
                </p>
              </div>

              <div className="space-y-4">
                {rootScopes.map((scope) => (
                  <ScopeNode
                    key={scope.id}
                    scope={scope}
                    childrenByParent={childrenByParent}
                    depth={0}
                  />
                ))}
              </div>
            </div>
          )
        })()
      )}
    </PanelShell>
  )
}
