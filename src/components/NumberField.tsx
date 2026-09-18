import { useId } from 'react'

interface Props {
  label: string
  value: string
  onChange: (value: string) => void
  /** decimal = 小数可（重量）、integer = 整数のみ（reps） */
  mode: 'decimal' | 'integer'
  suffix?: string
  placeholder?: string
}

/**
 * 数値入力欄。iOS でテンキーを出すため type="number" ではなく inputMode を使う。
 * 文字サイズは 16px 以上（未満だとフォーカス時に画面がズームする）。
 */
export function NumberField({ label, value, onChange, mode, suffix, placeholder }: Props) {
  const id = useId()
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-sm text-slate-400">
        {label}
      </label>
      <div className="flex h-14 items-center gap-2 rounded-2xl bg-slate-800 px-4 focus-within:ring-2 focus-within:ring-sky-500">
        <input
          id={id}
          type="text"
          inputMode={mode === 'decimal' ? 'decimal' : 'numeric'}
          pattern={mode === 'integer' ? '[0-9]*' : undefined}
          autoComplete="off"
          enterKeyHint="done"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={(e) => e.target.select()}
          className="min-w-0 flex-1 bg-transparent text-2xl font-semibold tabular-nums text-slate-100 outline-none"
        />
        {suffix && <span className="shrink-0 text-slate-400">{suffix}</span>}
      </div>
    </div>
  )
}
