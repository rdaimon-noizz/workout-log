import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { AppShell } from '../components/AppShell'
import { NumberField } from '../components/NumberField'
import { btnPrimary, field, label } from '../components/ui'
import { getActiveWorkout, startWorkout } from '../db/workouts'
import { formatDateJa, parseDecimal } from '../lib/format'
import { todayLocalDate } from '../lib/time'

export default function NewWorkoutPage() {
  const navigate = useNavigate()
  const active = useLiveQuery(() => getActiveWorkout(), [])
  const [date, setDate] = useState(todayLocalDate())
  const [bodyweight, setBodyweight] = useState('')
  const [memo, setMemo] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const bw = bodyweight.trim() === '' ? null : parseDecimal(bodyweight)
    if (bodyweight.trim() !== '' && bw === null) return setError('体重は数値で入力してください')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError('日付を選んでください')
    try {
      const workout = await startWorkout({ date, bodyweightKg: bw, memo })
      navigate(`/workouts/${workout.id}`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <AppShell title="新しいトレーニング" back="/">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {active && (
          <p className="rounded-2xl bg-amber-500/10 p-3 text-sm text-amber-300">
            進行中のトレーニング（{formatDateJa(active.date)}）は自動的に終了します
          </p>
        )}
        <label className="flex flex-col gap-1">
          <span className={label}>日付</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
        </label>
        <NumberField label="体重（任意）" value={bodyweight} onChange={setBodyweight} mode="decimal" suffix="kg" />
        <label className="flex flex-col gap-1">
          <span className={label}>メモ（任意）</span>
          <textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={3} className={`${field} h-auto py-3`} />
        </label>
        {error && (
          <p role="alert" className="text-sm text-rose-400">
            {error}
          </p>
        )}
        <button type="submit" className={`${btnPrimary} w-full`}>
          開始
        </button>
      </form>
    </AppShell>
  )
}
