import { describe, expect, it } from 'vitest'
import { addDays, addWeeks, formatWeekRange, shortDate, weekStartOf } from './week'

describe('weekStartOf', () => {
  it('月曜始まり。日曜は前の月曜に属する', () => {
    expect(weekStartOf('2026-09-14')).toBe('2026-09-14') // 月
    expect(weekStartOf('2026-09-18')).toBe('2026-09-14') // 金
    expect(weekStartOf('2026-09-20')).toBe('2026-09-14') // 日
    expect(weekStartOf('2026-09-21')).toBe('2026-09-21') // 翌週の月
  })
  it('月・年をまたぐ', () => {
    expect(weekStartOf('2026-10-01')).toBe('2026-09-28')
    expect(weekStartOf('2027-01-01')).toBe('2026-12-28')
  })
})

describe('addDays / addWeeks / 表示', () => {
  it('日付の加算と週の表示', () => {
    expect(addDays('2026-09-14', 6)).toBe('2026-09-20')
    expect(addWeeks('2026-09-14', -1)).toBe('2026-09-07')
    expect(addWeeks('2026-09-14', 2)).toBe('2026-09-28')
    expect(shortDate('2026-09-07')).toBe('9/7')
    expect(formatWeekRange('2026-09-14')).toBe('9/14〜9/20')
    expect(formatWeekRange('2026-12-28')).toBe('12/28〜1/3')
  })
})
