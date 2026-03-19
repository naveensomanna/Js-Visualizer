import { CodePane } from '../components/CodePane'
import { ErrorState } from '../components/ErrorState'
import { PanelShell } from '../components/PanelShell'
import type { CodeLine, ParseState } from '../types'

export function HoistingPanel({
  parsed,
  originalHoistLines,
  transformedHoistLines,
  notes,
}: {
  parsed: ParseState
  originalHoistLines: CodeLine[]
  transformedHoistLines: CodeLine[]
  notes: string[]
}) {
  return (
    <PanelShell
      title="Hoisting preview"
      description="Compare source order with a simplified hoisted view."
    >
      {parsed.error || !parsed.ast ? (
        <ErrorState
          message={parsed.error ?? 'Fix the syntax error to inspect hoisting.'}
        />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <CodePane
              title="Source"
              subtitle="Original order with hoisted declarations highlighted."
              lines={originalHoistLines}
            />
            <CodePane
              title="Hoisted view"
              subtitle="Functions move first. `var` bindings exist early as `undefined`."
              lines={transformedHoistLines}
            />
          </div>
          {notes.length > 0 ? (
            <div className="rounded-[1.2rem] border border-[#24324f] bg-[linear-gradient(180deg,rgba(11,18,33,0.94),rgba(8,14,26,0.98))] p-3 sm:rounded-[1.35rem] sm:p-4">
              <p className="text-[11px] uppercase tracking-[0.26em] text-slate-400">
                Notes
              </p>
              <div className="mt-3 space-y-2 text-sm text-slate-300">
                {notes.map((note) => (
                  <p key={note}>{note}</p>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </PanelShell>
  )
}
