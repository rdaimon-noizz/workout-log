import { describe, expect, it } from 'vitest'
import type { Workout } from '../db/types'
import { computeLoad, resolveBodyweight } from './load'

function w(id: string, date: string, time: string, bodyweightKg: number | null): Workout {
  const startedAt = `${date}T${time}:00+09:00`
  return { id, date, startedAt, endedAt: null, bodyweightKg, memo: '', createdAt: startedAt, updatedAt: startedAt }
}

describe('resolveBodyweight', () => {
  const all = [w('a', '2026-09-10', '10:00', 70), w('b', '2026-09-12', '10:00', null), w('c', '2026-09-15', '07:00', 71), w('d', '2026-09-15', '19:00', null)]

  it('その Workout に体重があればそれを使う', () => {
    expect(resolveBodyweight(all[0], all)).toEqual({ kg: 70, source: 'this', date: '2026-09-10' })
  })
  it('無ければ、それより前で体重のある直近の Workout の値（同日は開始時刻で前後を判定）', () => {
    expect(resolveBodyweight(all[1], all)).toEqual({ kg: 70, source: 'previous', date: '2026-09-10' })
    expect(resolveBodyweight(all[3], all)).toEqual({ kg: 71, source: 'previous', date: '2026-09-15' })
  })
  it('前に体重の記録が無ければ null', () => {
    const first = w('z', '2026-09-01', '10:00', null)
    expect(resolveBodyweight(first, [...all, first])).toEqual({ kg: null, source: null, date: null })
  })
})

describe('computeLoad', () => {
  it('通常種目は重量そのまま、自重種目は 体重 + 加重、体重不明なら null', () => {
    expect(computeLoad(100, false, null)).toBe(100)
    expect(computeLoad(10, true, 72.5)).toBe(82.5)
    expect(computeLoad(0, true, 72.5)).toBe(72.5)
    expect(computeLoad(10, true, null)).toBe(null)
  })
})
