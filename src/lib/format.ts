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

export interface SetLike {
  weightKg: number
  reps: number | null
  durationSec: number | null
}

/** Reps 0 = 1 回も挙げられなかった（リフト失敗）セット */
export function isFailedSet(s: Pick<SetLike, 'reps'>): boolean {
  return s.reps === 0
}

export interface SetFormatOptions {
  /** 自重種目なら weightKg を加重として「自重+10 kg」の形で出す */
  bodyweight?: boolean
}

/** 重量部分。通常: 220 kg（重量 0・reps なしなら空）／ 自重種目: 自重 または 自重+10 kg */
function weightPart(s: SetLike, opts?: SetFormatOptions, compact = false): string {
  if (opts?.bodyweight) {
    if (s.weightKg > 0) return compact ? `自重+${formatWeight(s.weightKg)}` : `自重+${formatWeight(s.weightKg)} kg`
    return '自重'
  }
  const show = s.weightKg > 0 || s.reps !== null
  if (!show) return ''
  return compact ? formatWeight(s.weightKg) : `${formatWeight(s.weightKg)} kg`
}

/**
 * セット 1 本の表示。例: 220 kg × 5 ／ 200 kg × 3（2秒）／ 60秒 ／ 20 kg 60秒 ／ 自重+10 kg × 8 ／ 自重 × 8
 * 重量 0 で reps も無いセット（プランク等）は重量を出さない。
 * reps 0（失敗）は 100 kg × 0（失敗）／ 100 kg × 0（失敗・2秒）。
 */
export function formatSet(s: SetLike, opts?: SetFormatOptions): string {
  let out = weightPart(s, opts)
  if (s.reps !== null) out += ` × ${s.reps}`
  const notes: string[] = []
  if (isFailedSet(s)) notes.push('失敗')
  if (s.durationSec !== null) {
    if (s.reps !== null) notes.push(`${s.durationSec}秒`)
    else out += out ? ` ${s.durationSec}秒` : `${s.durationSec}秒`
  }
  if (notes.length > 0) out += `（${notes.join('・')}）`
  return out
}

/** セット 1 本の短い表示。例: 220×5 ／ 200×3(2秒) ／ 60秒 ／ 20×60秒 ／ 自重+10×8 ／ 自重×8 */
export function formatSetCompact(s: SetLike, opts?: SetFormatOptions): string {
  let out = weightPart(s, opts, true)
  if (s.reps !== null) out += `×${s.reps}`
  const notes: string[] = []
  if (isFailedSet(s)) notes.push('失敗')
  if (s.durationSec !== null) {
    if (s.reps !== null) notes.push(`${s.durationSec}秒`)
    else out += out ? `×${s.durationSec}秒` : `${s.durationSec}秒`
  }
  if (notes.length > 0) out += `(${notes.join('・')})`
  return out
}

/** セット一覧の 1 行要約。各セットを全角スペースで区切る */
export function formatSetsCompact(sets: ReadonlyArray<SetLike>, opts?: SetFormatOptions): string {
  return sets.map((s) => formatSetCompact(s, opts)).join('　')
}

/**
 * 任意の整数欄の解釈。空文字は null（未入力）、min 以上の整数はその値、それ以外は undefined（不正）。
 * min の既定は 1（秒）。Reps は 0 を「失敗」として受けるので min 0 で呼ぶ。
 */
export function parseOptionalInteger(input: string, min = 1): number | null | undefined {
  if (input.trim() === '') return null
  const n = parseInteger(input)
  return n === null || n < min ? undefined : n
}

/** 負荷の表示。体重が解決できず計算できないときは「負荷 不明」 */
export function formatLoad(kg: number | null): string {
  return kg === null ? '負荷 不明' : `${formatWeight(kg)} kg`
}
