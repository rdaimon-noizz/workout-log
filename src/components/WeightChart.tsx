import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { WeightPoint } from '../db/history'
import { formatDateJa, formatWeight } from '../lib/format'

interface Props {
  points: WeightPoint[]
}

// 線色は dataviz の検証スクリプトで暗色面（slate-950）に対して合格した sky-600
const LINE = '#0284c7'
const SURFACE = '#020617'
const GRID = '#1e293b'
const TICK = '#94a3b8'

function shortDate(date: string): string {
  const [, m, d] = date.split('-')
  return `${Number(m)}/${Number(d)}`
}

function describe(p: WeightPoint): string {
  let text = `${formatWeight(p.maxWeightKg)} kg`
  if (p.repsAtMax !== null) text += ` × ${p.repsAtMax}`
  if (p.durationAtMax !== null) text += p.repsAtMax !== null ? `（${p.durationAtMax}秒）` : ` ${p.durationAtMax}秒`
  return text
}

/** Workout ごとの最高重量の推移（1 系列の折れ線。凡例は不要） */
export function WeightChart({ points }: Props) {
  if (points.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-500">まだ記録がありません</p>
  }
  return (
    <div>
      <div className="h-56 w-full" role="img" aria-label="Workout ごとの最高重量の推移">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 12, right: 12, bottom: 0, left: -12 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis
              dataKey="startedAt"
              tickFormatter={(_, i) => shortDate(points[i]?.date ?? '')}
              tick={{ fill: TICK, fontSize: 12 }}
              axisLine={{ stroke: GRID }}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis
              domain={['auto', 'auto']}
              tickFormatter={(v: number) => formatWeight(v)}
              tick={{ fill: TICK, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip
              cursor={{ stroke: TICK, strokeWidth: 1 }}
              content={({ active, payload }) => {
                const p = payload?.[0]?.payload as WeightPoint | undefined
                if (!active || !p) return null
                return (
                  <div className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 shadow">
                    <div className="text-slate-400">{formatDateJa(p.date)}</div>
                    <div className="font-semibold tabular-nums">{describe(p)}</div>
                  </div>
                )
              }}
            />
            <Line
              type="monotone"
              dataKey="maxWeightKg"
              stroke={LINE}
              strokeWidth={2}
              dot={{ r: 4, fill: LINE, stroke: SURFACE, strokeWidth: 2 }}
              activeDot={{ r: 6, fill: LINE, stroke: SURFACE, strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {points.length === 1 && <p className="mt-1 text-center text-xs text-slate-500">2 回以上記録すると推移が線になります</p>}
    </div>
  )
}
