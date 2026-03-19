import { CodePane } from '../components/CodePane'
import { ErrorState } from '../components/ErrorState'
import { PanelShell } from '../components/PanelShell'
import { getCallStackFrameClasses } from '../utils/analysis'
import type { CallStackReport, CodeLine, ParseState } from '../types'

export function CallStackPanel({
  parsed,
  callStackReport,
  activeCallStep,
  callStackLines,
  selectedCallStep,
  setSelectedCallStep,
}: {
  parsed: ParseState
  callStackReport: CallStackReport
  activeCallStep: CallStackReport['steps'][number] | null
  callStackLines: CodeLine[]
  selectedCallStep: number
  setSelectedCallStep: (index: number) => void
}) {
  return (
    <PanelShell
      title="Call stack"
      description="A simplified execution trace of function calls in the current source."
    >
      {parsed.error || !parsed.ast ? (
        <ErrorState
          message={parsed.error ?? 'Fix the syntax error to inspect the call stack.'}
        />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[1.35rem] border border-[#24324f] bg-[linear-gradient(180deg,rgba(11,18,33,0.94),rgba(8,14,26,0.98))] p-4">
              <p className="text-[11px] uppercase tracking-[0.26em] text-slate-400">
                Steps
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-white">
                {callStackReport.steps.length}
              </p>
            </div>
            <div className="rounded-[1.35rem] border border-[#24324f] bg-[linear-gradient(180deg,rgba(11,18,33,0.94),rgba(8,14,26,0.98))] p-4">
              <p className="text-[11px] uppercase tracking-[0.26em] text-slate-400">
                Max depth
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-white">
                {callStackReport.deepestStack.length}
              </p>
            </div>
          </div>

          {activeCallStep ? (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(280px,0.92fr)]">
              <CodePane
                title="Execution focus"
                subtitle="The selected step is highlighted in source."
                lines={callStackLines}
              />

              <div className="overflow-hidden rounded-[1.35rem] border border-[#24324f] bg-[#07111f]/95 shadow-[0_18px_50px_rgba(0,0,0,0.24)]">
                <div className="border-b border-[#24324f] bg-[linear-gradient(90deg,rgba(10,18,33,0.98),rgba(8,20,39,0.92))] px-4 py-3">
                  <p className="text-sm font-medium tracking-[0.02em] text-slate-100">
                    Active stack
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {activeCallStep.title} on line {activeCallStep.line}
                  </p>
                </div>
                <div className="space-y-3 p-4">
                  {[...activeCallStep.stack].reverse().map((frame) => (
                    <div
                      key={`${activeCallStep.id}-${frame.name}-${frame.line}-${frame.kind}`}
                      className={`rounded-[1.1rem] border px-4 py-3 ${getCallStackFrameClasses(frame.kind)}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium">{frame.name}</p>
                        <span className="text-[11px] uppercase tracking-[0.18em] opacity-75">
                          {frame.kind}
                        </span>
                      </div>
                      <p className="mt-1 text-xs opacity-75">Line {frame.line}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              No function calls were detected in the current code.
            </p>
          )}

          {callStackReport.steps.length > 0 ? (
            <div className="rounded-[1.35rem] border border-[#24324f] bg-[linear-gradient(180deg,rgba(11,18,33,0.94),rgba(8,14,26,0.98))] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] uppercase tracking-[0.26em] text-slate-400">
                  Execution timeline
                </p>
                <p className="text-xs text-slate-500">
                  Select a step to inspect its stack.
                </p>
              </div>

              <div className="mt-4 space-y-2">
                {callStackReport.steps.map((step, index) => (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setSelectedCallStep(index)}
                    className={`w-full rounded-[1.1rem] border px-4 py-3 text-left transition ${
                      selectedCallStep === index
                        ? 'border-sky-300/40 bg-sky-400/10'
                        : 'border-[#2b3854] bg-[#091323] hover:border-amber-300/30 hover:bg-[#0c1729]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-slate-100">{step.title}</p>
                      <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                        Line {step.line}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-400">{step.detail}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {callStackReport.notes.length > 0 ? (
            <div className="rounded-[1.35rem] border border-[#24324f] bg-[linear-gradient(180deg,rgba(11,18,33,0.94),rgba(8,14,26,0.98))] p-4">
              <p className="text-[11px] uppercase tracking-[0.26em] text-slate-400">
                Notes
              </p>
              <div className="mt-3 space-y-2 text-sm text-slate-300">
                {callStackReport.notes.map((note) => (
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
