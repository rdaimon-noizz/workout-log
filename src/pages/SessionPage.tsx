import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { AppShell } from '../components/AppShell'
import { NumberField } from '../components/NumberField'
import { ExerciseFormSheet } from '../components/ExerciseFormSheet'
import { SetEditSheet } from '../components/SetEditSheet'
import { btnGhost, btnPrimary, card, cardButton, field, label } from '../components/ui'
import { db } from '../db/db'
import { updateExercise } from '../db/exercises'
import { findPreviousRecord } from '../db/history'
import { deleteExerciseSession, updateSessionMemo } from '../db/sessions'
import { addSet, listSets } from '../db/sets'
import type { WorkoutSet } from '../db/types'
import { formatDateJa, formatSet, formatWeight, parseDecimal, parseOptionalInteger, weekdayJa } from '../lib/format'

/** セット入力画面（最重要画面）。入力欄と [セット追加] は画面下部に固定する */
export default function SessionPage() {
  const { workoutId = '', sessionId = '' } = useParams()
  const navigate = useNavigate()
  // null = 読み込み中、undefined = 存在しない
  const session = useLiveQuery(() => db.exerciseSessions.get(sessionId), [sessionId], null)
  const exercise = useLiveQuery(() => (session ? db.exercises.get(session.exerciseId) : undefined), [session?.exerciseId])
  // undefined = 読み込み中（初期値の決定を待つため区別する）
  const loadedSets = useLiveQuery(() => listSets(sessionId), [sessionId])
  const sets = loadedSets ?? []
  const workout = useLiveQuery(() => db.workouts.get(workoutId), [workoutId])
  // null = 読み込み中（セッション・Workout が揃うまでも null）、undefined = 前回なし
  const previous = useLiveQuery(
    () => (session && workout ? findPreviousRecord(session.exerciseId, workout) : null),
    [session?.exerciseId, workout?.id, workout?.date, workout?.startedAt],
    null,
  )

  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [duration, setDuration] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [editingSet, setEditingSet] = useState<WorkoutSet | null>(null)
  const [editingExercise, setEditingExercise] = useState(false)
  const [memoDraft, setMemoDraft] = useState<string | null>(null)
  const prefilled = useRef(false)

  // 入力欄の初期値: このセッションの直前セット → 無ければ前回記録の 1 セット目 → 無ければ空
  useEffect(() => {
    if (prefilled.current || loadedSets === undefined || previous === null) return
    const source = loadedSets.length > 0 ? loadedSets[loadedSets.length - 1] : previous?.sets[0]
    if (source) {
      setWeight(formatWeight(source.weightKg))
      setReps(source.reps === null ? '' : String(source.reps))
      setDuration(source.durationSec === null ? '' : String(source.durationSec))
    }
    prefilled.current = true
  }, [loadedSets, previous])

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    const w = parseDecimal(weight)
    const r = parseOptionalInteger(reps)
    const d = parseOptionalInteger(duration)
    if (w === null) return setError('重量を入力してください（自重なら 0）')
    if (r === undefined) return setError('Reps は 1 以上の整数で入力してください')
    if (d === undefined) return setError('秒は 1 以上の整数で入力してください')
    try {
      await addSet(sessionId, { weightKg: w, reps: r, durationSec: d })
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleDeleteSession() {
    const name = exercise?.name ?? 'この種目'
    if (!window.confirm(`「${name}」をこのトレーニングから削除しますか？\nセットの記録も消えます。`)) return
    await deleteExerciseSession(sessionId)
    navigate(`/workouts/${workoutId}`, { replace: true })
  }

  async function saveMemo() {
    if (session && memoDraft !== null && memoDraft !== session.memo) {
      await updateSessionMemo(sessionId, memoDraft)
    }
    setMemoDraft(null)
  }

  if (session === null) {
    return <AppShell title="読み込み中" back={`/workouts/${workoutId}`}><p /></AppShell>
  }
  if (!session) {
    return (
      <AppShell title="見つかりません" back={`/workouts/${workoutId}`}>
        <p className="text-slate-300">この種目の記録は存在しません（削除された可能性があります）</p>
      </AppShell>
    )
  }

  return (
    <AppShell
      title={exercise?.name ?? '種目'}
      back={`/workouts/${workoutId}`}
      action={
        <div className="flex items-center">
          <button type="button" onClick={() => setEditingExercise(true)} disabled={!exercise} className={btnGhost}>
            種目編集
          </button>
          <button type="button" onClick={handleDeleteSession} className={`${btnGhost} text-rose-300`}>
            削除
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 pb-48">
        <section className={card}>
          <h2 className={label}>
            前回{previous ? `：${formatDateJa(previous.workout.date)}（${weekdayJa(previous.workout.date)}）` : ''}
          </h2>
          {previous === null ? null : previous ? (
            <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-slate-200">
              {previous.sets.map((s) => (
                <li key={s.id} className="tabular-nums">
                  {formatSet(s)}
                </li>
              ))}
              {previous.sets.length === 0 && <li className="text-slate-500">セットなし</li>}
            </ul>
          ) : (
            <p className="mt-1 text-slate-500">前回の記録はありません</p>
          )}
          {exercise && (
            <Link to={`/history/exercises/${exercise.id}`} className="mt-2 inline-block text-sm text-sky-400">
              この種目の履歴・推移 ›
            </Link>
          )}
        </section>

        <section>
          <h2 className={`mb-2 ${label}`}>今回</h2>
          {sets.length === 0 ? (
            <p className={`${card} text-slate-400`}>まだセットがありません</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {sets.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setEditingSet(s)}
                    className={`${cardButton} flex w-full items-center gap-3 text-left`}
                  >
                    <span className="w-5 text-slate-500 tabular-nums">{s.setNumber}</span>
                    <span className="flex-1 text-xl font-semibold tabular-nums">{formatSet(s)}</span>
                    {s.memo && <span className="max-w-28 truncate text-sm text-slate-400">{s.memo}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <label className="flex flex-col gap-1">
          <span className={label}>種目メモ（任意）</span>
          <input
            type="text"
            value={memoDraft ?? session.memo}
            onChange={(e) => setMemoDraft(e.target.value)}
            onBlur={saveMemo}
            enterKeyHint="done"
            className={field}
          />
        </label>
      </div>

      <form
        onSubmit={handleAdd}
        noValidate
        className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-800 bg-slate-950/95 backdrop-blur"
      >
        <div className="mx-auto flex max-w-md flex-col gap-3 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          {error && (
            <p role="alert" className="text-sm text-rose-400">
              {error}
            </p>
          )}
          <div className="grid grid-cols-3 gap-2">
            <NumberField label="重量" value={weight} onChange={setWeight} mode="decimal" suffix="kg" />
            <NumberField label="Reps" value={reps} onChange={setReps} mode="integer" />
            <NumberField label="秒" value={duration} onChange={setDuration} mode="integer" />
          </div>
          <button type="submit" className={`${btnPrimary} h-14 w-full text-lg`}>
            セット追加
          </button>
        </div>
      </form>

      {editingSet && <SetEditSheet set={editingSet} onClose={() => setEditingSet(null)} />}
      {editingExercise && exercise && (
        <ExerciseFormSheet
          title="種目を編集"
          initial={{ name: exercise.name, muscles: exercise.muscles }}
          onClose={() => setEditingExercise(false)}
          onSubmit={async (input) => {
            await updateExercise(exercise.id, input)
          }}
        />
      )}
    </AppShell>
  )
}
