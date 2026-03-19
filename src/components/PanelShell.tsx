import type { ReactNode } from 'react'

export function PanelShell({
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
