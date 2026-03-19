import { useEffect, useMemo, useRef, useState } from 'react'
import Editor, { type Monaco } from '@monaco-editor/react'
import type { Node } from '@babel/types'
import type { editor as MonacoEditor } from 'monaco-editor'
import {
  DEFAULT_CODE,
  PIPELINE_STEPS,
  SAMPLE_SNIPPETS,
  TAB_ITEMS,
} from './constants'
import { AstPanel } from './panels/AstPanel'
import { CallStackPanel } from './panels/CallStackPanel'
import { ClosurePanel } from './panels/ClosurePanel'
import { HoistingPanel } from './panels/HoistingPanel'
import { ScopePanel } from './panels/ScopePanel'
import { TdzPanel } from './panels/TdzPanel'
import { TokensPanel } from './panels/TokensPanel'
import { useDebouncedValue } from './hooks/useDebouncedValue'
import type {
  ClosureInfo,
  EditorRange,
  LineTone,
  ShareState,
  TabId,
} from './types'
import {
  buildCallStackReport,
  buildClosureReport,
  buildHoistingView,
  buildScopeReport,
  buildTdzReport,
  toCodeLines,
} from './utils/analysis'
import { parseCode } from './utils/parser'
import { buildAppUrl, buildShareUrl, getInitialAppState } from './utils/share'

