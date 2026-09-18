import { describe, expect, it } from 'vitest'
import type { HistoryPoint } from '../db/history'
import { METRICS, availableMetrics, estimateOneRepMax, formatThousands } from './metrics'

function point(over: Partial<HistoryPoint>): HistoryPoint {
  return {
    workoutId: 'w',
    date: '2026-09-18',
    startedAt: '2026-09-18T10:00:00+09:00',
    usesBodyweight: false,
    bodyweight: { kg: null, source: null, date: null },
    maxLoadKg: null,
    repsAtMax: null,
    durationAtMax: null,
    volumeKg: null,
    volumeReps: 0,
    loadSeconds: null,
    loadSecondsSets: 0,
    totalSeconds: null,
    durationSets: 0,
    e1rmKg: null,
    e1rmSet: null,
    ...over,
  }
}

describe('estimateOneRepMax', () => {
  it('Epley 式で小数 1 桁', () => {
    expect(estimateOneRepMax(220, 5)).toBe(256.7)
    expect(estimateOneRepMax(100, 1)).toBe(103.3)
    expect(estimateOneRepMax(60, 10)).toBe(80)
  })
})

describe('availableMetrics', () => {
  it('記録のどこかに値がある指標だけを、定義順に返す', () => {
    const points = [
      point({ maxLoadKg: 200, volumeKg: 1000, volumeReps: 5, e1rmKg: 233.3, e1rmSet: { loadKg: 200, reps: 5 } }),
      point({ maxLoadKg: 0, totalSeconds: 60, durationSets: 1, loadSeconds: 0, loadSecondsSets: 1 }),
    ]
    expect(availableMetrics(points).map((m) => m.key)).toEqual(['maxLoad', 'volume', 'loadSeconds', 'totalSeconds', 'e1rm'])
    expect(availableMetrics([point({ totalSeconds: 60, durationSets: 1 })]).map((m) => m.key)).toEqual(['totalSeconds'])
    expect(availableMetrics([])).toEqual([])
  })
})

describe('describe / formatValue', () => {
  const byKey = Object.fromEntries(METRICS.map((m) => [m.key, m]))
  it('内訳つきの吹き出し文', () => {
    expect(byKey.maxLoad.describe(point({ maxLoadKg: 220, repsAtMax: 5 }))).toBe('220 kg × 5')
    expect(byKey.maxLoad.describe(point({ maxLoadKg: 200, repsAtMax: 3, durationAtMax: 2 }))).toBe('200 kg × 3（2秒）')
    expect(byKey.volume.describe(point({ volumeKg: 4200, volumeReps: 22 }))).toBe('4,200 kg（負荷×回数の合計、22 回）')
    expect(byKey.loadSeconds.describe(point({ loadSeconds: 4350, loadSecondsSets: 3 }))).toBe('4,350 kg·秒（負荷×秒の合計、3 セット）')
    expect(byKey.totalSeconds.describe(point({ totalSeconds: 180, durationSets: 3 }))).toBe('180 秒（3 セット）')
    expect(byKey.e1rm.describe(point({ e1rmKg: 256.7, e1rmSet: { loadKg: 220, reps: 5 } }))).toBe('256.7 kg（220 kg × 5 から推定）')
  })
  it('軸用の短い表示と桁区切り', () => {
    expect(byKey.volume.formatValue(12345.5)).toBe('12,345.5 kg')
    expect(byKey.maxLoad.formatValue(22.5)).toBe('22.5 kg')
    expect(formatThousands(1000)).toBe('1,000')
  })
})
