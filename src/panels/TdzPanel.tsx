import { CodePane } from '../components/CodePane'
import { ErrorState } from '../components/ErrorState'
import { PanelShell } from '../components/PanelShell'
import { getBindingBadgeClasses } from '../utils/analysis'
import type { CodeLine, ParseState, TdzZone } from '../types'

export function TdzPanel({
  parsed,
  tdzLines,
  zones,
}: {
  parsed: ParseState
  tdzLines: CodeLine[]
  zones: TdzZone[]
}) {
  return (
    <PanelShell
      title="TDZ"
      description="Lines marked in red are inside the temporal dead zone."
    >
      {parsed.error || !parsed.ast ? (
        <ErrorState
          message={parsed.error ?? 'Fix the syntax error to inspect TDZ.'}
        />
      ) : (
        <div className="space-y-4">
          <CodePane
            title="TDZ map"
            subtitle="Red lines are inside the TDZ. Amber lines contain the declaration."
            lines={tdzLines}
          />
          <div className="space-y-3">
            {zones.length > 0 ? (
              zones.map((zone) => (
                <div
                  key={`${zone.name}-${zone.declarationLine}`}
                  className="rounded-[1.35rem] border border-[#24324f] bg-[linear-gradient(180deg,rgba(11,18,33,0.94),rgba(8,14,26,0.98))] p-4"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${getBindingBadgeClasses(zone.kind)}`}
                    >
                      {zone.kind}
                    </span>
                    <h4 className="text-sm font-semibold text-white">{zone.name}</h4>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">
                    TDZ starts on line {zone.startLine} and ends right before line{' '}
                    {zone.declarationLine}.
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    {zone.accesses.length > 0
                      ? `ReferenceError risk on line${zone.accesses.length > 1 ? 's' : ''} ${zone.accesses.join(', ')}.`
                      : 'No reads before declaration were detected in this scope.'}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">No TDZ zones in the current code.</p>
            )}
          </div>
        </div>
      )}
    </PanelShell>
  )
}
