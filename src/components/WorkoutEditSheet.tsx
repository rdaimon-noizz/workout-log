import { useState, type FormEvent } from 'react'
import { Sheet } from './Sheet'
import { NumberField } from './NumberField'
import { btnPrimary, field, label } from './ui'
import { updateWorkout } from '../db/workouts'
import type { Workout } from '../db/types'
import { formatTime, formatWeight, parseDecimal } from '../lib/format'
import { combineLocalDateTime, dateOfIso } from '../lib/time'

interface Props {
  workout: Workout
  onClose: () => void
}

const TIME_RE = /^\d{2}:\d{2}$/

/** Workout の日付・開始/終了時刻・体重・メモの編集 */
export function WorkoutEditSheet({ workout, onClose }: Props) {
  const [date, setDate] = useState(workout.date)
  const [startTime, setStartTime] = useState(formatTime(workout.startedAt))
  const [endTime, setEndTime] = useState(workout.endedAt === null ? '' : formatTime(workout.endedAt))
  const [bodyweight, setBodyweight] = useState(workout.bodyweightKg === null ? '' : formatWeight(workout.bodyweightKg))
  const [memo, setMemo] = useState(workout.memo)
  const [error, setError] = useState<string | null>(null)

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    const bw = bodyweight.trim() === '' ? null : parseDecimal(bodyweight)
    if (bodyweight.trim() !== '' && bw === null) return setError('体重は数値で入力してください')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError('日付を選んでください')
    if (!TIME_RE.test(startTime)) return setError('開始時刻を選んでください')
    if (workout.endedAt !== null && !TIME_RE.test(endTime)) return setError('終了時刻を選んでください')
    try {
      await updateWorkout(workout.id, {
        date,
        startedAt: combineLocalDateTime(date, startTime),
        // 終了時刻は日付部分を保ったまま時刻だけ変える（日付をまたいだトレーニングを壊さない）
        endedAt: workout.endedAt === null ? null : combineLocalDateTime(dateOfIso(workout.endedAt), endTime),
        bodyweightKg: bw,
        memo,
      })
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
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className={label}>開始時刻</span>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={field} />
          </label>
          {workout.endedAt !== null && (
            <label className="flex flex-col gap-1">
              <span className={label}>終了時刻</span>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={field} />
            </label>
          )}
        </div>
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
