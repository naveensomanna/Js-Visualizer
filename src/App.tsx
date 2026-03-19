import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Editor, { type Monaco } from '@monaco-editor/react'
import { parse } from '@babel/parser'
import traverseModule, {
  type Binding,
  type NodePath,
  type Scope,
} from '@babel/traverse'
import type {
  File,
  Identifier as BabelIdentifier,
  Node,
  VariableDeclarator as BabelVariableDeclarator,
} from '@babel/types'
import type { editor as MonacoEditor } from 'monaco-editor'

type TabId = 'tokens' | 'ast' | 'scope' | 'hoisting' | 'tdz'
type TokenCategory =
  | 'KEYWORD'
  | 'IDENTIFIER'
  | 'STRING'
  | 'NUMBER'
  | 'OPERATOR'
  | 'PUNCTUATION'
  | 'OTHER'
type LineTone = 'default' | 'info' | 'warning' | 'danger' | 'success'

type VisualToken = {
  id: string
  label: string
  value: string
  category: TokenCategory
}

type ParsedFile = File & {
  errors?: Array<{
    message: string
    loc?: { line: number; column: number }
  }>
  tokens?: Array<{
    start: number
    end: number
    type: { label: string; keyword?: string }
    value?: unknown
  }>
}

type ParseState = {
  ast: ParsedFile | null
  error: string | null
  tokens: VisualToken[]
}

type ScopeVariable = {
  name: string
  kind: string
}

type ScopeInfo = {
  id: string
  parentId?: string
  label: string
  depth: number
  startLine: number
  endLine: number
  variables: ScopeVariable[]
}

type HoistedLine = {
  content: string
  tone: LineTone
}

type TdzZone = {
  name: string
  kind: 'let' | 'const'
  startLine: number
  declarationLine: number
  accesses: number[]
}

type EditorRange = {
  startLineNumber: number
  startColumn: number
  endLineNumber: number
  endColumn: number
}

type CodeLine = {
  number: number
  content: string
  tone: LineTone
}

type AstChild = {
  key: string
  node: Node
}

const DEFAULT_CODE = `console.log(x)
var x = 5
function foo() { return "hello" }
let y = 10
console.log(y)
`

const SAMPLE_SNIPPETS = [
  {
    label: 'Hoisting example',
    code: `console.log(total)
var total = 42

function sum(a, b) {
  return a + b
}

console.log(sum(4, 5))
`,
  },
  {
    label: 'TDZ example',
    code: `{
  console.log(message)
  const message = "inside block"
}

let status = "ready"
console.log(status)
`,
  },
  {
    label: 'Closure example',
    code: `function makeCounter() {
  let count = 0

  return function increment() {
    count += 1
    return count
  }
}

const counter = makeCounter()
counter()
counter()
`,
  },
  {
    label: 'Scope chain example',
    code: `const appName = "Visualizer"

function outer(user) {
  const greeting = "Hello"

  function inner() {
    const suffix = "!"
    return greeting + ", " + user + " from " + appName + suffix
  }

  return inner()
}

outer("Ada")
`,
  },
]

const TAB_ITEMS: Array<{ id: TabId; label: string }> = [
  { id: 'tokens', label: 'Tokens' },
  { id: 'ast', label: 'AST' },
  { id: 'scope', label: 'Scope' },
  { id: 'hoisting', label: 'Hoisting' },
  { id: 'tdz', label: 'TDZ' },
]

const TOKEN_STYLES: Record<TokenCategory, string> = {
  KEYWORD: 'border-fuchsia-400/30 bg-fuchsia-400/8 text-fuchsia-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
  IDENTIFIER: 'border-sky-400/30 bg-sky-400/8 text-sky-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
  STRING: 'border-emerald-400/30 bg-emerald-400/8 text-emerald-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
  NUMBER: 'border-amber-400/30 bg-amber-400/8 text-amber-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
  OPERATOR: 'border-rose-400/30 bg-rose-400/8 text-rose-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
  PUNCTUATION: 'border-slate-500/40 bg-slate-400/8 text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
  OTHER: 'border-[#2d3853] bg-[#0d1627] text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
}

