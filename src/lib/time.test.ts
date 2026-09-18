import { describe, expect, it } from 'vitest'
import { combineLocalDateTime, dateOfIso, newId, nowTime, toLocalDate, toLocalIso } from './time'

describe('toLocalDate', () => {
  it('ローカルの 23:59:59 でも日付がずれない', () => {
    const d = new Date(2026, 8, 18, 23, 59, 59)
    expect(toLocalDate(d)).toBe('2026-09-18')
  })

  it('ローカルの 00:00:00 でも日付がずれない', () => {
    const d = new Date(2026, 0, 1, 0, 0, 0)
    expect(toLocalDate(d)).toBe('2026-01-01')
  })
})

describe('toLocalIso', () => {
  it('オフセット付き ISO 8601 の形式になる', () => {
    const d = new Date(2026, 8, 18, 19, 30, 5)
    expect(toLocalIso(d)).toMatch(/^2026-09-18T19:30:05[+-]\d{2}:\d{2}$/)
  })

  it('Date に戻すと同じ時刻（秒精度）になる', () => {
    const d = new Date(2026, 8, 18, 19, 30, 5)
    expect(new Date(toLocalIso(d)).getTime()).toBe(d.getTime())
  })
})

describe('newId', () => {
  it('UUID 形式で、呼ぶごとに異なる', () => {
    const a = newId()
    const b = newId()
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    expect(a).not.toBe(b)
  })
})

describe('combineLocalDateTime / dateOfIso / nowTime', () => {
  it('日付と HH:mm からローカル ISO を組み、日付部分を取り出せる', () => {
    const iso = combineLocalDateTime('2026-09-18', '19:30')
    expect(iso).toMatch(/^2026-09-18T19:30:00[+-]\d{2}:\d{2}$/)
    expect(dateOfIso(iso)).toBe('2026-09-18')
    expect(new Date(iso).getTime()).toBe(new Date(2026, 8, 18, 19, 30, 0).getTime())
  })
  it('nowTime は HH:mm', () => {
    expect(nowTime()).toMatch(/^\d{2}:\d{2}$/)
  })
})
