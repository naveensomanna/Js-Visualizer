import traverseModule, {
  type Binding,
  type NodePath,
  type Scope,
} from '@babel/traverse'
import type {
  BlockStatement,
  CallExpression,
  Expression,
  Identifier as BabelIdentifier,
  Node,
  Statement,
  VariableDeclarator as BabelVariableDeclarator,
} from '@babel/types'
import { IGNORED_AST_KEYS } from '../constants'
import type {
  AstChild,
  CallStackFrame,
  CallStackReport,
  ClosureInfo,
  CodeLine,
  HoistedLine,
  LineTone,
  ParsedFile,
  ScopeInfo,
  TdzZone,
} from '../types'

const traverse =
  (
    traverseModule as typeof traverseModule & {
      default?: typeof traverseModule
    }
  ).default ?? traverseModule

export function sliceCode(
  code: string,
  node: { start?: number | null; end?: number | null },
) {
  if (typeof node.start !== 'number' || typeof node.end !== 'number') {
    return ''
  }

  return code.slice(node.start, node.end)
}

export function toCodeLines(code: string, toneByLine?: Map<number, LineTone>): CodeLine[] {
  return code.split('\n').map((content, index) => ({
    number: index + 1,
    content,
    tone: toneByLine?.get(index + 1) ?? 'default',
  }))
}

export function getLineClasses(tone: LineTone) {
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

export function getNodeLabel(node: Node) {
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

export function isNode(value: unknown): value is Node {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    typeof (value as { type: unknown }).type === 'string'
  )
}

function isExpressionNode(value: unknown): value is Expression {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('type' in value) ||
    typeof (value as { type: unknown }).type !== 'string'
  ) {
    return false
  }

  const nodeType = (value as { type: string }).type
  return (
    nodeType !== 'SpreadElement' &&
    nodeType !== 'ArgumentPlaceholder' &&
    nodeType !== 'PrivateName' &&
    !nodeType.startsWith('TS')
  )
}

