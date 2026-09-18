import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router'
import { AppShell } from '../components/AppShell'
import { card, cardButton } from '../components/ui'
import { listWorkoutSummaries } from '../db/history'
import { formatDateJa, formatTime, weekdayJa } from '../lib/format'

/** トレーニング履歴（新しい順） */
export default function HistoryPage() {
  const summaries = useLiveQuery(() => listWorkoutSummaries(), [])

  return (
    <AppShell title="履歴" nav>
      <div className="flex flex-col gap-3">
        <Link to="/history/exercises" className={`${cardButton} flex items-center justify-between`}>
          <span className="text-lg font-semibold">種目別の履歴・推移</span>
          <span className="text-slate-500">›</span>
        </Link>
        <div className="grid grid-cols-2 gap-2">
          <Link to="/history/weekly" className={`${cardButton} flex items-center justify-between`}>
            <span className="font-semibold">週ごとの集計</span>
            <span className="text-slate-500">›</span>
          </Link>
          <Link to="/history/muscles" className={`${cardButton} flex items-center justify-between`}>
            <span className="font-semibold">部位別（週）</span>
            <span className="text-slate-500">›</span>
          </Link>
        </div>

        {summaries === undefined ? null : summaries.length === 0 ? (
          <p className={`${card} text-slate-400`}>まだ記録がありません</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {summaries.map(({ workout, exerciseNames, setCount }) => (
              <li key={workout.id}>
                <Link to={`/workouts/${workout.id}`} className={`${cardButton} flex items-center gap-3`}>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="text-lg font-semibold">
                        {formatDateJa(workout.date)}（{weekdayJa(workout.date)}）
                      </span>
                      <span className="text-sm text-slate-400">
                        {workout.endedAt === null ? <span className="text-sky-400">進行中</span> : formatTime(workout.startedAt)}
                      </span>
                    </span>
                    <span className="block truncate text-sm text-slate-400">
                      {exerciseNames.length === 0 ? '種目なし' : exerciseNames.join(' / ')}
                      {setCount > 0 && `・${setCount} セット`}
                    </span>
                  </span>
                  <span className="text-slate-500">›</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  )
}
