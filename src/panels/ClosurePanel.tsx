import { CodePane } from '../components/CodePane'
import { ErrorState } from '../components/ErrorState'
import { PanelShell } from '../components/PanelShell'
import { getBindingBadgeClasses } from '../utils/analysis'
import type { ClosureInfo, CodeLine, ParseState } from '../types'

export function ClosurePanel({
  parsed,
  closureReport,
  activeClosure,
  closureLines,
  onSelect,
}: {
  parsed: ParseState
  closureReport: ClosureInfo[]
  activeClosure: ClosureInfo | null
  closureLines: CodeLine[]
  onSelect: (closure: ClosureInfo) => void
}) {
  return (
    <PanelShell
      title="Closure visualization"
      description="Nested functions that retain access to bindings from outer scopes."
    >
      {parsed.error || !parsed.ast ? (
        <ErrorState
          message={parsed.error ?? 'Fix the syntax error to inspect closures.'}
        />
      ) : closureReport.length === 0 ? (
        <p className="text-sm text-slate-400">
          No closures were detected in the current code.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[1.35rem] border border-[#24324f] bg-[linear-gradient(180deg,rgba(11,18,33,0.94),rgba(8,14,26,0.98))] p-4">
              <p className="text-[11px] uppercase tracking-[0.26em] text-slate-400">
                Closures
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-white">
                {closureReport.length}
              </p>
            </div>
            <div className="rounded-[1.35rem] border border-[#24324f] bg-[linear-gradient(180deg,rgba(11,18,33,0.94),rgba(8,14,26,0.98))] p-4">
              <p className="text-[11px] uppercase tracking-[0.26em] text-slate-400">
                Captured bindings
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-white">
                {closureReport.reduce(
                  (total, closure) => total + closure.captures.length,
                  0,
                )}
              </p>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
            <div className="rounded-[1.35rem] border border-[#24324f] bg-[linear-gradient(180deg,rgba(11,18,33,0.94),rgba(8,14,26,0.98))] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] uppercase tracking-[0.26em] text-slate-400">
                  Closure list
                </p>
                <p className="text-xs text-slate-500">
                  Select one to inspect captured values.
                </p>
              </div>

              <div className="mt-4 space-y-2">
                {closureReport.map((closure) => (
                  <button
                    key={closure.id}
                    type="button"
                    onClick={() => onSelect(closure)}
                    className={`w-full rounded-[1.1rem] border px-4 py-3 text-left transition ${
                      activeClosure?.id === closure.id
                        ? 'border-sky-300/40 bg-sky-400/10'
                        : 'border-[#2b3854] bg-[#091323] hover:border-amber-300/30 hover:bg-[#0c1729]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-slate-100">{closure.name}</p>
                      <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                        Line {closure.line}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-400">{closure.retention}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <CodePane
                title="Closure focus"
                subtitle="The selected closure is highlighted in source."
                lines={closureLines}
              />

              {activeClosure ? (
                <div className="rounded-[1.35rem] border border-[#24324f] bg-[linear-gradient(180deg,rgba(11,18,33,0.94),rgba(8,14,26,0.98))] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-100">
                        {activeClosure.name}
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        {activeClosure.retention}
                      </p>
                    </div>
                    <span className="rounded-full border border-[#32405f] bg-[#0b1524] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-400">
                      Lines {activeClosure.line}-{activeClosure.endLine}
                    </span>
                  </div>

                  <div className="mt-4 space-y-3">
                    {activeClosure.captures.map((capture) => (
                      <div
                        key={`${activeClosure.id}-${capture.name}`}
                        className="rounded-2xl border border-[#2b3854] bg-[#091323] px-4 py-3"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-medium ${getBindingBadgeClasses(capture.kind)}`}
                          >
                            {capture.kind}
                          </span>
                          <p className="text-sm font-medium text-slate-100">
                            {capture.name}
                          </p>
                        </div>
                        <p className="mt-2 text-sm text-slate-400">
                          Captured from {capture.sourceLabel} on line {capture.sourceLine}.
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </PanelShell>
  )
}
