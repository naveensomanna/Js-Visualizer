import { ErrorState } from '../components/ErrorState'
import { PanelShell } from '../components/PanelShell'
import { getBindingBadgeClasses } from '../utils/analysis'
import type { ParseState, TdzZone } from '../types'

function getZoneTone(zone: TdzZone, lineNumber: number) {
  if (zone.accesses.includes(lineNumber)) {
    return 'violation'
  }

  if (lineNumber === zone.declarationLine) {
    return 'declaration'
  }

  if (lineNumber < zone.declarationLine) {
    return 'tdz'
  }

  return 'safe'
}

function getZoneLabel(zone: TdzZone, lineNumber: number) {
  if (zone.accesses.includes(lineNumber)) {
    return '💥 This line would throw ReferenceError'
  }

  if (lineNumber === zone.declarationLine) {
    return '✅ Declaration - TDZ ends here'
  }

  if (lineNumber < zone.declarationLine) {
    return '⚠️ TDZ - ReferenceError if accessed here'
  }

  return '✅ Safe to access'
}

function getZoneClasses(zone: TdzZone, lineNumber: number) {
  const tone = getZoneTone(zone, lineNumber)

  switch (tone) {
    case 'violation':
      return 'border-rose-400/45 bg-rose-500/18 text-rose-50'
    case 'declaration':
      return 'border-amber-400/40 bg-amber-400/14 text-amber-50'
    case 'tdz':
      return 'border-rose-400/20 bg-rose-500/8 text-rose-100/90'
    case 'safe':
      return 'border-emerald-400/20 bg-emerald-500/8 text-emerald-100/90'
    default:
      return 'border-slate-500/20 bg-slate-500/8 text-slate-200'
  }
}

function getRelevantLines(code: string, zone: TdzZone) {
  const lines = code.split('\n')
  return lines
    .slice(zone.startLine - 1, zone.endLine)
    .map((content, index) => ({
      number: zone.startLine + index,
      content,
    }))
}

export function TdzPanel({
  parsed,
  code,
  zones,
}: {
  parsed: ParseState
  code: string
  zones: TdzZone[]
}) {
  return (
    <PanelShell
      title="TDZ"
      description="Per-variable temporal dead zone view with declaration boundaries and actual violation lines."
    >
      {parsed.error || !parsed.ast ? (
        <ErrorState
          message={parsed.error ?? 'Fix the syntax error to inspect TDZ.'}
        />
      ) : (
        <div className="space-y-4">
          <div className="rounded-[1.35rem] border border-[#24324f] bg-[linear-gradient(180deg,rgba(11,18,33,0.94),rgba(8,14,26,0.98))] px-4 py-3">
            <p className="text-sm leading-6 text-slate-300">
              let and const are hoisted but not initialized. Accessing them before
              their declaration line throws a ReferenceError.
            </p>
          </div>
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
                      : '✅ No TDZ violations detected'}
                  </p>

                  <div className="mt-4 overflow-hidden rounded-[1.2rem] border border-[#24324f] bg-[#07111f]/90">
                    <div className="border-b border-[#24324f] px-4 py-3">
                      <p className="text-sm font-medium text-slate-100">
                        {zone.name} timeline
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Scope lines {zone.startLine}-{zone.endLine}
                      </p>
                    </div>
                    <div className="max-h-88 overflow-auto px-2 py-2 font-mono text-sm">
                      {getRelevantLines(code, zone).map((line) => (
                        <div
                          key={`${zone.name}-${line.number}`}
                          className={`mb-2 rounded-xl border px-3 py-2 ${getZoneClasses(zone, line.number)}`}
                        >
                          <div className="grid grid-cols-[3rem_minmax(0,1fr)] gap-3">
                            <span className="select-none text-right text-slate-400">
                              {line.number}
                            </span>
                            <span className="wrap-break-word whitespace-pre-wrap text-left">
                              {line.content || ' '}
                            </span>
                          </div>
                          <div className="mt-2 border-t border-white/8 pt-2 pl-15 text-xs font-medium tracking-[0.02em] text-current/90">
                            {getZoneLabel(zone, line.number)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
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
