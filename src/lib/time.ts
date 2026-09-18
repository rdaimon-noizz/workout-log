function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0')
}

/** 端末ローカルのオフセット付き ISO 8601（秒精度）。例 2026-09-18T19:30:00+09:00 */
export function toLocalIso(d: Date): string {
  const offsetMin = -d.getTimezoneOffset()
  const sign = offsetMin >= 0 ? '+' : '-'
  const abs = Math.abs(offsetMin)
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  )
}

/** 端末ローカルの YYYY-MM-DD */
export function toLocalDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function nowIso(): string {
  return toLocalIso(new Date())
}

export function todayLocalDate(): string {
  return toLocalDate(new Date())
}

/** レコード ID。将来の複数端末同期で衝突しないよう UUID を使う */
export function newId(): string {
  return crypto.randomUUID()
}

/** 現在時刻 HH:mm（端末ローカル） */
export function nowTime(): string {
  const d = new Date()
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** ローカル日付 YYYY-MM-DD と時刻 HH:mm からオフセット付き ISO を作る（秒は 0） */
export function combineLocalDateTime(date: string, time: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  return toLocalIso(new Date(y, m - 1, d, hh, mm, 0))
}

/** ローカル ISO 文字列の日付部分 YYYY-MM-DD */
export function dateOfIso(iso: string): string {
  return iso.slice(0, 10)
}

/** ファイル名用の時刻 YYYYMMDD-HHmm（端末ローカル） */
export function fileStamp(d: Date = new Date()): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
}
