import { TOKEN_STYLES } from '../constants'
import { ErrorState } from '../components/ErrorState'
import { PanelShell } from '../components/PanelShell'
import type { ParseState } from '../types'

export function TokensPanel({ parsed }: { parsed: ParseState }) {
  return (
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
          <p className="text-sm text-slate-400">No tokens yet.</p>
        ) : null}
      </div>
    </PanelShell>
  )
}
