import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { AppShell } from '../components/AppShell'
import { btnSecondary, card, cardButton, label } from '../components/ui'
import { aggregateMuscles, loadSetFacts, weekTotals } from '../db/analytics'
import { addWeeks, currentWeekStart, formatWeekRange } from '../lib/week'

type BarMetric = 'sets' | 'volumeKg'
const num = (v: number) => v.toLocaleString('ja-JP', { maximumFractionDigits: 2 })

/** 部位別（週）: 1 週間のセット数とボリュームを部位ごとに横棒で並べる */
export default function MusclesPage() {
  const navigate = useNavigate()
  const facts = useLiveQuery(() => loadSetFacts(), [])
  const thisWeek = currentWeekStart()
  const [weekStart, setWeekStart] = useState(thisWeek)
  const [barMetric, setBarMetric] = useState<BarMetric>('sets')

  const rows = useMemo(() => aggregateMuscles(facts ?? [], weekStart), [facts, weekStart])
  const totals = useMemo(() => weekTotals(facts ?? [], weekStart), [facts, weekStart])
  const max = Math.max(0, ...rows.map((r) => r[barMetric]))

  return (
    <AppShell title="部位別（週）" back="/history">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <button type="button" aria-label="前の週" onClick={() => setWeekStart(addWeeks(weekStart, -1))} className={`${btnSecondary} h-12 w-12 px-0 text-xl`}>
            ‹
          </button>
          <div className="flex min-w-0 flex-1 flex-col items-center">
            <span className="text-lg font-semibold">{formatWeekRange(weekStart)}</span>
            {weekStart === thisWeek ? (
              <span className="text-xs text-slate-400">今週</span>
            ) : (
              <button type="button" onClick={() => setWeekStart(thisWeek)} className="text-xs text-sky-400">
                今週に戻る
              </button>
            )}
          </div>
          <button
            type="button"
            aria-label="次の週"
            disabled={weekStart >= thisWeek}
            onClick={() => setWeekStart(addWeeks(weekStart, 1))}
            className={`${btnSecondary} h-12 w-12 px-0 text-xl`}
          >
            ›
          </button>
        </div>

        <section className={`${card} text-sm text-slate-300`}>
          <h2 className={`mb-1 ${label}`}>この週の合計</h2>
          <p className="tabular-nums">
            {num(totals.sets)} セット・{num(totals.volumeKg)} kg・{totals.workoutDays} 日
          </p>
        </section>

        <section className={`${card} flex flex-col gap-3`}>
          <div className="flex items-center justify-between gap-2">
            <h2 className={label}>部位ごと</h2>
            <div role="group" aria-label="横棒の指標" className="flex gap-1">
              {(
                [
                  ['sets', 'セット数'],
                  ['volumeKg', 'ボリューム'],
                ] as const
              ).map(([key, text]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={barMetric === key}
                  onClick={() => setBarMetric(key)}
                  className={`min-h-9 rounded-full px-2.5 text-xs ${barMetric === key ? 'bg-slate-600 text-slate-50' : 'bg-slate-800 text-slate-300'}`}
                >
                  {text}
                </button>
              ))}
            </div>
          </div>
          {facts === undefined ? null : rows.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">この週の記録はありません</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {rows.map((r) => (
                <li key={r.muscle}>
                  <button
                    type="button"
                    onClick={() => navigate(`/history/weekly?muscle=${encodeURIComponent(r.muscle)}`)}
                    className={`${cardButton} flex w-full flex-col gap-1 bg-slate-800/60 p-3 text-left`}
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold">{r.muscle}</span>
                      <span className="text-sm text-slate-300 tabular-nums">
                        {r.sets} セット・{num(r.volumeKg)} kg
                      </span>
                    </span>
                    <span className="block h-2 w-full overflow-hidden rounded-full bg-slate-700">
                      <span
                        className="block h-full rounded-full bg-sky-600"
                        style={{ width: `${max > 0 ? Math.max(4, (r[barMetric] / max) * 100) : 0}%` }}
                      />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-slate-500">複数の部位を持つ種目は、それぞれの部位に満額で数えます。部位の無い種目は「部位未設定」。タップするとその部位の週ごとの推移へ。</p>
        </section>
      </div>
    </AppShell>
  )
}
