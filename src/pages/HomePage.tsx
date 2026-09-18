import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router'
import { AppShell } from '../components/AppShell'
import { btnPrimary, btnSecondary, card } from '../components/ui'
import { loadSessionDetails } from '../db/queries'
import { getActiveWorkout } from '../db/workouts'
import { formatDateJa, formatTime, weekdayJa } from '../lib/format'

export default function HomePage() {
  // null = 読み込み中、undefined = 進行中なし
  const active = useLiveQuery(() => getActiveWorkout(), [], null)
  const sessions = useLiveQuery(
    () => (active ? loadSessionDetails(active.id) : Promise.resolve([])),
    [active?.id],
    [],
  )
  const setCount = sessions.reduce((n, s) => n + s.sets.length, 0)

  return (
    <AppShell title="筋トレ記録" nav>
      <div className="flex flex-col gap-4">
        {active === null ? null : active ? (
          <section className={card}>
            <p className="text-sm text-sky-400">進行中のトレーニング</p>
            <p className="mt-1 text-xl font-bold">
              {formatDateJa(active.date)}（{weekdayJa(active.date)}）
            </p>
            <p className="mt-1 text-sm text-slate-400">
              開始 {formatTime(active.startedAt)}・{sessions.length} 種目・{setCount} セット
            </p>
            <Link to={`/workouts/${active.id}`} className={`${btnPrimary} mt-4 w-full`}>
              続ける
            </Link>
          </section>
        ) : (
          <section className={`${card} text-slate-400`}>進行中のトレーニングはありません</section>
        )}
        <Link to="/workouts/new" className={`${active ? btnSecondary : btnPrimary} w-full`}>
          新しいトレーニング
        </Link>
      </div>
    </AppShell>
  )
}
