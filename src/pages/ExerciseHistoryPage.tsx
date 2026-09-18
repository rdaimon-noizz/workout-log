import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useParams } from 'react-router'
import { AppShell } from '../components/AppShell'
import { WeightChart } from '../components/WeightChart'
import { card, cardButton, label } from '../components/ui'
import { loadExerciseHistory } from '../db/history'
import { formatDateJa, formatSet, formatTime, weekdayJa } from '../lib/format'

/** 種目別履歴: 最高重量の推移グラフと、Workout ごとのセット一覧（新しい順） */
export default function ExerciseHistoryPage() {
  const { exerciseId = '' } = useParams()
  const history = useLiveQuery(() => loadExerciseHistory(exerciseId), [exerciseId])

  if (history === undefined) {
    return <AppShell title="読み込み中" back="/history/exercises"><p /></AppShell>
  }
  if (!history.exercise) {
    return (
      <AppShell title="見つかりません" back="/history/exercises">
        <p className="text-slate-300">この種目は存在しません（削除された可能性があります）</p>
      </AppShell>
    )
  }

  const { exercise, entries, points } = history
  return (
    <AppShell title={exercise.name} back="/history/exercises">
      <div className="flex flex-col gap-4">
        <section className={card}>
          <h2 className={label}>Workout ごとの最高重量（kg）</h2>
          <WeightChart points={points} />
        </section>

        {entries.length === 0 ? (
          <p className="py-4 text-center text-slate-400">この種目の記録はまだありません</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {entries.map(({ workout, sessions }) => (
              <li key={workout.id}>
                <Link to={`/workouts/${workout.id}`} className={`${cardButton} flex items-start gap-3`}>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="text-lg font-semibold">
                        {formatDateJa(workout.date)}（{weekdayJa(workout.date)}）
                      </span>
                      <span className="text-sm text-slate-400">{formatTime(workout.startedAt)}</span>
                    </span>
                    <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-slate-300">
                      {sessions.flatMap((x) => x.sets).map((s) => (
                        <li key={s.id} className="tabular-nums">
                          {formatSet(s)}
                        </li>
                      ))}
                    </ul>
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
