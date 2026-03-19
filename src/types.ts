import type { File, Node } from '@babel/types'

export type TabId =
  | 'tokens'
  | 'ast'
  | 'scope'
  | 'closure'
  | 'hoisting'
  | 'tdz'
  | 'callstack'

export type TokenCategory =
  | 'KEYWORD'
  | 'IDENTIFIER'
  | 'STRING'
  | 'NUMBER'
  | 'OPERATOR'
  | 'PUNCTUATION'
  | 'OTHER'

export type LineTone = 'default' | 'info' | 'warning' | 'danger' | 'success'

export type VisualToken = {
  id: string
  label: string
  value: string
  category: TokenCategory
}

export type ParsedFile = File & {
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

export type ParseState = {
  ast: ParsedFile | null
  error: string | null
  tokens: VisualToken[]
}

export type ScopeVariable = {
  name: string
  kind: string
  declarationLine: number
  availableFromLine: number
  tdzUntilLine?: number
  isBlockScoped: boolean
}

export type ScopeInfo = {
  id: string
  parentId?: string
  label: string
  depth: number
  startLine: number
  endLine: number
  variables: ScopeVariable[]
}

export type HoistedLine = {
  content: string
  tone: LineTone
}

export type TdzZone = {
  name: string
  kind: 'let' | 'const'
  startLine: number
  declarationLine: number
  endLine: number
  accesses: number[]
}

export type EditorRange = {
  startLineNumber: number
  startColumn: number
  endLineNumber: number
  endColumn: number
}

export type CodeLine = {
  number: number
  content: string
  tone: LineTone
}

export type AstChild = {
  key: string
  node: Node
}

export type CallStackFrame = {
  name: string
  kind: 'global' | 'user' | 'builtin'
  line: number
}

export type CallStackStep = {
  id: string
  title: string
  detail: string
  line: number
  stack: CallStackFrame[]
}

export type CallStackReport = {
  deepestStack: CallStackFrame[]
  notes: string[]
  steps: CallStackStep[]
}

export type ClosureCapture = {
  name: string
  kind: string
  sourceLabel: string
  sourceLine: number
}

export type ClosureInfo = {
  id: string
  name: string
  line: number
  endLine: number
  retention: string
  captures: ClosureCapture[]
}

export type ShareState = 'idle' | 'copied' | 'error'