function App() {
  const initialState = useMemo(() => getInitialAppState(), [])

  const [code, setCode] = useState(initialState.code)
  const [selectedTab, setSelectedTab] = useState<TabId>(initialState.selectedTab)
  const [selectedSnippet, setSelectedSnippet] = useState(initialState.selectedSnippet)
  const [selectedAstKey, setSelectedAstKey] = useState<string | null>(null)
  const [selectedClosureId, setSelectedClosureId] = useState<string | null>(null)
  const [selectedCallStep, setSelectedCallStep] = useState(0)
  const [selectedRange, setSelectedRange] = useState<EditorRange | null>(null)
  const [shareState, setShareState] = useState<ShareState>('idle')
  const [showMobileDesktopHint, setShowMobileDesktopHint] = useState(true)

  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<Monaco | null>(null)
  const decorationsRef = useRef<string[]>([])

  const debouncedCode = useDebouncedValue(code, 300)
  const parsed = useMemo(() => parseCode(debouncedCode), [debouncedCode])
  const scopeReport = useMemo(() => buildScopeReport(parsed.ast), [parsed.ast])
  const closureReport = useMemo(() => buildClosureReport(parsed.ast), [parsed.ast])
  const hoistingView = useMemo(
    () => buildHoistingView(parsed.ast, debouncedCode),
    [debouncedCode, parsed.ast],
  )
  const tdzReport = useMemo(() => buildTdzReport(parsed.ast), [parsed.ast])
  const callStackReport = useMemo(
    () => buildCallStackReport(parsed.ast, debouncedCode),
    [debouncedCode, parsed.ast],
  )

  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) {
      return
    }

    decorationsRef.current = editorRef.current.deltaDecorations(
      decorationsRef.current,
      selectedRange
        ? [
            {
              range: new monacoRef.current.Range(
                selectedRange.startLineNumber,
                selectedRange.startColumn,
                selectedRange.endLineNumber,
                selectedRange.endColumn,
              ),
              options: {
                className: 'ast-selected-range',
                inlineClassName: 'ast-selected-inline',
              },
            },
          ]
        : [],
    )

    if (selectedRange) {
      editorRef.current.revealLineInCenter(selectedRange.startLineNumber)
      editorRef.current.setSelection(selectedRange)
    }
  }, [selectedRange])

  const originalHoistLines = useMemo(
    () => toCodeLines(debouncedCode, hoistingView.originalHighlights),
    [debouncedCode, hoistingView.originalHighlights],
  )
  const transformedHoistLines = useMemo(
    () =>
      hoistingView.transformedLines.map((line, index) => ({
        number: index + 1,
        content: line.content,
        tone: line.tone,
      })),
    [hoistingView.transformedLines],
  )
  const activeClosure =
    closureReport.find((closure) => closure.id === selectedClosureId) ??
    closureReport[0] ??
    null
  const closureHighlightedLines = useMemo(() => {
    const highlights = new Map<number, LineTone>()

    if (!activeClosure) {
      return highlights
    }

    for (let line = activeClosure.line; line <= activeClosure.endLine; line += 1) {
      highlights.set(line, line === activeClosure.line ? 'info' : 'default')
    }

    return highlights
  }, [activeClosure])
  const closureLines = useMemo(
    () => toCodeLines(debouncedCode, closureHighlightedLines),
    [closureHighlightedLines, debouncedCode],
  )
  const activeCallStep =
    callStackReport.steps[selectedCallStep] ?? callStackReport.steps[0] ?? null
  const callStackHighlightedLines = useMemo(() => {
    const highlights = new Map<number, LineTone>()

    if (activeCallStep) {
      highlights.set(activeCallStep.line, 'info')
    }

    return highlights
  }, [activeCallStep])
  const callStackLines = useMemo(
    () => toCodeLines(debouncedCode, callStackHighlightedLines),
    [callStackHighlightedLines, debouncedCode],
  )
  const shareUrl = useMemo(
    () => buildShareUrl(code, selectedTab, selectedSnippet),
    [code, selectedSnippet, selectedTab],
  )

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const nextUrl = buildAppUrl(selectedTab, selectedSnippet)
    if (!nextUrl) {
      return
    }

    window.history.replaceState(null, '', nextUrl)
  }, [selectedSnippet, selectedTab])

  useEffect(() => {
    if (shareState !== 'copied') {
      return
    }

    const timeoutId = window.setTimeout(() => setShareState('idle'), 1800)
    return () => window.clearTimeout(timeoutId)
  }, [shareState])

  useEffect(() => {
    if (selectedClosureId && closureReport.some((closure) => closure.id === selectedClosureId)) {
      return
    }

    setSelectedClosureId(closureReport[0]?.id ?? null)
  }, [closureReport, selectedClosureId])

  useEffect(() => {
    if (selectedTab !== 'closure' || !activeClosure) {
      return
    }

    setSelectedRange({
      startLineNumber: activeClosure.line,
      startColumn: 1,
      endLineNumber: activeClosure.endLine,
      endColumn: 999,
    })
  }, [activeClosure, selectedTab])

  useEffect(() => {
    setSelectedCallStep(0)
  }, [debouncedCode])

  useEffect(() => {
    if (selectedCallStep < callStackReport.steps.length) {
      return
    }

    setSelectedCallStep(0)
  }, [callStackReport.steps.length, selectedCallStep])

  const handleSnippetChange = (value: string) => {
    setSelectedSnippet(value)

    if (!value) {
      return
    }

    const snippet = SAMPLE_SNIPPETS.find((item) => item.label === value)
    if (snippet) {
      setCode(snippet.code)
      setSelectedAstKey(null)
      setSelectedClosureId(null)
      setSelectedCallStep(0)
      setSelectedRange(null)
    }
  }

  const handleAstNodeSelect = (node: Node) => {
    setSelectedAstKey(`${node.type}-${node.start}-${node.end}`)

    if (!node.loc) {
      setSelectedRange(null)
      return
    }

    setSelectedRange({
      startLineNumber: node.loc.start.line,
      startColumn: node.loc.start.column + 1,
      endLineNumber: node.loc.end.line,
      endColumn: node.loc.end.column + 1,
    })
  }

  const handleClosureSelect = (closure: ClosureInfo) => {
    setSelectedClosureId(closure.id)
    setSelectedRange({
      startLineNumber: closure.line,
      startColumn: 1,
      endLineNumber: closure.endLine,
      endColumn: 999,
    })
  }

  const handleCopyShareLink = async () => {
    if (!shareUrl || !navigator.clipboard?.writeText) {
      setShareState('error')
      return
    }

    try {
      await navigator.clipboard.writeText(shareUrl)
      setShareState('copied')
    } catch {
      setShareState('error')
    }
  }

  const activePipelineStepId =
    PIPELINE_STEPS.find((step) => step.stageTabs.includes(selectedTab))?.id ?? null

  const handlePipelineStepClick = (
    step: (typeof PIPELINE_STEPS)[number],
  ) => {
    if (step.id === 'source') {
      editorRef.current?.focus()
      return
    }

    if (step.targetTab) {
      setSelectedTab(step.targetTab)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#040814] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.14),transparent_28%),radial-gradient(circle_at_78%_16%,rgba(251,191,36,0.12),transparent_20%),linear-gradient(180deg,rgba(4,8,20,0.92),rgba(2,6,16,1))]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(96,165,250,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(96,165,250,0.08)_1px,transparent_1px)] bg-size-[72px_72px] opacity-40" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-[1600px] flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="relative overflow-hidden rounded-[1.9rem] border border-[#22314d] bg-[linear-gradient(135deg,rgba(9,16,30,0.95),rgba(6,11,22,0.98))] px-4 py-5 shadow-[0_30px_80px_rgba(0,0,0,0.34)] sm:rounded-4xl sm:px-6 sm:py-6">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(125,211,252,0.7),rgba(251,191,36,0.55),transparent)]" />
          <div className="pointer-events-none absolute -right-16 top-8 h-40 w-40 rounded-full bg-amber-300/10 blur-3xl" />
          <div className="pointer-events-none absolute left-8 top-0 h-28 w-28 rounded-full bg-sky-300/10 blur-3xl" />
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.42em] text-sky-200/75">
                JavaScript internals
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
                JS Visualizer
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">
                Inspect tokenization, AST structure, scope, hoisting, and TDZ in
                one live workspace.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
              <label className="block">
                <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.26em] text-slate-400">
                  Examples
                </span>
                <select
                  value={selectedSnippet}
                  onChange={(event) => handleSnippetChange(event.target.value)}
                  className="w-full rounded-[1.25rem] border border-[#31405e] bg-[#08111f] px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-sky-300/60 focus:bg-[#0b1728]"
                >
                  <option value="">Choose an example...</option>
                  {SAMPLE_SNIPPETS.map((snippet) => (
                    <option key={snippet.label} value={snippet.label}>
                      {snippet.label}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                onClick={() => void handleCopyShareLink()}
                className={`self-end rounded-[1.25rem] border px-4 py-3 text-sm font-medium transition ${
                  shareState === 'copied'
                    ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200'
                    : shareState === 'error'
                      ? 'border-rose-400/35 bg-rose-400/10 text-rose-200'
                      : 'border-[#31405e] bg-[#08111f] text-slate-200 hover:border-sky-300/45 hover:bg-[#0c1627] hover:text-white'
                }`}
              >
                {shareState === 'copied'
                  ? 'Copied'
                  : shareState === 'error'
                    ? 'Copy failed'
                    : 'Copy link'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setCode(DEFAULT_CODE)
                  setSelectedSnippet('')
                  setSelectedAstKey(null)
                  setSelectedClosureId(null)
                  setSelectedCallStep(0)
                  setSelectedRange(null)
                }}
                className="self-end rounded-[1.25rem] border border-[#31405e] bg-[#08111f] px-4 py-3 text-sm font-medium text-slate-200 transition hover:border-amber-300/45 hover:bg-[#0c1627] hover:text-white"
              >
                Reset
              </button>
            </div>
          </div>
        </header>

        {showMobileDesktopHint ? (
          <div className="mt-3 md:hidden">
            <div className="flex items-start gap-3 rounded-[1.25rem] border border-[#2d3b56] bg-[linear-gradient(180deg,rgba(12,20,36,0.92),rgba(8,14,26,0.98))] px-4 py-3 text-sm text-slate-300 shadow-[0_12px_35px_rgba(0,0,0,0.18)]">
              <p className="min-w-0 flex-1 leading-6">
                💡 Best experienced on desktop for full features
              </p>
              <button
                type="button"
                onClick={() => setShowMobileDesktopHint(false)}
                className="rounded-full border border-[#31405e] bg-[#08111f] px-2.5 py-1 text-xs text-slate-300 transition hover:border-sky-300/40 hover:text-white"
                aria-label="Dismiss mobile desktop tip"
              >
                X
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-4 grid flex-1 gap-4 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:grid-cols-2">
          <section className="relative flex min-h-0 flex-col overflow-hidden rounded-[1.9rem] border border-[#22314d] bg-[linear-gradient(180deg,rgba(8,14,26,0.96),rgba(5,10,20,0.99))] shadow-[0_30px_80px_rgba(0,0,0,0.3)] sm:rounded-4xl md:min-h-[520px]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(125,211,252,0.65),transparent)]" />
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#22314d] px-4 py-4 sm:px-5">
              <div>
                <p className="text-sm font-medium tracking-[0.02em] text-slate-100">Monaco editor</p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                  300ms debounce
                </p>
              </div>
              <div
                className={`rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${
                  parsed.error
                    ? 'border-rose-400/30 bg-rose-400/8 text-rose-200'
                    : 'border-emerald-400/30 bg-emerald-400/8 text-emerald-200'
                }`}
              >
                {parsed.error ? 'Syntax error' : 'Ready'}
              </div>
            </div>

            <div className="h-[250px] overflow-hidden rounded-b-3xl touch-pan-y md:h-auto md:flex-1">
              <Editor
                height="100%"
                defaultLanguage="javascript"
                language="javascript"
                value={code}
                theme="vs-dark"
                onChange={(value) => setCode(value ?? '')}
                onMount={(editor, monaco) => {
                  monaco.editor.defineTheme('engine-lab', {
                    base: 'vs-dark',
                    inherit: true,
                    rules: [
                      { token: 'keyword', foreground: 'd8a34d' },
                      { token: 'identifier', foreground: '80c7ff' },
                      { token: 'string', foreground: '8dd39e' },
                      { token: 'number', foreground: 'f5ba6a' },
                      { token: 'delimiter', foreground: '8ba0c5' },
                    ],
                    colors: {
                      'editor.background': '#07101c',
                      'editor.foreground': '#e5edf9',
                      'editorLineNumber.foreground': '#53627d',
                      'editorLineNumber.activeForeground': '#c8d5eb',
                      'editor.selectionBackground': '#163a5f',
                      'editor.selectionHighlightBackground': '#13304d',
                      'editorCursor.foreground': '#f4c56b',
                      'editorIndentGuide.background1': '#15233a',
                      'editorIndentGuide.activeBackground1': '#2b456c',
                    },
                  })
                  monaco.editor.setTheme('engine-lab')
                  editorRef.current = editor
                  monacoRef.current = monaco
                }}
                options={{
                  automaticLayout: true,
                  fontSize: 15,
                  minimap: { enabled: false },
                  mouseWheelZoom: false,
                  padding: { top: 18 },
                  roundedSelection: true,
                  scrollBeyondLastLine: false,
                  scrollbar: {
                    alwaysConsumeMouseWheel: false,
                  },
                  smoothScrolling: true,
                  tabSize: 2,
                }}
              />
            </div>
          </section>

          <section className="relative flex min-h-[420px] flex-col overflow-hidden rounded-[1.9rem] border border-[#22314d] bg-[linear-gradient(180deg,rgba(8,14,26,0.96),rgba(5,10,20,0.99))] shadow-[0_30px_80px_rgba(0,0,0,0.3)] sm:rounded-4xl md:min-h-[520px]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(251,191,36,0.6),transparent)]" />
            <div className="border-b border-[#22314d] px-3 py-3 sm:px-4">
              <div className="rounded-[1.2rem] border border-[#24324f] bg-[linear-gradient(180deg,rgba(9,16,31,0.9),rgba(7,13,24,0.96))] px-3 py-3 sm:rounded-[1.4rem]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-slate-400">
                      V8 execution pipeline
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Follow how source code turns into structure and runtime behavior.
                    </p>
                  </div>
                </div>
                <div className="mt-3 overflow-x-auto pb-1">
                  <div className="flex w-max items-center gap-2 pr-2">
                    {PIPELINE_STEPS.map((step, index) => {
                      const isActive = activePipelineStepId === step.id
                      const isClickable = step.id === 'source' || Boolean(step.targetTab)

                      return (
                        <div key={step.id} className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handlePipelineStepClick(step)}
                            disabled={!isClickable}
                            className={`group rounded-full border px-3 py-2 text-left transition ${
                              isActive
                                ? 'border-sky-300/45 bg-[linear-gradient(90deg,rgba(22,58,96,0.94),rgba(10,31,56,0.98))] text-sky-50 shadow-[0_0_0_1px_rgba(125,211,252,0.08),0_0_24px_rgba(56,189,248,0.18)]'
                                : isClickable
                                  ? 'border-[#31405e] bg-[#08111f] text-slate-300 hover:border-amber-300/35 hover:bg-[#0d1728] hover:text-white'
                                  : 'cursor-not-allowed border-[#26324a] bg-[#07101d] text-slate-500 opacity-75'
                            }`}
                          >
                            <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] sm:text-[11px] sm:tracking-[0.16em]">
                              {step.label}
                            </span>
                            <span
                              className={`mt-1 block text-[9px] tracking-[0.02em] sm:text-[10px] ${
                                isActive
                                  ? 'text-sky-100/80'
                                  : isClickable
                                    ? 'text-slate-500 group-hover:text-slate-300'
                                    : 'text-slate-600'
                              }`}
                            >
                              {step.subtitle}
                              {step.comingSoon ? ' · coming soon' : ''}
                            </span>
                          </button>
                          {index < PIPELINE_STEPS.length - 1 ? (
                            <span className="select-none text-sm text-slate-500">→</span>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
              <div className="mt-4 overflow-x-auto pb-1">
                <div className="flex w-max gap-2 pr-2">
                  {TAB_ITEMS.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSelectedTab(tab.id)}
                      className={`shrink-0 rounded-full border px-4 py-2 text-[11px] font-medium uppercase tracking-[0.16em] transition sm:text-[12px] sm:tracking-[0.18em] ${
                        selectedTab === tab.id
                          ? 'border-sky-300/45 bg-[linear-gradient(90deg,rgba(18,58,96,0.96),rgba(10,30,54,0.98))] text-sky-50 shadow-[0_0_0_1px_rgba(125,211,252,0.08)]'
                          : 'border-[#31405e] bg-[#08111f] text-slate-300 hover:border-amber-300/35 hover:bg-[#0d1728] hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-3 sm:p-4">
              {selectedTab === 'tokens' ? <TokensPanel parsed={parsed} /> : null}
              {selectedTab === 'ast' ? (
                <AstPanel
                  parsed={parsed}
                  selectedAstKey={selectedAstKey}
                  onSelect={handleAstNodeSelect}
                />
              ) : null}
              {selectedTab === 'scope' ? (
                <ScopePanel parsed={parsed} scopeReport={scopeReport} />
              ) : null}
              {selectedTab === 'closure' ? (
                <ClosurePanel
                  parsed={parsed}
                  closureReport={closureReport}
                  activeClosure={activeClosure}
                  closureLines={closureLines}
                  onSelect={handleClosureSelect}
                />
              ) : null}
              {selectedTab === 'hoisting' ? (
                <HoistingPanel
                  parsed={parsed}
                  originalHoistLines={originalHoistLines}
                  transformedHoistLines={transformedHoistLines}
                  notes={hoistingView.notes}
                />
              ) : null}
              {selectedTab === 'callstack' ? (
                <CallStackPanel
                  parsed={parsed}
                  callStackReport={callStackReport}
                  activeCallStep={activeCallStep}
                  callStackLines={callStackLines}
                  selectedCallStep={selectedCallStep}
                  setSelectedCallStep={setSelectedCallStep}
                />
              ) : null}
              {selectedTab === 'tdz' ? (
                <TdzPanel
                  parsed={parsed}
                  code={debouncedCode}
                  zones={tdzReport.zones}
                />
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export default App
