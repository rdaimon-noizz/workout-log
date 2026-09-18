import { describe, expect, it } from 'vitest'
import { formatDateJa, formatSetsCompact, formatTime, formatWeight, parseDecimal, parseInteger, weekdayJa } from './format'

describe('parseDecimal', () => {
  it('半角・全角の小数を数値にする', () => {
    expect(parseDecimal('22.5')).toBe(22.5)
    expect(parseDecimal('２２．５')).toBe(22.5)
    expect(parseDecimal(' 220 ')).toBe(220)
    expect(parseDecimal('0')).toBe(0)
  })
  it('空文字・数値でないもの・負数は null', () => {
    expect(parseDecimal('')).toBe(null)
    expect(parseDecimal('abc')).toBe(null)
    expect(parseDecimal('-5')).toBe(null)
    expect(parseDecimal('1.2.3')).toBe(null)
  })
})

describe('parseInteger', () => {
  it('整数だけを受け付ける', () => {
    expect(parseInteger('5')).toBe(5)
    expect(parseInteger('１２')).toBe(12)
    expect(parseInteger('5.5')).toBe(null)
    expect(parseInteger('')).toBe(null)
  })
})

describe('format', () => {
  it('formatWeight は整数はそのまま、小数は最大 2 桁', () => {
    expect(formatWeight(220)).toBe('220')
    expect(formatWeight(22.5)).toBe('22.5')
    expect(formatWeight(1.25)).toBe('1.25')
  })
  it('formatTime はローカル ISO から HH:mm を取る', () => {
    expect(formatTime('2026-09-18T19:30:05+09:00')).toBe('19:30')
  })
  it('formatDateJa と weekdayJa', () => {
    expect(formatDateJa('2026-09-18')).toBe('2026/09/18')
    expect(weekdayJa('2026-09-18')).toBe('金')
  })
  it('formatSetsCompact', () => {
    expect(formatSetsCompact([{ weightKg: 220, reps: 5 }, { weightKg: 222.5, reps: 3 }])).toBe('220×5　222.5×3')
  })
})
