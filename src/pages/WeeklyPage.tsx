import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { AppShell } from '../components/AppShell'
import { WeeklyBarChart } from '../components/WeeklyBarChart'
import { card, field, label } from '../components/ui'
import {
  aggregateWeekly,
  availableWeeklyMetrics,
  filterOptions,
  loadSetFacts,
  type AnalyticsFilter,
  type WeeklyMetricKey,
} from '../db/analytics'
import { formatWeekRange } from '../lib/week'

const RANGES = [12, 26, 52] as const

function parseFilter(params: URLSearchParams): AnalyticsFilter {
  const exerciseId = params.get('exercise')
  const muscle = params.get('muscle')
  if (exerciseId) return { kind: 'exercise', exerciseId }
  if (muscle) return { kind: 'muscle', muscle }
  return { kind: 'all' }
}

function filterToValue(filter: AnalyticsFilter): string {
  if (filter.kind === 'exercise') return `e:${filter.exerciseId}`
  if (filter.kind === 'muscle') return `m:${filter.muscle}`
  return 'all'
}

/** 週ごとの集計: 対象（全種目／種目／部位）と指標を切り替え、直近 N 週を棒グラフと表で見る */
export default function WeeklyPage() {
  const [params, setParams] = useSearchParams()
  const filter = parseFilter(params)
  const facts = useLiveQuery(() => loadSetFacts(), [])
  const [metricKey, setMetricKey] = useState<WeeklyMetricKey>('volumeKg')
  const [weeks, setWeeks] = useState<(typeof RANGES)[number]>(12)

  const options = useMemo(() => filterOptions(facts ?? []), [facts])
  const rows = useMemo(() => aggregateWeekly(facts ?? [], filter, weeks), [facts, filter, weeks])
  const metrics = useMemo(() => availableWeeklyMetrics(rows), [rows])
  const metric = metrics.find((m) => m.key === metricKey) ?? metrics[0]

  function changeFilter(value: string) {
    const next = new URLSearchParams()
    if (value.startsWith('e:')) next.set('exercise', value.slice(2))
    else if (value.startsWith('m:')) next.set('muscle', value.slice(2))
    setParams(next, { replace: true })
  }

  const filterLabel =
    filter.kind === 'all'
      ? '全種目'
      : filter.kind === 'exercise'
        ? (options.exercises.find((e) => e.id === filter.exerciseId)?.name ?? '種目')
        : filter.muscle

  return (
    <AppShell title="週ごとの集計" back="/history">
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className={label}>対象</span>
          <select value={filterToValue(filter)} onChange={(e) => changeFilter(e.target.value)} className={field}>
            <option value="all">全種目</option>
            {options.exercises.length > 0 && (
              <optgroup label="種目">
                {options.exercises.map((e) => (
                  <option key={e.id} value={`e:${e.id}`}>
                    {e.name}
                  </option>
                ))}
              </optgroup>
            )}
            {options.muscles.length > 0 && (
              <optgroup label="部位">
                {options.muscles.map((m) => (
                  <option key={m} value={`m:${m}`}>
                    {m}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>

        <section className={`${card} flex flex-col gap-3`}>
          <div role="group" aria-label="指標" className="flex flex-wrap gap-2">
            {metrics.map((m) => {
              const active = m.key === metric.key
              return (
                <button
                  key={m.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setMetricKey(m.key)}
                  className={`min-h-10 rounded-full px-3 text-sm ${active ? 'bg-sky-500 font-semibold text-slate-950' : 'bg-slate-800 text-slate-200'}`}
                >
                  {m.label}
                </button>
              )
            })}
          </div>
          <div className="flex items-center justify-between gap-2">
            <h2 className={label}>
              {filterLabel} の週ごとの{metric.label}（{metric.unit}）
            </h2>
            <div role="group" aria-label="範囲" className="flex shrink-0 gap-1">
              {RANGES.map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={weeks === n}
                  onClick={() => setWeeks(n)}
                  className={`min-h-9 rounded-full px-2.5 text-xs ${weeks === n ? 'bg-slate-600 text-slate-50' : 'bg-slate-800 text-slate-300'}`}
                >
                  {n}週
                </button>
              ))}
            </div>
          </div>
          {facts === undefined ? null : <WeeklyBarChart rows={rows} metric={metric} />}
        </section>

        <section className={`${card} overflow-x-auto p-0`}>
          <table className="w-full text-sm tabular-nums">
            <thead className="text-left text-slate-400">
              <tr>
                <th className="px-3 py-2 font-normal">週</th>
                {metrics.map((m) => (
                  <th key={m.key} className="px-3 py-2 text-right font-normal">
                    {m.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...rows].reverse().map((r) => (
                <tr key={r.weekStart} className="border-t border-slate-800">
                  <td className="px-3 py-2 text-slate-300">{formatWeekRange(r.weekStart)}</td>
                  {metrics.map((m) => (
                    <td key={m.key} className="px-3 py-2 text-right">
                      {m.value(r) === 0 ? <span className="text-slate-600">0</span> : m.value(r).toLocaleString('ja-JP', { maximumFractionDigits: 2 })}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </AppShell>
  )
}
