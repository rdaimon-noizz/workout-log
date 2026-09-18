import type { ReactNode } from 'react'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
}

/** 画面下から出るシート。背景タップか ✕ で閉じる */
export function Sheet({ title, onClose, children }: Props) {
  return (
    <div className="fixed inset-0 z-30 flex items-end bg-black/60" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="mx-auto w-full max-w-md rounded-t-3xl bg-slate-900 p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="flex h-12 w-12 items-center justify-center rounded-xl text-xl text-slate-400"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