export function getAstChildren(node: Node): AstChild[] {
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

export function buildScopeReport(ast: ParsedFile | null): ScopeInfo[] {
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

function getScopeBlockLabel(scope: Scope) {
  const block = scope.block

  if (block.type === 'Program') {
    return 'Global scope'
  }

  if (
    block.type === 'FunctionDeclaration' ||
    block.type === 'FunctionExpression' ||
    block.type === 'ArrowFunctionExpression'
  ) {
    const namedBlock = block as Node & { id?: { name?: string } | null }
    return namedBlock.id?.name ? `Function scope: ${namedBlock.id.name}` : 'Function scope'
  }

  if (block.type === 'BlockStatement') {
    return 'Block scope'
  }

  if (block.type === 'CatchClause') {
    return 'Catch scope'
  }

  return 'Scope'
}

function getFunctionDisplayName(path: NodePath<Node>) {
  if (!path.isFunction()) {
    return 'Function'
  }

  if ('id' in path.node && path.node.id?.name) {
    return path.node.id.name
  }

  const parent = path.parentPath

  if (parent?.isVariableDeclarator() && parent.node.id.type === 'Identifier') {
    return parent.node.id.name
  }

  if (
    parent?.isObjectProperty() &&
    parent.node.key.type === 'Identifier' &&
    !parent.node.computed
  ) {
    return parent.node.key.name
  }

  if (parent?.isAssignmentExpression() && parent.node.left.type === 'Identifier') {
    return parent.node.left.name
  }

  return 'Anonymous closure'
}

function getClosureRetention(path: NodePath<Node>) {
  const parent = path.parentPath

  if (parent?.isReturnStatement()) {
    return 'Returned from the outer scope'
  }

  if (parent?.isVariableDeclarator() && parent.node.id.type === 'Identifier') {
    return `Stored in \`${parent.node.id.name}\``
  }

  if (parent?.isCallExpression()) {
    return 'Passed as a callback'
  }

  if (parent?.isAssignmentExpression() && parent.node.left.type === 'Identifier') {
    return `Assigned to \`${parent.node.left.name}\``
  }

  return 'Nested function value'
}

export function buildClosureReport(ast: ParsedFile | null): ClosureInfo[] {
  if (!ast) {
    return []
  }

  const closures: ClosureInfo[] = []

  traverse(ast, {
    Function(path: NodePath<Node>) {
      if (!path.isFunction()) {
        return
      }

      if (!path.findParent((parentPath) => parentPath.isFunction())) {
        return
      }

      const captures = new Map<string, ClosureInfo['captures'][number]>()
      const functionScope = path.scope

      path.traverse({
        Function(innerPath) {
          if (innerPath.node !== path.node) {
            innerPath.skip()
          }
        },
        Identifier(innerPath: NodePath<BabelIdentifier>) {
          if (!innerPath.isReferencedIdentifier()) {
            return
          }

          const binding = innerPath.scope.getBinding(innerPath.node.name)
          if (!binding || binding.scope === functionScope) {
            return
          }

          if (!functionScope.hasBinding(innerPath.node.name, true)) {
            return
          }

          const sourceLine = binding.identifier.loc?.start.line ?? 1
          const key = `${binding.identifier.name}-${binding.identifier.start}`

          if (captures.has(key)) {
            return
          }

          captures.set(key, {
            name: binding.identifier.name,
            kind: binding.kind,
            sourceLabel: getScopeBlockLabel(binding.scope),
            sourceLine,
          })
        },
      })

      if (captures.size === 0) {
        return
      }

      closures.push({
        id: `${getFunctionDisplayName(path)}-${path.node.start}-${path.node.end}`,
        name: getFunctionDisplayName(path),
        line: path.node.loc?.start.line ?? 1,
        endLine: path.node.loc?.end.line ?? path.node.loc?.start.line ?? 1,
        retention: getClosureRetention(path),
        captures: [...captures.values()].sort((left, right) =>
          left.name.localeCompare(right.name),
        ),
      })
    },
  })

  return closures.sort((left, right) => left.line - right.line)
}

function flattenHighlightedLines(source: string, tone: LineTone) {
  return source.split('\n').map((content) => ({ content, tone }))
}

export function buildHoistingView(ast: ParsedFile | null, code: string) {
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

      transformedLines.push(...flattenHighlightedLines(sliceCode(code, statement), 'info'))
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

  if (ast.program.body.some((statement) => statement.type === 'FunctionDeclaration')) {
    notes.push('Function declarations are fully available before their original position.')
  }

  return { originalHighlights, transformedLines, notes }
}

function getBindingScopeLine(bindingScopeNode: Node) {
  if (
    bindingScopeNode.type === 'FunctionDeclaration' ||
    bindingScopeNode.type === 'FunctionExpression' ||
    bindingScopeNode.type === 'ArrowFunctionExpression'
  ) {
    return (
      bindingScopeNode.body.loc?.start.line ?? bindingScopeNode.loc?.start.line ?? 1
    )
  }

  return bindingScopeNode.loc?.start.line ?? 1
}

export function buildTdzReport(ast: ParsedFile | null) {
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

function getCalleeName(callExpression: CallExpression) {
  const { callee } = callExpression

  if (callee.type === 'Identifier') {
    return callee.name
  }

  if (callee.type === 'MemberExpression') {
    const objectName =
      callee.object.type === 'Identifier'
        ? callee.object.name
        : callee.object.type === 'ThisExpression'
          ? 'this'
          : 'object'
    const propertyName =
      callee.property.type === 'Identifier'
        ? callee.property.name
        : callee.property.type === 'StringLiteral'
          ? callee.property.value
          : 'property'

    return `${objectName}.${propertyName}`
  }

  return 'anonymous call'
}

function getStatementsFromBlock(block: Statement | BlockStatement) {
  return block.type === 'BlockStatement' ? block.body : [block]
}

export function buildCallStackReport(ast: ParsedFile | null, code: string): CallStackReport {
  if (!ast) {
    return { deepestStack: [], notes: [], steps: [] }
  }

  const steps: CallStackReport['steps'] = []
  const notes: string[] = []
  const maxSteps = 60
  const maxDepth = 8
  let stepIndex = 0
  let truncated = false

  const functionRegistry = new Map<
    string,
    {
      line: number
      statements: Statement[]
    }
  >()

  traverse(ast, {
    FunctionDeclaration(path) {
      if (!path.node.id) {
        return
      }

      functionRegistry.set(path.node.id.name, {
        line: path.node.loc?.start.line ?? 1,
        statements: path.node.body.body,
      })
    },
    VariableDeclarator(path: NodePath<BabelVariableDeclarator>) {
      if (
        path.node.id.type !== 'Identifier' ||
        !path.node.init ||
        (path.node.init.type !== 'FunctionExpression' &&
          path.node.init.type !== 'ArrowFunctionExpression')
      ) {
        return
      }

      const statements =
        path.node.init.body.type === 'BlockStatement' ? path.node.init.body.body : []

      functionRegistry.set(path.node.id.name, {
        line: path.node.loc?.start.line ?? 1,
        statements,
      })
    },
  })

  const addStep = (
    title: string,
    detail: string,
    line: number,
    stack: CallStackFrame[],
  ) => {
    if (steps.length >= maxSteps) {
      truncated = true
      return
    }

    steps.push({
      id: `stack-step-${stepIndex}`,
      title,
      detail,
      line,
      stack: [...stack],
    })
    stepIndex += 1
  }

  const scanExpression = (
    expression: Expression,
    stack: CallStackFrame[],
    callCounts: Map<string, number>,
  ) => {
    if (steps.length >= maxSteps) {
      truncated = true
      return
    }

    switch (expression.type) {
      case 'CallExpression': {
        for (const argument of expression.arguments) {
          if (isExpressionNode(argument)) {
            scanExpression(argument, stack, callCounts)
          }
        }

        const calleeName = getCalleeName(expression)
        const source = sliceCode(code, expression).replace(/\s+/g, ' ').trim()
        const callLine = expression.loc?.start.line ?? stack.at(-1)?.line ?? 1
        const userFunction = functionRegistry.get(calleeName)

        if (userFunction && stack.length < maxDepth) {
          const nextCount = (callCounts.get(calleeName) ?? 0) + 1
          callCounts.set(calleeName, nextCount)

          const nextStack = [
            ...stack,
            { kind: 'user', line: userFunction.line, name: calleeName },
          ] satisfies CallStackFrame[]

          addStep(`Call ${calleeName}()`, source || `${calleeName}()`, callLine, nextStack)

          if (nextCount <= 2) {
            simulateStatements(userFunction.statements, nextStack, callCounts)
          } else {
            notes.push(`Recursion depth for \`${calleeName}()\` was capped in the preview.`)
          }

          addStep(
            `Return ${calleeName}()`,
            `Control returns from ${calleeName}().`,
            callLine,
            stack,
          )
          return
        }

        const builtinStack = [
          ...stack,
          { kind: 'builtin', line: callLine, name: calleeName },
        ] satisfies CallStackFrame[]

        addStep(`Call ${calleeName}`, source || calleeName, callLine, builtinStack)
        return
      }
      case 'AssignmentExpression':
        scanExpression(expression.right, stack, callCounts)
        return
      case 'AwaitExpression':
        scanExpression(expression.argument, stack, callCounts)
        return
      case 'UnaryExpression':
        scanExpression(expression.argument, stack, callCounts)
        return
      case 'UpdateExpression':
        if (isExpressionNode(expression.argument)) {
          scanExpression(expression.argument, stack, callCounts)
        }
        return
      case 'BinaryExpression':
      case 'LogicalExpression':
        if (isExpressionNode(expression.left)) {
          scanExpression(expression.left, stack, callCounts)
        }
        scanExpression(expression.right, stack, callCounts)
        return
      case 'ConditionalExpression':
        scanExpression(expression.test, stack, callCounts)
        scanExpression(expression.consequent, stack, callCounts)
        scanExpression(expression.alternate, stack, callCounts)
        return
      case 'SequenceExpression':
        expression.expressions.forEach((item) => scanExpression(item, stack, callCounts))
        return
      case 'TemplateLiteral':
        expression.expressions.forEach((item) => {
          if (isExpressionNode(item)) {
            scanExpression(item, stack, callCounts)
          }
        })
        return
      default:
        return
    }
  }

  const simulateStatements = (
    statements: Statement[],
    stack: CallStackFrame[],
    callCounts: Map<string, number>,
  ) => {
    for (const statement of statements) {
      if (steps.length >= maxSteps) {
        truncated = true
        return
      }

      switch (statement.type) {
        case 'ExpressionStatement':
          scanExpression(statement.expression, stack, callCounts)
          break
        case 'VariableDeclaration':
          statement.declarations.forEach((declaration) => {
            if (declaration.init) {
              scanExpression(declaration.init, stack, callCounts)
            }
          })
          break
        case 'ReturnStatement':
          if (statement.argument) {
            scanExpression(statement.argument, stack, callCounts)
          }
          break
        case 'IfStatement':
          scanExpression(statement.test, stack, callCounts)
          simulateStatements(getStatementsFromBlock(statement.consequent), stack, callCounts)
          if (statement.alternate) {
            simulateStatements(getStatementsFromBlock(statement.alternate), stack, callCounts)
          }
          break
        case 'BlockStatement':
          simulateStatements(statement.body, stack, callCounts)
          break
        case 'ForStatement':
          if (statement.init && statement.init.type !== 'VariableDeclaration') {
            scanExpression(statement.init, stack, callCounts)
          }
          if (statement.test) {
            scanExpression(statement.test, stack, callCounts)
          }
          if (statement.update) {
            scanExpression(statement.update, stack, callCounts)
          }
          simulateStatements(getStatementsFromBlock(statement.body), stack, callCounts)
          break
        case 'WhileStatement':
          scanExpression(statement.test, stack, callCounts)
          simulateStatements(getStatementsFromBlock(statement.body), stack, callCounts)
          break
        default:
          break
      }
    }
  }

  const rootStack: CallStackFrame[] = [{ kind: 'global', line: 1, name: 'Global' }]
  addStep('Global execution', 'Program starts in the global scope.', 1, rootStack)
  simulateStatements(ast.program.body, rootStack, new Map<string, number>())

  if (truncated) {
    notes.push('The call stack preview is capped to keep the trace readable.')
  }

  const deepestStack = steps.reduce<CallStackFrame[]>(
    (current, step) => (step.stack.length > current.length ? step.stack : current),
    rootStack,
  )

  if (steps.length <= 1) {
    notes.push('No callable execution path was detected in the current code.')
  }

  return { deepestStack, notes, steps }
}

export function getBindingBadgeClasses(kind: string) {
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

export function getCallStackFrameClasses(kind: CallStackFrame['kind']) {
  switch (kind) {
    case 'global':
      return 'border-slate-400/25 bg-slate-400/8 text-slate-100'
    case 'user':
      return 'border-sky-400/30 bg-sky-400/10 text-sky-100'
    case 'builtin':
      return 'border-amber-400/30 bg-amber-400/10 text-amber-100'
    default:
      return 'border-slate-500/40 bg-slate-500/8 text-slate-200'
  }
}
