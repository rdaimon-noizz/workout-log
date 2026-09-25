import { useState, type FormEvent } from 'react'
import { Sheet } from './Sheet'
import { NumberField } from './NumberField'
import { btnDanger, btnPrimary, field, label } from './ui'
import { deleteSet, updateSet } from '../db/sets'
import type { WorkoutSet } from '../db/types'
import { formatWeight, parseDecimal, parseOptionalInteger } from '../lib/format'

interface Props {
  set: WorkoutSet
  /** 自重種目なら重量欄を「加重」と表示する */
  bodyweight?: boolean
  onClose: () => void
}

/** 既存セットの編集・削除 */
export function SetEditSheet({ set, bodyweight = false, onClose }: Props) {
  const [weight, setWeight] = useState(formatWeight(set.weightKg))
  const [reps, setReps] = useState(set.reps === null ? '' : String(set.reps))
  const [duration, setDuration] = useState(set.durationSec === null ? '' : String(set.durationSec))
  const [memo, setMemo] = useState(set.memo)
  const [error, setError] = useState<string | null>(null)

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    const w = parseDecimal(weight)
    const r = parseOptionalInteger(reps, 0)
    const d = parseOptionalInteger(duration)
    if (w === null) return setError('重量は 0 以上の数値で入力してください')
    if (r === undefined) return setError('Reps は 0 以上の整数で入力してください（0 = 失敗）')
    if (d === undefined) return setError('秒は 1 以上の整数で入力してください')
    try {
      await updateSet(set.id, { weightKg: w, reps: r, durationSec: d, memo })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleDelete() {
    if (!window.confirm(`${set.setNumber} セット目を削除しますか？`)) return
    await deleteSet(set.id)
    onClose()
  }

  return (
    <Sheet title={`${set.setNumber} セット目を編集`} onClose={onClose}>
      <form onSubmit={handleSave} noValidate className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-2">
          <NumberField label={bodyweight ? '加重' : '重量'} value={weight} onChange={setWeight} mode="decimal" suffix="kg" />
          <NumberField label="Reps" value={reps} onChange={setReps} mode="integer" />
          <NumberField label="秒" value={duration} onChange={setDuration} mode="integer" />
        </div>
        <label className="flex flex-col gap-1">
          <span className={label}>メモ（任意）</span>
          <input type="text" value={memo} onChange={(e) => setMemo(e.target.value)} enterKeyHint="done" className={field} />
        </label>
        {error && (
          <p role="alert" className="text-sm text-rose-400">
            {error}
          </p>
        )}
        <button type="submit" className={`${btnPrimary} w-full`}>
          保存
        </button>
        <button type="button" onClick={handleDelete} className={`${btnDanger} w-full`}>
          このセットを削除
        </button>
      </form>
    </Sheet>
  )
}