const OPERATOR_LABELS = new Set([
  '=',
  '+',
  '-',
  '*',
  '/',
  '%',
  '**',
  '++',
  '--',
  '==',
  '===',
  '!=',
  '!==',
  '<',
  '>',
  '<=',
  '>=',
  '!',
  '&&',
  '||',
  '??',
  '?.',
  '=>',
])

const PUNCTUATION_LABELS = new Set([
  '{',
  '}',
  '(',
  ')',
  '[',
  ']',
  ',',
  ';',
  '.',
  ':',
])

const IGNORED_AST_KEYS = new Set([
  'type',
  'start',
  'end',
  'loc',
  'leadingComments',
  'trailingComments',
  'innerComments',
  'extra',
  'errors',
  'tokens',
])

const traverse =
  (
    traverseModule as typeof traverseModule & {
      default?: typeof traverseModule
    }
  ).default ?? traverseModule

function useDebouncedValue<T>(value: T, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delay)
    return () => window.clearTimeout(timeoutId)
  }, [delay, value])

  return debouncedValue
}

function classifyToken(label: string, keyword?: string): TokenCategory {
  if (keyword) {
    return 'KEYWORD'
  }

  if (label === 'name' || label === 'jsxName') {
    return 'IDENTIFIER'
  }

  if (label === 'string' || label === 'template') {
    return 'STRING'
  }

  if (label === 'num' || label === 'bigint' || label === 'decimal') {
    return 'NUMBER'
  }

  if (OPERATOR_LABELS.has(label)) {
    return 'OPERATOR'
  }

  if (PUNCTUATION_LABELS.has(label)) {
    return 'PUNCTUATION'
  }

  return 'OTHER'
}

function parseCode(code: string): ParseState {
  try {
    const ast = parse(code, {
      sourceType: 'unambiguous',
      errorRecovery: true,
      tokens: true,
      ranges: true,
      plugins: ['jsx'],
    }) as ParsedFile

    const error = ast.errors?.[0]
      ? formatParseError(ast.errors[0])
      : null

    const tokens =
      ast.tokens?.map((token, index) => {
        const label = token.type.keyword ?? token.type.label
        const rawValue =
          code.slice(token.start, token.end).trim() ||
          String(token.value ?? '')

        return {
          id: `${token.start}-${token.end}-${index}`,
          label,
          value: rawValue || label,
          category: classifyToken(token.type.label, token.type.keyword),
        }
      }) ?? []

    return { ast, error, tokens }
  } catch (error) {
    return {
      ast: null,
      error: formatParseError(error),
      tokens: [],
    }
  }
}

function formatParseError(error: unknown) {
  const message =
    error instanceof Error ? error.message : 'Unable to parse the current code.'
  const location =
    typeof error === 'object' &&
    error !== null &&
    'loc' in error &&
    typeof error.loc === 'object' &&
    error.loc !== null &&
    'line' in error.loc &&
    'column' in error.loc
      ? ` Line ${(error.loc as { line: number }).line}, column ${(error.loc as { column: number }).column + 1}.`
      : ''

  return `${message.replace(/^unknown:\s*/i, '')}${location}`
}

function sliceCode(code: string, node: { start?: number | null; end?: number | null }) {
  if (typeof node.start !== 'number' || typeof node.end !== 'number') {
    return ''
  }

  return code.slice(node.start, node.end)
}

function toCodeLines(code: string, toneByLine?: Map<number, LineTone>) {
  return code.split('\n').map((content, index) => ({
    number: index + 1,
    content,
    tone: toneByLine?.get(index + 1) ?? 'default',
  }))
}

function getLineClasses(tone: LineTone) {
  switch (tone) {
    case 'info':
      return 'bg-yellow-500/10 text-yellow-100'
    case 'warning':
      return 'bg-amber-500/15 text-amber-100'
    case 'danger':
      return 'bg-rose-500/15 text-rose-100'
    case 'success':
      return 'bg-emerald-500/15 text-emerald-100'
    default:
      return 'text-slate-200'
  }
}

function getNodeLabel(node: Node) {
  const summaryParts: string[] = []
  const summaryKeys = ['name', 'kind', 'operator', 'value']
  const nodeRecord = node as unknown as Record<string, unknown>

  for (const key of summaryKeys) {
    const value = nodeRecord[key]

    if (
      value === undefined ||
      value === null ||
      typeof value === 'object' ||
      typeof value === 'function'
    ) {
      continue
    }

    summaryParts.push(`${key}: ${String(value)}`)
  }

  return summaryParts.length > 0
    ? `${node.type} (${summaryParts.join(', ')})`
    : node.type
}

