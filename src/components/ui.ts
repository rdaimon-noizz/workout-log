/** Tailwind クラスの共通定義。タップ領域は最小 48px（min-h-12）を確保する */
export const btn =
  'inline-flex min-h-12 items-center justify-center gap-1 rounded-2xl px-4 font-semibold transition active:opacity-70 disabled:opacity-40'
export const btnPrimary = `${btn} bg-sky-500 text-slate-950`
export const btnSecondary = `${btn} bg-slate-800 text-slate-100`
export const btnDanger = `${btn} bg-rose-500/15 text-rose-300`
export const btnGhost = `${btn} px-3 text-slate-300`
export const card = 'rounded-2xl bg-slate-900 p-4'
/** タップできる行（カード）。押した瞬間に色が変わる */
export const cardButton = `${card} transition-colors active:bg-slate-700`
export const field =
  'h-14 w-full rounded-2xl bg-slate-800 px-4 text-lg text-slate-100 outline-none focus:ring-2 focus:ring-sky-500'
export const label = 'text-sm text-slate-400'
