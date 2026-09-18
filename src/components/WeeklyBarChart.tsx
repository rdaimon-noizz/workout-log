import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { WeeklyMetricDef, WeeklyRow } from '../db/analytics'
import { formatWeekRange, shortDate } from '../lib/week'

interface Props {
  rows: WeeklyRow[]
  metric: WeeklyMetricDef
}

// 棒の色は種目別履歴の折れ線と同じ sky-600（暗色面で検証済み）
const BAR = '#0284c7'
const GRID = '#1e293b'
const TICK = '#94a3b8'

/** 週ごとの合計を棒で並べる（1 本 = 1 週、古い順）。記録の無い週は 0 */
export function WeeklyBarChart({ rows, metric }: Props) {
  return (
    <div className="h-56 w-full" role="img" aria-label={`週ごとの${metric.label}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 12, right: 8, bottom: 0, left: -4 }} barCategoryGap="25%">
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="weekStart"
            tickFormatter={(v: string) => shortDate(v)}
            tick={{ fill: TICK, fontSize: 11 }}
            axisLine={{ stroke: GRID }}
            tickLine={false}
            minTickGap={16}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: TICK, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={56}
            tickFormatter={(v: number) => v.toLocaleString('ja-JP')}
          />
          <Tooltip
            cursor={{ fill: '#1e293b', opacity: 0.5 }}
            content={({ active, payload }) => {
              const row = payload?.[0]?.payload as WeeklyRow | undefined
              if (!active || !row) return null
              return (
                <div className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 shadow">
                  <div className="text-slate-400">{formatWeekRange(row.weekStart)}</div>
                  <div className="font-semibold tabular-nums">{metric.format(metric.value(row))}</div>
                </div>
              )
            }}
          />
          <Bar dataKey={metric.key} fill={BAR} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
