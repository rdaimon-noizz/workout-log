import { toLocalDate, todayLocalDate } from './time'

function parseLocalDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** date に日数を足した YYYY-MM-DD */
export function addDays(date: string, days: number): string {
  const dt = parseLocalDate(date)
  dt.setDate(dt.getDate() + days)
  return toLocalDate(dt)
}

/** その日を含む週の月曜（YYYY-MM-DD）。週は月曜始まりで、日曜は前の月曜に属する */
export function weekStartOf(date: string): string {
  const dt = parseLocalDate(date)
  const offsetFromMonday = (dt.getDay() + 6) % 7
  dt.setDate(dt.getDate() - offsetFromMonday)
  return toLocalDate(dt)
}

export function addWeeks(weekStart: string, weeks: number): string {
  return addDays(weekStart, weeks * 7)
}

export function currentWeekStart(): string {
  return weekStartOf(todayLocalDate())
}

/** M/D 形式 */
export function shortDate(date: string): string {
  const [, m, d] = date.split('-')
  return `${Number(m)}/${Number(d)}`
}

/** 週の表示。例: 9/15〜9/21 */
export function formatWeekRange(weekStart: string): string {
  return `${shortDate(weekStart)}〜${shortDate(addDays(weekStart, 6))}`
}
