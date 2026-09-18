import { useState, type FormEvent } from 'react'
import { Sheet } from './Sheet'
import { NumberField } from './NumberField'
import { btnPrimary, field, label } from './ui'
import { updateWorkout } from '../db/workouts'
import type { Workout } from '../db/types'
import { formatWeight, parseDecimal } from '../lib/format'

interface Props {
  workout: Workout
  onClose: () => void
}

/** Workout の日付・体重・メモの編集 */
export function WorkoutEditSheet({ workout, onClose }: Props) {
  const [date, setDate] = useState(workout.date)
  const [bodyweight, setBodyweight] = useState(workout.bodyweightKg === null ? '' : formatWeight(workout.bodyweightKg))
  const [memo, setMemo] = useState(workout.memo)
  const [error, setError] = useState<string | null>(null)

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    const bw = bodyweight.trim() === '' ? null : parseDecimal(bodyweight)
    if (bodyweight.trim() !== '' && bw === null) return setError('体重は数値で入力してください')
    try {
      await updateWorkout(workout.id, { date, bodyweightKg: bw, memo })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <Sheet title="トレーニングを編集" onClose={onClose}>
      <form onSubmit={handleSave} noValidate className="flex flex-col gap-4">
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
          保存
        </button>
      </form>
    </Sheet>
  )
}
