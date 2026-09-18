import { describe, expect, it } from 'vitest'
import {
  formatDateJa,
  formatSet,
  formatSetsCompact,
  formatTime,
  formatWeight,
  parseDecimal,
  parseInteger,
  parseOptionalInteger,
  weekdayJa,
} from './format'

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
  it('formatSet は reps・秒の有無で表示を変える', () => {
    expect(formatSet({ weightKg: 220, reps: 5, durationSec: null })).toBe('220 kg × 5')
    expect(formatSet({ weightKg: 200, reps: 3, durationSec: 2 })).toBe('200 kg × 3（2秒）')
    expect(formatSet({ weightKg: 0, reps: null, durationSec: 60 })).toBe('60秒')
    expect(formatSet({ weightKg: 20, reps: null, durationSec: 60 })).toBe('20 kg 60秒')
    expect(formatSet({ weightKg: 0, reps: 12, durationSec: null })).toBe('0 kg × 12')
  })
  it('formatSetsCompact', () => {
    expect(
      formatSetsCompact([
        { weightKg: 220, reps: 5, durationSec: null },
        { weightKg: 222.5, reps: 3, durationSec: 2 },
        { weightKg: 0, reps: null, durationSec: 60 },
        { weightKg: 20, reps: null, durationSec: 45 },
      ]),
    ).toBe('220×5　222.5×3(2秒)　60秒　20×45秒')
  })
  it('parseOptionalInteger は空を null、正の整数を値、それ以外を undefined にする', () => {
    expect(parseOptionalInteger('')).toBe(null)
    expect(parseOptionalInteger('  ')).toBe(null)
    expect(parseOptionalInteger('5')).toBe(5)
    expect(parseOptionalInteger('0')).toBe(undefined)
    expect(parseOptionalInteger('2.5')).toBe(undefined)
    expect(parseOptionalInteger('abc')).toBe(undefined)
  })
})
