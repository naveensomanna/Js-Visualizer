import { getLineClasses } from '../utils/analysis'
import type { CodeLine } from '../types'

export function CodePane({
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