function isNode(value: unknown): value is Node {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    typeof (value as { type: unknown }).type === 'string'
  )
}

function getAstChildren(node: Node): AstChild[] {
  const children: AstChild[] = []

  for (const [key, value] of Object.entries(node)) {
    if (IGNORED_AST_KEYS.has(key)) {
      continue
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (isNode(item)) {
          children.push({ key: `${key}[${index}]`, node: item })
        }
      })
      continue
    }

    if (isNode(value)) {
      children.push({ key, node: value })
    }
  }

  return children
}

function buildScopeReport(ast: ParsedFile | null): ScopeInfo[] {
  if (!ast) {
    return []
  }

  const scopeIds = new Map<object, string>()
  let scopeCount = 0
  const scopes: ScopeInfo[] = []

  const getScopeId = (scope: Scope) => {
    const existing = scopeIds.get(scope)
    if (existing) {
      return existing
    }

    const nextId = `scope-${scopeCount++}`
    scopeIds.set(scope, nextId)
    return nextId
  }

  traverse(ast, {
    enter(path: NodePath<Node>) {
      const shouldCapture =
        path.isProgram() ||
        path.isFunction() ||
        path.isBlockStatement() ||
        path.isCatchClause()

      if (!shouldCapture) {
        return
      }

      const scope = path.scope
      const id = getScopeId(scope)

      if (scopes.some((item) => item.id === id)) {
        return
      }

      const parentId = scope.parent ? getScopeId(scope.parent) : undefined
      const depth = getScopeDepth(scope)
      const variables = Object.values(scope.bindings as Record<string, Binding>)
        .map((binding) => ({
          name: binding.identifier.name,
          kind: binding.kind,
        }))
        .sort((left, right) => left.name.localeCompare(right.name))

      scopes.push({
        id,
        parentId,
        label: getScopeLabel(path),
        depth,
        startLine: path.node.loc?.start.line ?? 1,
        endLine: path.node.loc?.end.line ?? 1,
        variables,
      })
    },
  })

  return scopes.sort((left, right) => left.depth - right.depth)
}

function getScopeDepth(scope: Scope) {
  let depth = 0
  let current: Scope | undefined = scope.parent

  while (current) {
    depth += 1
    current = current.parent
  }

  return depth
}

function getScopeLabel(path: NodePath<Node>) {
  if (path.isProgram()) {
    return 'Global scope'
  }

  if (path.isFunction()) {
    const namedNode = path.node as Node & { id?: { name?: string } | null }
    return namedNode.id?.name ? `Function scope: ${namedNode.id.name}` : 'Function scope'
  }

  if (path.isCatchClause()) {
    return 'Catch scope'
  }

  if (path.isBlockStatement()) {
    return 'Block scope'
  }

  return 'Scope'
}

function flattenHighlightedLines(source: string, tone: LineTone) {
  return source.split('\n').map((content) => ({ content, tone }))
}

function buildHoistingView(ast: ParsedFile | null, code: string) {
  const originalHighlights = new Map<number, LineTone>()
  const transformedLines: HoistedLine[] = []
  const notes: string[] = []

  if (!ast) {
    return { originalHighlights, transformedLines, notes }
  }

  const executionLines: HoistedLine[] = []

  for (const statement of ast.program.body) {
    if (statement.type === 'FunctionDeclaration') {
      if (statement.loc?.start.line) {
        originalHighlights.set(statement.loc.start.line, 'info')
      }

      transformedLines.push(
        ...flattenHighlightedLines(sliceCode(code, statement), 'info'),
      )
      continue
    }

    if (statement.type === 'VariableDeclaration' && statement.kind === 'var') {
      if (statement.loc?.start.line) {
        originalHighlights.set(statement.loc.start.line, 'info')
      }

      for (const declaration of statement.declarations) {
        if (declaration.id.type === 'Identifier') {
          transformedLines.push({
            content: `var ${declaration.id.name} = undefined`,
            tone: 'info',
          })
        }

        if (declaration.init && declaration.id.type === 'Identifier') {
          executionLines.push({
            content: `${declaration.id.name} = ${sliceCode(code, declaration.init)}`,
            tone: 'default',
          })
        }
      }
      continue
    }

    executionLines.push(...flattenHighlightedLines(sliceCode(code, statement), 'default'))
  }

  if (transformedLines.length === 0) {
    transformedLines.push({
      content: '// No hoisted var or function declarations detected',
      tone: 'default',
    })
  } else {
    transformedLines.unshift({
      content: '// Hoisted declarations',
      tone: 'warning',
    })
  }

  if (executionLines.length > 0) {
    transformedLines.push({ content: '', tone: 'default' })
    transformedLines.push({
      content: '// Runtime execution order',
      tone: 'warning',
    })
    transformedLines.push(...executionLines)
  }

  if (
    ast.program.body.some(
      (statement) =>
        statement.type === 'VariableDeclaration' &&
        (statement.kind === 'let' || statement.kind === 'const'),
    )
  ) {
    notes.push('`let` and `const` are hoisted too, but stay uninitialized inside the TDZ.')
  }

  if (
    ast.program.body.some((statement) => statement.type === 'FunctionDeclaration')
  ) {
    notes.push('Function declarations are fully available before their original position.')
  }

  return { originalHighlights, transformedLines, notes }
}

