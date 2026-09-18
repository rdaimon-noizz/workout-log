import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Sheet } from './Sheet'
import { btnPrimary, btnSecondary, field, label } from './ui'
import { listUsedMuscles, normalizeMuscles, type ExerciseInput } from '../db/exercises'
import { MUSCLE_SUGGESTIONS } from '../db/types'

interface Props {
  title: string
  initial: ExerciseInput
  submitLabel?: string
  onSubmit: (input: ExerciseInput) => Promise<void>
  onClose: () => void
  /** 送信ボタンの下に置く追加操作（アーカイブなど） */
  footer?: ReactNode
}

/** 種目の作成・編集フォーム。部位は候補をタップして複数選択し、無ければ自由入力で追加する */
export function ExerciseFormSheet({ title, initial, submitLabel = '保存', onSubmit, onClose, footer }: Props) {
  const [name, setName] = useState(initial.name)
  const [muscles, setMuscles] = useState<string[]>(initial.muscles ?? [])
  const [customMuscle, setCustomMuscle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const used = useLiveQuery(() => listUsedMuscles(), [], [])
  // 候補 = 用意した部位 ＋ 既存種目で使われている部位 ＋ いま選んでいる部位（自由入力したものを含む）
  const options = normalizeMuscles([...MUSCLE_SUGGESTIONS, ...used, ...muscles])

  function toggle(m: string) {
    setMuscles((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]))
  }

  function addCustom() {
    const [m] = normalizeMuscles([customMuscle])
    if (!m) return
    if (!muscles.includes(m)) setMuscles((prev) => [...prev, m])
    setCustomMuscle('')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await onSubmit({ name, muscles })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet title={title} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate className="flex max-h-[70dvh] flex-col gap-4 overflow-y-auto">
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

        <fieldset className="flex flex-col gap-2">
          <legend className={label}>部位（複数選択可）</legend>
          <div className="flex flex-wrap gap-2">
            {options.map((m) => {
              const selected = muscles.includes(m)
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggle(m)}
                  className={`min-h-11 rounded-full px-4 text-base ${
                    selected ? 'bg-sky-500 font-semibold text-slate-950' : 'bg-slate-800 text-slate-200'
                  }`}
                >
                  {m}
                </button>
              )
            })}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={customMuscle}
              onChange={(e) => setCustomMuscle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addCustom()
                }
              }}
              placeholder="候補にない部位を追加"
              enterKeyHint="done"
              autoComplete="off"
              aria-label="候補にない部位を追加"
              className={`${field} h-12 flex-1`}
            />
            <button type="button" onClick={addCustom} className={`${btnSecondary} shrink-0`}>
              追加
            </button>
          </div>
        </fieldset>

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
