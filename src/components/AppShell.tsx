import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router'

interface Props {
  title: string
  /** 戻り先。指定すると左に戻るボタンが出る */
  back?: string
  /** ヘッダー右側の操作 */
  action?: ReactNode
  /** 下部タブを表示する（トップレベル画面のみ） */
  nav?: boolean
  children: ReactNode
}

export function AppShell({ title, back, action, nav = false, children }: Props) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <header className="sticky top-0 z-10 bg-slate-950/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="flex h-14 items-center gap-1 px-2">
          {back ? (
            <Link
              to={back}
              aria-label="戻る"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-3xl leading-none text-slate-300"
            >
              ‹
            </Link>
          ) : (
            <div className="w-2" />
          )}
          <h1 className="min-w-0 flex-1 truncate text-lg font-bold">{title}</h1>
          {action}
        </div>
      </header>
      <div className={`flex-1 px-4 pt-2 ${nav ? 'pb-28' : 'pb-6'}`}>{children}</div>
      {nav && <BottomNav />}
    </div>
  )
}

function BottomNav() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex flex-1 flex-col items-center justify-center rounded-xl py-2 text-base ${isActive ? 'text-sky-400' : 'text-slate-400'}`
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-800 bg-slate-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex h-16 max-w-md items-stretch px-2">
        <NavLink to="/" end className={linkClass}>
          記録
        </NavLink>
        <NavLink to="/history" className={linkClass}>
          履歴
        </NavLink>
        <NavLink to="/exercises" className={linkClass}>
          種目
        </NavLink>
      </div>
    </nav>
  )
}
