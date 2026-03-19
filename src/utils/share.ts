import { DEFAULT_CODE, SAMPLE_SNIPPETS, TAB_ITEMS } from '../constants'
import type { TabId } from '../types'

export function isTabId(value: string | null): value is TabId {
  return TAB_ITEMS.some((tab) => tab.id === value)
}

export function findSnippetByLabel(label: string | null) {
  if (!label) {
    return undefined
  }

  return SAMPLE_SNIPPETS.find((snippet) => snippet.label === label)
}

export function encodeCodeForUrl(code: string) {
  try {
    const bytes = new TextEncoder().encode(code)
    let binary = ''

    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte)
    })

    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '')
  } catch {
    return ''
  }
}

export function decodeCodeFromUrl(value: string | null) {
  if (!value) {
    return null
  }

  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
    const binary = atob(padded)
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))

    return new TextDecoder().decode(bytes)
  } catch {
    return null
  }
}

export function buildShareUrl(code: string, selectedTab: TabId, selectedSnippet: string) {
  if (typeof window === 'undefined') {
    return ''
  }

  const params = new URLSearchParams()
  params.set('tab', selectedTab)

  if (selectedSnippet) {
    params.set('example', selectedSnippet)
  }

  const encodedCode = encodeCodeForUrl(code)
  if (encodedCode) {
    params.set('code', encodedCode)
  }

  const query = params.toString()
  return query
    ? `${window.location.origin}${window.location.pathname}?${query}`
    : `${window.location.origin}${window.location.pathname}`
}

export function buildAppUrl(selectedTab: TabId, selectedSnippet: string) {
  if (typeof window === 'undefined') {
    return ''
  }

  const params = new URLSearchParams()

  if (selectedTab !== 'tokens') {
    params.set('tab', selectedTab)
  }

  if (selectedSnippet) {
    params.set('example', selectedSnippet)
  }

  const query = params.toString()
  return query
    ? `${window.location.origin}${window.location.pathname}?${query}`
    : `${window.location.origin}${window.location.pathname}`
}

export function getInitialAppState() {
  if (typeof window === 'undefined') {
    return {
      code: DEFAULT_CODE,
      selectedSnippet: '',
      selectedTab: 'tokens' as TabId,
    }
  }

  const params = new URLSearchParams(window.location.search)
  const example = findSnippetByLabel(params.get('example'))
  const decodedCode = decodeCodeFromUrl(params.get('code'))
  const tabParam = params.get('tab')

  return {
    code: decodedCode ?? example?.code ?? DEFAULT_CODE,
    selectedSnippet: example?.label ?? '',
    selectedTab: isTabId(tabParam) ? tabParam : 'tokens',
  }
}
