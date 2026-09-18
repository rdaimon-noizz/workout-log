import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { AppShell } from '../components/AppShell'
import { NumberField } from '../components/NumberField'
import { SetEditSheet } from '../components/SetEditSheet'
import { btnGhost, btnPrimary, card, field, label } from '../components/ui'
import { db } from '../db/db'
import { deleteExerciseSession, updateSessionMemo } from '../db/sessions'
import { addSet, listSets } from '../db/sets'
import type { WorkoutSet } from '../db/types'
import { formatWeight, parseDecimal, parseInteger } from '../lib/format'

/** セット入力画面（最重要画面）。入力欄と [セット追加] は画面下部に固定する */
export default function SessionPage() {
  const { workoutId = '', sessionId = '' } = useParams()
  const navigate = useNavigate()
  // null = 読み込み中、undefined = 存在しない
  const session = useLiveQuery(() => db.exerciseSessions.get(sessionId), [sessionId], null)
  const exercise = useLiveQuery(() => (session ? db.exercises.get(session.exerciseId) : undefined), [session?.exerciseId])
  const sets = useLiveQuery(() => listSets(sessionId), [sessionId], [])

  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [editingSet, setEditingSet] = useState<WorkoutSet | null>(null)
  const [memoDraft, setMemoDraft] = useState<string | null>(null)
  const prefilled = useRef(false)

  // 入力欄の初期値はこのセッションの直前セット（前回記録へのフォールバックは Phase 3）
  useEffect(() => {
    if (prefilled.current || sets.length === 0) return
    const last = sets[sets.length - 1]
    setWeight(formatWeight(last.weightKg))
    setReps(String(last.reps))
    prefilled.current = true
  }, [sets])

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    const w = parseDecimal(weight)
    const r = parseInteger(reps)
    if (w === null) return setError('重量を入力してください（自重なら 0）')
    if (r === null || r < 1) return setError('Reps を 1 以上で入力してください')
    try {
      await addSet(sessionId, { weightKg: w, reps: r })
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
        <button type="button" onClick={handleDeleteSession} className={`${btnGhost} text-rose-300`}>
          削除
        </button>
      }
    >
      <div className="flex flex-col gap-4 pb-48">
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
                    className={`${card} flex w-full items-center gap-3 text-left`}
                  >
                    <span className="w-5 text-slate-500 tabular-nums">{s.setNumber}</span>
                    <span className="flex-1 text-xl font-semibold tabular-nums">
                      {formatWeight(s.weightKg)} <span className="text-base font-normal text-slate-400">kg</span> × {s.reps}
                    </span>
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
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="重量" value={weight} onChange={setWeight} mode="decimal" suffix="kg" />
            <NumberField label="Reps" value={reps} onChange={setReps} mode="integer" />
          </div>
          <button type="submit" className={`${btnPrimary} h-14 w-full text-lg`}>
            セット追加
          </button>
        </div>
      </form>

      {editingSet && <SetEditSheet set={editingSet} onClose={() => setEditingSet(null)} />}
    </AppShell>
  )
}
