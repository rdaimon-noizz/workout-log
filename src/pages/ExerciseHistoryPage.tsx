import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { AppShell } from '../components/AppShell'
import { MetricChart } from '../components/MetricChart'
import { card, cardButton, label } from '../components/ui'
import { loadExerciseHistory } from '../db/history'
import { formatDateJa, formatLoad, formatSet, formatTime, weekdayJa } from '../lib/format'
import { computeLoad } from '../lib/load'
import { availableMetrics, type MetricKey } from '../lib/metrics'

/** 種目別履歴: 指標を切り替えられる推移グラフと、Workout ごとのセット一覧（新しい順） */
export default function ExerciseHistoryPage() {
  const { exerciseId = '' } = useParams()
  const history = useLiveQuery(() => loadExerciseHistory(exerciseId), [exerciseId])
  const points = history?.points
  // その種目の記録に値がある指標だけ出す。既定は最高負荷
  const metrics = useMemo(() => availableMetrics(points ?? []), [points])
  const [metricKey, setMetricKey] = useState<MetricKey>('maxLoad')
  const metric = metrics.find((m) => m.key === metricKey) ?? metrics[0]

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

  const { exercise, entries } = history
  return (
    <AppShell title={exercise.name} back="/history/exercises">
      <div className="flex flex-col gap-4">
        <section className={`${card} flex flex-col gap-3`}>
          {metrics.length > 1 && (
            <div role="group" aria-label="グラフの指標" className="flex flex-wrap gap-2">
              {metrics.map((m) => {
                const active = m.key === metric?.key
                return (
                  <button
                    key={m.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setMetricKey(m.key)}
                    className={`min-h-10 rounded-full px-3 text-sm ${
                      active ? 'bg-sky-500 font-semibold text-slate-950' : 'bg-slate-800 text-slate-200'
                    }`}
                  >
                    {m.label}
                  </button>
                )
              })}
            </div>
          )}
          {metric ? (
            <>
              <h2 className={label}>
                Workout ごとの{metric.label}（{metric.unit}）
                {exercise.usesBodyweight && <span className="ml-2 text-slate-500">負荷 = 体重 + 加重</span>}
              </h2>
              <MetricChart points={history.points} metric={metric} />
            </>
          ) : (
            <p className="py-6 text-center text-sm text-slate-500">まだ記録がありません</p>
          )}
        </section>

        {entries.length === 0 ? (
          <p className="py-4 text-center text-slate-400">この種目の記録はまだありません</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {entries.map(({ workout, sessions, bodyweight }) => (
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
                          {formatSet(s, { bodyweight: exercise.usesBodyweight })}
                          {exercise.usesBodyweight && (
                            <span className="ml-1 text-slate-500">{formatLoad(computeLoad(s.weightKg, true, bodyweight.kg))}</span>
                          )}
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
