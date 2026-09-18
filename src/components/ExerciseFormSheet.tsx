import { useState, type FormEvent, type ReactNode } from 'react'
import { Sheet } from './Sheet'
import { btnPrimary, field, label } from './ui'
import { EXERCISE_CATEGORIES, EXERCISE_CATEGORY_LABELS, type ExerciseCategory } from '../db/types'
import type { ExerciseInput } from '../db/exercises'

interface Props {
  title: string
  initial: ExerciseInput
  submitLabel?: string
  onSubmit: (input: ExerciseInput) => Promise<void>
  onClose: () => void
  /** 送信ボタンの下に置く追加操作（アーカイブなど） */
  footer?: ReactNode
}

/** 種目の作成・編集フォーム */
export function ExerciseFormSheet({ title, initial, submitLabel = '保存', onSubmit, onClose, footer }: Props) {
  const [name, setName] = useState(initial.name)
  const [category, setCategory] = useState<ExerciseCategory>(initial.category)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await onSubmit({ name, category })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet title={title} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className={label}>種目名</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            enterKeyHint="done"
            autoComplete="off"
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={label}>カテゴリ</span>
          <select value={category} onChange={(e) => setCategory(e.target.value as ExerciseCategory)} className={field}>
            {EXERCISE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {EXERCISE_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        {error && (
          <p role="alert" className="text-sm text-rose-400">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>
          {submitLabel}
        </button>
        {footer}
      </form>
    </Sheet>
  )
}
