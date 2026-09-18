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