function getBindingScopeLine(bindingScopeNode: Node) {
  if (bindingScopeNode.type === 'FunctionDeclaration' || bindingScopeNode.type === 'FunctionExpression' || bindingScopeNode.type === 'ArrowFunctionExpression') {
    return bindingScopeNode.body.loc?.start.line ?? bindingScopeNode.loc?.start.line ?? 1
  }

  return bindingScopeNode.loc?.start.line ?? 1
}

function buildTdzReport(ast: ParsedFile | null) {
  if (!ast) {
    return {
      zones: [] as TdzZone[],
      highlightedLines: new Map<number, LineTone>(),
    }
  }

  const zonesByName = new Map<string, TdzZone>()
  const highlightedLines = new Map<number, LineTone>()

  traverse(ast, {
    VariableDeclarator(path: NodePath<BabelVariableDeclarator>) {
      const declaration = path.parentPath.node
      if (
        declaration.type !== 'VariableDeclaration' ||
        (declaration.kind !== 'let' && declaration.kind !== 'const') ||
        path.node.id.type !== 'Identifier'
      ) {
        return
      }

      const declarationLine = path.node.loc?.start.line
      if (!declarationLine) {
        return
      }

      const scopeNode = path.scope.block
      const startLine = getBindingScopeLine(scopeNode)
      const zone: TdzZone = {
        name: path.node.id.name,
        kind: declaration.kind,
        startLine,
        declarationLine,
        accesses: [],
      }

      zonesByName.set(`${path.node.id.name}-${path.node.start}`, zone)

      for (let line = startLine; line < declarationLine; line += 1) {
        highlightedLines.set(line, 'danger')
      }
      highlightedLines.set(declarationLine, 'warning')
    },
  })

  traverse(ast, {
    Identifier(path: NodePath<BabelIdentifier>) {
      if (!path.isReferencedIdentifier()) {
        return
      }

      const binding = path.scope.getBinding(path.node.name)
      if (!binding || (binding.kind !== 'let' && binding.kind !== 'const')) {
        return
      }

      const declarationLine = binding.identifier.loc?.start.line
      const referenceLine = path.node.loc?.start.line
      if (!declarationLine || !referenceLine || referenceLine >= declarationLine) {
        return
      }

      const zoneKey = `${binding.identifier.name}-${binding.identifier.start}`
      const zone = zonesByName.get(zoneKey)
      if (!zone) {
        return
      }

      if (!zone.accesses.includes(referenceLine)) {
        zone.accesses.push(referenceLine)
      }
      highlightedLines.set(referenceLine, 'danger')
    },
  })

  return {
    zones: [...zonesByName.values()].sort(
      (left, right) => left.declarationLine - right.declarationLine,
    ),
    highlightedLines,
  }
}

function getBindingBadgeClasses(kind: string) {
  switch (kind) {
    case 'var':
      return 'border-amber-400/30 bg-amber-400/8 text-amber-200'
    case 'let':
      return 'border-sky-400/30 bg-sky-400/8 text-sky-200'
    case 'const':
      return 'border-emerald-400/30 bg-emerald-400/8 text-emerald-200'
    case 'hoisted':
      return 'border-violet-400/30 bg-violet-400/8 text-violet-200'
    default:
      return 'border-slate-500/40 bg-slate-500/8 text-slate-200'
  }
}

