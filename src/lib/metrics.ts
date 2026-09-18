import type { HistoryPoint } from '../db/history'
import { formatWeight } from './format'

export type MetricKey = 'maxLoad' | 'volume' | 'loadSeconds' | 'totalSeconds' | 'e1rm'

export interface MetricDef {
  key: MetricKey
  label: string
  unit: string
  /** この Workout での値。対象セットが無ければ null（点を打たない） */
  value: (p: HistoryPoint) => number | null
  /** 軸・見出し用の短い表示 */
  formatValue: (v: number) => string
  /** 吹き出し用の内訳つき表示（value が null でないときだけ呼ぶ） */
  describe: (p: HistoryPoint) => string
}

/** 推定 1RM（Epley）。負荷 × (1 + 回数 / 30)。小数 1 桁 */
export function estimateOneRepMax(loadKg: number, reps: number): number {
  return Math.round(loadKg * (1 + reps / 30) * 10) / 10
}

/** 桁区切りつきの数値（小数は最大 2 桁） */
export function formatThousands(v: number): string {
  return v.toLocaleString('ja-JP', { maximumFractionDigits: 2 })
}

function describeMaxLoad(p: HistoryPoint): string {
  let text = `${formatWeight(p.maxLoadKg ?? 0)} kg`
  if (p.repsAtMax !== null) text += ` × ${p.repsAtMax}`
  if (p.durationAtMax !== null) text += p.repsAtMax !== null ? `（${p.durationAtMax}秒）` : ` ${p.durationAtMax}秒`
  return text
}

export const METRICS: readonly MetricDef[] = [
  {
    key: 'maxLoad',
    label: '最高負荷',
    unit: 'kg',
    value: (p) => p.maxLoadKg,
    formatValue: (v) => `${formatWeight(v)} kg`,
    describe: describeMaxLoad,
  },
  {
    key: 'volume',
    label: 'ボリューム',
    unit: 'kg',
    value: (p) => p.volumeKg,
    formatValue: (v) => `${formatThousands(v)} kg`,
    describe: (p) => `${formatThousands(p.volumeKg ?? 0)} kg（負荷×回数の合計、${p.volumeReps} 回）`,
  },
  {
    key: 'loadSeconds',
    label: '負荷×時間',
    unit: 'kg·秒',
    value: (p) => p.loadSeconds,
    formatValue: (v) => `${formatThousands(v)} kg·秒`,
    describe: (p) => `${formatThousands(p.loadSeconds ?? 0)} kg·秒（負荷×秒の合計、${p.loadSecondsSets} セット）`,
  },
  {
    key: 'totalSeconds',
    label: '合計時間',
    unit: '秒',
    value: (p) => p.totalSeconds,
    formatValue: (v) => `${formatThousands(v)} 秒`,
    describe: (p) => `${formatThousands(p.totalSeconds ?? 0)} 秒（${p.durationSets} セット）`,
  },
  {
    key: 'e1rm',
    label: '推定1RM',
    unit: 'kg',
    value: (p) => p.e1rmKg,
    formatValue: (v) => `${formatWeight(v)} kg`,
    describe: (p) =>
      p.e1rmSet
        ? `${formatWeight(p.e1rmKg ?? 0)} kg（${formatWeight(p.e1rmSet.loadKg)} kg × ${p.e1rmSet.reps} から推定）`
        : `${formatWeight(p.e1rmKg ?? 0)} kg`,
  },
]

/** その種目の記録のどこかに値がある指標だけ（無い指標のボタンは出さない） */
export function availableMetrics(points: readonly HistoryPoint[]): MetricDef[] {
  return METRICS.filter((m) => points.some((p) => m.value(p) !== null))
}
