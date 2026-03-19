import { parse } from '@babel/parser'
import { OPERATOR_LABELS, PUNCTUATION_LABELS } from '../constants'
import type { ParseState, ParsedFile, TokenCategory } from '../types'

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

export function formatParseError(error: unknown) {
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

export function parseCode(code: string): ParseState {
  try {
    const ast = parse(code, {
      sourceType: 'unambiguous',
      errorRecovery: true,
      tokens: true,
      ranges: true,
      plugins: ['jsx'],
    }) as ParsedFile

    const error = ast.errors?.[0] ? formatParseError(ast.errors[0]) : null

    const tokens =
      ast.tokens?.map((token, index) => {
        const label = token.type.keyword ?? token.type.label
        const rawValue =
          code.slice(token.start, token.end).trim() || String(token.value ?? '')

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
