import { useState, type FormEvent } from 'react'
import { Sheet } from './Sheet'
import { NumberField } from './NumberField'
import { btnDanger, btnPrimary, field, label } from './ui'
import { deleteSet, updateSet } from '../db/sets'
import type { WorkoutSet } from '../db/types'
import { formatWeight, parseDecimal, parseInteger } from '../lib/format'

interface Props {
  set: WorkoutSet
  onClose: () => void
}

/** 既存セットの編集・削除 */
export function SetEditSheet({ set, onClose }: Props) {
  const [weight, setWeight] = useState(formatWeight(set.weightKg))
  const [reps, setReps] = useState(String(set.reps))
  const [memo, setMemo] = useState(set.memo)
  const [error, setError] = useState<string | null>(null)

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    const w = parseDecimal(weight)
    const r = parseInteger(reps)
    if (w === null) return setError('重量は 0 以上の数値で入力してください')
    if (r === null || r < 1) return setError('Reps は 1 以上の整数で入力してください')
    try {
      await updateSet(set.id, { weightKg: w, reps: r, memo })
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
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="重量" value={weight} onChange={setWeight} mode="decimal" suffix="kg" />
          <NumberField label="Reps" value={reps} onChange={setReps} mode="integer" />
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
