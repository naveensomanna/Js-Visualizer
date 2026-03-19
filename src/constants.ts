import type { TabId, TokenCategory } from './types'

export const DEFAULT_CODE = `console.log(x)
var x = 5
function foo() { return "hello" }
let y = 10
console.log(y)
`

export const SAMPLE_SNIPPETS = [
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
] as const

export const TAB_ITEMS: Array<{ id: TabId; label: string }> = [
  { id: 'tokens', label: 'Tokens' },
  { id: 'ast', label: 'AST' },
  { id: 'scope', label: 'Scope' },
  { id: 'closure', label: 'Closure' },
  { id: 'hoisting', label: 'Hoisting' },
  { id: 'tdz', label: 'TDZ' },
  { id: 'callstack', label: 'Call Stack' },
]

export const PIPELINE_STEPS: Array<{
  id: 'source' | 'tokens' | 'ast' | 'scope' | 'bytecode' | 'execution'
  label: string
  subtitle: string
  targetTab?: TabId
  stageTabs: TabId[]
  comingSoon?: boolean
}> = [
  {
    id: 'source',
    label: 'Source Code',
    subtitle: 'what you write',
    stageTabs: [],
  },
  {
    id: 'tokens',
    label: 'Tokens',
    subtitle: 'lexer output',
    targetTab: 'tokens',
    stageTabs: ['tokens'],
  },
  {
    id: 'ast',
    label: 'AST',
    subtitle: 'syntax tree',
    targetTab: 'ast',
    stageTabs: ['ast'],
  },
  {
    id: 'scope',
    label: 'Scope',
    subtitle: 'variable resolution',
    targetTab: 'scope',
    stageTabs: ['scope', 'closure', 'hoisting', 'tdz'],
  },
  {
    id: 'bytecode',
    label: 'Bytecode',
    subtitle: 'V8 instructions',
    stageTabs: [],
    comingSoon: true,
  },
  {
    id: 'execution',
    label: 'Execution',
    subtitle: 'runtime',
    stageTabs: ['callstack'],
    comingSoon: true,
  },
]

export const TOKEN_STYLES: Record<TokenCategory, string> = {
  KEYWORD:
    'border-fuchsia-400/30 bg-fuchsia-400/8 text-fuchsia-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
  IDENTIFIER:
    'border-sky-400/30 bg-sky-400/8 text-sky-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
  STRING:
    'border-emerald-400/30 bg-emerald-400/8 text-emerald-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
  NUMBER:
    'border-amber-400/30 bg-amber-400/8 text-amber-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
  OPERATOR:
    'border-rose-400/30 bg-rose-400/8 text-rose-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
  PUNCTUATION:
    'border-slate-500/40 bg-slate-400/8 text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
  OTHER:
    'border-[#2d3853] bg-[#0d1627] text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
}

export const OPERATOR_LABELS = new Set([
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

export const PUNCTUATION_LABELS = new Set([
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

export const IGNORED_AST_KEYS = new Set([
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
