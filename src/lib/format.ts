const FULLWIDTH_OFFSET = 0xfee0

/** 全角数字・全角ピリオドを半角にし、前後の空白を除く */
export function normalizeNumeric(input: string): string {
  return input.trim().replace(/[０-９．]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - FULLWIDTH_OFFSET))
}

/** 0 以上の小数文字列を数値にする。空文字や数値でないものは null */
export function parseDecimal(input: string): number | null {
  const t = normalizeNumeric(input)
  if (!/^\d+(\.\d+)?$/.test(t)) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/** 0 以上の整数文字列を数値にする。数値でないものは null */
export function parseInteger(input: string): number | null {
  const t = normalizeNumeric(input)
  if (!/^\d+$/.test(t)) return null
  return Number(t)
}

/** 重量の表示。整数はそのまま、小数は最大 2 桁 */
export function formatWeight(kg: number): string {
  return Number.isInteger(kg) ? String(kg) : String(Math.round(kg * 100) / 100)
}

/** ローカル ISO 文字列（YYYY-MM-DDTHH:mm:ss+09:00）から HH:mm を取り出す */
export function formatTime(iso: string): string {
  return iso.slice(11, 16)
}

/** YYYY-MM-DD → YYYY/MM/DD */
export function formatDateJa(date: string): string {
  return date.replaceAll('-', '/')
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

export function weekdayJa(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return WEEKDAYS[new Date(y, m - 1, d).getDay()]
}

/** セット一覧の 1 行要約。各セットを全角スペースで区切る（例: 220×5 220×5 220×5） */
export function formatSetsCompact(sets: ReadonlyArray<{ weightKg: number; reps: number }>): string {
  return sets.map((s) => `${formatWeight(s.weightKg)}×${s.reps}`).join('　')
}