function PanelShell({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="relative overflow-hidden rounded-[1.6rem] border border-[#23304b] bg-[linear-gradient(180deg,rgba(10,17,31,0.96),rgba(5,10,20,0.98))] p-4 shadow-[0_24px_60px_rgba(0,0,0,0.32)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(125,211,252,0.7),rgba(251,191,36,0.45),transparent)]" />
      <div className="mb-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-100/85">
          {title}
        </h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{description}</p>
      </div>
      {children}
    </section>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-[1.35rem] border border-rose-400/25 bg-[linear-gradient(180deg,rgba(67,12,22,0.72),rgba(38,8,16,0.92))] p-4 text-sm text-rose-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <p className="font-medium uppercase tracking-[0.18em] text-rose-100/90">Parsing issue</p>
      <p className="mt-2 leading-6 text-rose-100/78">{message}</p>
    </div>
  )
}

function CodePane({
  title,
  subtitle,
  lines,
}: {
  title: string
  subtitle: string
  lines: CodeLine[]
}) {
  return (
    <div className="overflow-hidden rounded-[1.35rem] border border-[#24324f] bg-[#07111f]/95 shadow-[0_18px_50px_rgba(0,0,0,0.24)]">
      <div className="border-b border-[#24324f] bg-[linear-gradient(90deg,rgba(10,18,33,0.98),rgba(8,20,39,0.92))] px-4 py-3">
        <p className="text-sm font-medium tracking-[0.02em] text-slate-100">{title}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p>
      </div>
      <div className="max-h-88 overflow-auto bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.08),transparent_32%)] px-2 py-2 font-mono text-sm">
        {lines.map((line) => (
          <div
            key={`${title}-${line.number}`}
            className={`grid grid-cols-[3rem_minmax(0,1fr)] rounded-md px-2 py-1 ${getLineClasses(line.tone)}`}
          >
            <span className="select-none pr-3 text-right text-slate-500">
              {line.number}
            </span>
            <span className="wrap-break-word whitespace-pre-wrap">{line.content || ' '}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function AstTreeNode({
  label,
  node,
  depth,
  selectedKey,
  onSelect,
}: {
  label: string
  node: Node
  depth: number
  selectedKey: string | null
  onSelect: (node: Node) => void
}) {
  const [expanded, setExpanded] = useState(depth < 1)
  const children = useMemo(() => getAstChildren(node), [node])
  const nodeKey = `${node.type}-${node.start}-${node.end}`
  const isSelected = selectedKey === nodeKey

  return (
    <div className="space-y-2">
      <div
        className={`rounded-2xl border px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] ${
          isSelected
            ? 'border-sky-300/40 bg-[linear-gradient(180deg,rgba(18,47,77,0.88),rgba(8,26,44,0.96))]'
            : 'border-[#24314a] bg-[linear-gradient(180deg,rgba(10,16,29,0.95),rgba(5,11,20,0.98))]'
        }`}
        style={{ marginLeft: `${depth * 14}px` }}
      >
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={() => onSelect(node)}
            className="text-left transition hover:opacity-100"
          >
            <p className="text-sm font-medium text-slate-100">{label}</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">{getNodeLabel(node)}</p>
          </button>
          {children.length > 0 ? (
            <button
              type="button"
              onClick={() => setExpanded((current) => !current)}
              className="rounded-full border border-[#32405f] bg-[#0d1627] px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-300 transition hover:border-sky-300/40 hover:text-white"
            >
              {expanded ? 'Collapse' : 'Expand'}
            </button>
          ) : null}
        </div>
      </div>
      {expanded ? (
        <div className="space-y-2">
          {children.map((child) => (
            <AstTreeNode
              key={`${nodeKey}-${child.key}`}
              label={child.key}
              node={child.node}
              depth={depth + 1}
              selectedKey={selectedKey}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function App() {
  const [code, setCode] = useState(DEFAULT_CODE)
  const [selectedTab, setSelectedTab] = useState<TabId>('tokens')
  const [selectedSnippet, setSelectedSnippet] = useState('')
  const [selectedAstKey, setSelectedAstKey] = useState<string | null>(null)
  const [selectedRange, setSelectedRange] = useState<EditorRange | null>(null)

  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<Monaco | null>(null)
  const decorationsRef = useRef<string[]>([])

  const debouncedCode = useDebouncedValue(code, 300)
  const parsed = useMemo(() => parseCode(debouncedCode), [debouncedCode])
  const scopeReport = useMemo(() => buildScopeReport(parsed.ast), [parsed.ast])
  const hoistingView = useMemo(
    () => buildHoistingView(parsed.ast, debouncedCode),
    [debouncedCode, parsed.ast],
  )
  const tdzReport = useMemo(() => buildTdzReport(parsed.ast), [parsed.ast])

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
  const tdzLines = useMemo(
    () => toCodeLines(debouncedCode, tdzReport.highlightedLines),
    [debouncedCode, tdzReport.highlightedLines],
  )

  const handleSnippetChange = (value: string) => {
    setSelectedSnippet(value)

    if (!value) {
      return
    }

    const snippet = SAMPLE_SNIPPETS.find((item) => item.label === value)
    if (snippet) {
      setCode(snippet.code)
      setSelectedAstKey(null)
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

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#040814] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.14),transparent_28%),radial-gradient(circle_at_78%_16%,rgba(251,191,36,0.12),transparent_20%),linear-gradient(180deg,rgba(4,8,20,0.92),rgba(2,6,16,1))]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(96,165,250,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(96,165,250,0.08)_1px,transparent_1px)] bg-size-[72px_72px] opacity-40" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-[1600px] flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="relative overflow-hidden rounded-4xl border border-[#22314d] bg-[linear-gradient(135deg,rgba(9,16,30,0.95),rgba(6,11,22,0.98))] px-6 py-6 shadow-[0_30px_80px_rgba(0,0,0,0.34)]">
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

            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
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
                onClick={() => {
                  setCode(DEFAULT_CODE)
                  setSelectedSnippet('')
                  setSelectedAstKey(null)
                  setSelectedRange(null)
                }}
                className="self-end rounded-[1.25rem] border border-[#31405e] bg-[#08111f] px-4 py-3 text-sm font-medium text-slate-200 transition hover:border-amber-300/45 hover:bg-[#0c1627] hover:text-white"
              >
                Reset
              </button>
            </div>
          </div>
        </header>

        <div className="mt-4 grid flex-1 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <section className="relative flex min-h-[420px] flex-col overflow-hidden rounded-4xl border border-[#22314d] bg-[linear-gradient(180deg,rgba(8,14,26,0.96),rgba(5,10,20,0.99))] shadow-[0_30px_80px_rgba(0,0,0,0.3)]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(125,211,252,0.65),transparent)]" />
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#22314d] px-5 py-4">
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

            <div className="flex-1 overflow-hidden rounded-b-3xl">
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
                  padding: { top: 18 },
                  roundedSelection: true,
                  scrollBeyondLastLine: false,
                  smoothScrolling: true,
                  tabSize: 2,
                }}
              />
            </div>
          </section>

          <section className="relative flex min-h-[420px] flex-col overflow-hidden rounded-4xl border border-[#22314d] bg-[linear-gradient(180deg,rgba(8,14,26,0.96),rgba(5,10,20,0.99))] shadow-[0_30px_80px_rgba(0,0,0,0.3)]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(251,191,36,0.6),transparent)]" />
            <div className="border-b border-[#22314d] px-4 py-3">
              <div className="flex flex-wrap gap-2">
                {TAB_ITEMS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSelectedTab(tab.id)}
                    className={`rounded-full border px-4 py-2 text-[12px] font-medium uppercase tracking-[0.18em] transition ${
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

            <div className="flex-1 overflow-auto p-4">
              {selectedTab === 'tokens' ? (
                <PanelShell
                  title="Token stream"
                  description="Live token output from the current source."
                >
                  <div className="mb-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[1.35rem] border border-[#24324f] bg-[linear-gradient(180deg,rgba(11,18,33,0.94),rgba(8,14,26,0.98))] p-4">
                      <p className="text-[11px] uppercase tracking-[0.26em] text-slate-400">
                        Total tokens
                      </p>
                      <p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-white">
                        {parsed.tokens.length}
                      </p>
                    </div>
                    <div className="rounded-[1.35rem] border border-[#24324f] bg-[linear-gradient(180deg,rgba(11,18,33,0.94),rgba(8,14,26,0.98))] p-4">
                      <p className="text-[11px] uppercase tracking-[0.26em] text-slate-400">
                        Parser status
                      </p>
                      <p className="mt-2 text-base font-medium text-white">
                        {parsed.error ? 'Partial output available' : 'Valid syntax'}
                      </p>
                    </div>
                  </div>

                  {parsed.error ? <ErrorState message={parsed.error} /> : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {parsed.tokens.map((token) => (
                      <div
                        key={token.id}
                        className={`rounded-full border px-3 py-2 ${TOKEN_STYLES[token.category]}`}
                      >
                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em]">
                          {token.category}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-sm">
                          <span className="font-medium">{token.value}</span>
                          <span className="text-xs opacity-75">{token.label}</span>
                        </div>
                      </div>
                    ))}
                    {parsed.tokens.length === 0 ? (
                      <p className="text-sm text-slate-400">
                        No tokens yet.
                      </p>
                    ) : null}
                  </div>
                </PanelShell>
              ) : null}

              {selectedTab === 'ast' ? (
                <PanelShell
                  title="AST tree"
                  description="Browse the parsed syntax tree and jump back to code."
                >
                  {parsed.error || !parsed.ast ? (
                    <ErrorState
                      message={
                        parsed.error ??
                        'Fix the syntax error to inspect the AST.'
                      }
                    />
                  ) : (
                    <div className="space-y-3">
                      <AstTreeNode
                        label="root"
                        node={parsed.ast.program}
                        depth={0}
                        selectedKey={selectedAstKey}
                        onSelect={handleAstNodeSelect}
                      />
                    </div>
                  )}
                </PanelShell>
              ) : null}

              {selectedTab === 'scope' ? (
                <PanelShell
                  title="Scope chain"
                  description="Scopes ordered from outermost to innermost."
                >
                  {parsed.error || !parsed.ast ? (
                    <ErrorState
                      message={
                        parsed.error ??
                        'Fix the syntax error to inspect scope.'
                      }
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
                            <h4 className="text-sm font-semibold text-white">
                              {scope.label}
                            </h4>
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
                              <span className="text-sm text-slate-500">
                                No bindings in this scope.
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </PanelShell>
              ) : null}

              {selectedTab === 'hoisting' ? (
                <PanelShell
                  title="Hoisting preview"
                  description="Compare source order with a simplified hoisted view."
                >
                  {parsed.error || !parsed.ast ? (
                    <ErrorState
                      message={
                        parsed.error ??
                        'Fix the syntax error to inspect hoisting.'
                      }
                    />
                  ) : (
                    <div className="space-y-4">
                      <div className="grid gap-4 xl:grid-cols-2">
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
                      {hoistingView.notes.length > 0 ? (
                        <div className="rounded-[1.35rem] border border-[#24324f] bg-[linear-gradient(180deg,rgba(11,18,33,0.94),rgba(8,14,26,0.98))] p-4">
                          <p className="text-[11px] uppercase tracking-[0.26em] text-slate-400">
                            Notes
                          </p>
                          <div className="mt-3 space-y-2 text-sm text-slate-300">
                            {hoistingView.notes.map((note) => (
                              <p key={note}>{note}</p>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </PanelShell>
              ) : null}

              {selectedTab === 'tdz' ? (
                <PanelShell
                  title="TDZ"
                  description="Lines marked in red are inside the temporal dead zone."
                >
                  {parsed.error || !parsed.ast ? (
                    <ErrorState
                      message={
                        parsed.error ??
                        'Fix the syntax error to inspect TDZ.'
                      }
                    />
                  ) : (
                    <div className="space-y-4">
                      <CodePane
                        title="TDZ map"
                        subtitle="Red lines are inside the TDZ. Amber lines contain the declaration."
                        lines={tdzLines}
                      />
                      <div className="space-y-3">
                        {tdzReport.zones.length > 0 ? (
                          tdzReport.zones.map((zone) => (
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
                                <h4 className="text-sm font-semibold text-white">
                                  {zone.name}
                                </h4>
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
                          <p className="text-sm text-slate-400">
                            No TDZ zones in the current code.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </PanelShell>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export default App
