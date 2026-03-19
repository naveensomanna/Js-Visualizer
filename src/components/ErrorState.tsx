export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-[1.35rem] border border-rose-400/25 bg-[linear-gradient(180deg,rgba(67,12,22,0.72),rgba(38,8,16,0.92))] p-4 text-sm text-rose-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <p className="font-medium uppercase tracking-[0.18em] text-rose-100/90">Parsing issue</p>
      <p className="mt-2 leading-6 text-rose-100/78">{message}</p>
    </div>
  )
}
