import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { AppShell } from '../components/AppShell'
import { WorkoutEditSheet } from '../components/WorkoutEditSheet'
import { btnDanger, btnGhost, btnPrimary, btnSecondary, card, cardButton, label } from '../components/ui'
import { loadWorkoutDetail } from '../db/queries'
import { moveExerciseSession } from '../db/sessions'
import { deleteWorkout, finishWorkout } from '../db/workouts'
import { formatDateJa, formatSetsCompact, formatTime, formatWeight, weekdayJa } from '../lib/format'

export default function WorkoutPage() {
  const { workoutId = '' } = useParams()
  const navigate = useNavigate()
  // null = 読み込み中、undefined = 存在しない
  const detail = useLiveQuery(() => loadWorkoutDetail(workoutId), [workoutId], null)
  const [editing, setEditing] = useState(false)
  const [reordering, setReordering] = useState(false)

  if (detail === null) {
    return <AppShell title="読み込み中" back="/"><p /></AppShell>
  }
  if (!detail) {
    return (
      <AppShell title="見つかりません" back="/">
        <p className="text-slate-300">このトレーニングは存在しません（削除された可能性があります）</p>
      </AppShell>
    )
  }

  const { workout, sessions } = detail
  const isActive = workout.endedAt === null
  const back = isActive ? '/' : '/history'

  async function handleFinish() {
    if (!window.confirm('トレーニングを終了しますか？')) return
    await finishWorkout(workout.id)
  }

  async function handleDelete() {
    if (!window.confirm('このトレーニングを削除しますか？\n種目とセットの記録もすべて消えます。')) return
    await deleteWorkout(workout.id)
    navigate('/', { replace: true })
  }

  return (
    <AppShell
      title={`${formatDateJa(workout.date)}（${weekdayJa(workout.date)}）`}
      back={back}
      action={
        <button type="button" onClick={() => setEditing(true)} className={btnGhost}>
          編集
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        <section className={`${card} text-sm text-slate-300`}>
          <p>
            {isActive ? <span className="text-sky-400">進行中</span> : `終了 ${formatTime(workout.endedAt ?? '')}`}
            ・開始 {formatTime(workout.startedAt)}
            {workout.bodyweightKg !== null && `・体重 ${formatWeight(workout.bodyweightKg)} kg`}
          </p>
          {workout.memo && <p className="mt-1 whitespace-pre-wrap text-slate-400">{workout.memo}</p>}
        </section>

        {sessions.length > 1 && (
          <div className="flex items-center justify-between">
            <h2 className={label}>種目</h2>
            <button
              type="button"
              onClick={() => setReordering((v) => !v)}
              aria-pressed={reordering}
              className={`${btnGhost} min-h-10 text-sm ${reordering ? 'text-sky-400' : ''}`}
            >
              {reordering ? '完了' : '並べ替え'}
            </button>
          </div>
        )}
        {sessions.length === 0 ? (
          <p className="py-4 text-center text-slate-400">種目を追加して記録を始めましょう</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sessions.map(({ session, exercise, sets }, index) => {
              const body = (
                <>
                  <span className="w-5 text-slate-500 tabular-nums">{session.order}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-lg font-semibold">{exercise?.name ?? '（削除された種目）'}</span>
                    <span className="block truncate text-sm text-slate-400">
                      {sets.length === 0 ? 'セットなし' : formatSetsCompact(sets, { bodyweight: exercise?.usesBodyweight })}
                    </span>
                  </span>
                </>
              )
              return (
                <li key={session.id}>
                  {reordering ? (
                    <div className={`${card} flex items-center gap-3`}>
                      {body}
                      <span className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          aria-label={`${exercise?.name ?? '種目'}を上へ`}
                          disabled={index === 0}
                          onClick={() => moveExerciseSession(session.id, 'up')}
                          className={`${btnSecondary} h-11 w-11 px-0 text-lg`}
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          aria-label={`${exercise?.name ?? '種目'}を下へ`}
                          disabled={index === sessions.length - 1}
                          onClick={() => moveExerciseSession(session.id, 'down')}
                          className={`${btnSecondary} h-11 w-11 px-0 text-lg`}
                        >
                          ▼
                        </button>
                      </span>
                    </div>
                  ) : (
                    <Link to={`/workouts/${workout.id}/sessions/${session.id}`} className={`${cardButton} flex items-center gap-3`}>
                      {body}
                      <span className="text-slate-500">›</span>
                    </Link>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        <Link to={`/workouts/${workout.id}/exercises`} className={`${btnPrimary} w-full`}>
          ＋ 種目を追加
        </Link>

        <div className="mt-6 flex flex-col gap-2">
          {isActive && (
            <button type="button" onClick={handleFinish} className={`${btnSecondary} w-full`}>
              トレーニングを終了
            </button>
          )}
          <button type="button" onClick={handleDelete} className={`${btnDanger} w-full`}>
            このトレーニングを削除
          </button>
        </div>
      </div>
      {editing && <WorkoutEditSheet workout={workout} onClose={() => setEditing(false)} />}
    </AppShell>
  )
}
