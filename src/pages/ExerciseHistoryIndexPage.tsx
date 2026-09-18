import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router'
import { AppShell } from '../components/AppShell'
import { cardButton, field } from '../components/ui'
import { toNameKey } from '../db/exercises'
import { listExercisesWithHistory } from '../db/history'
import { formatDateJa } from '../lib/format'

/** 種目別履歴の入口: 種目を選ぶ */
export default function ExerciseHistoryIndexPage() {
  const items = useLiveQuery(() => listExercisesWithHistory(), [], [])
  const [query, setQuery] = useState('')
  const q = toNameKey(query)
  const filtered = q ? items.filter((x) => x.exercise.nameKey.includes(q)) : items

  return (
    <AppShell title="種目別の履歴" back="/history">
      <div className="flex flex-col gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="種目名で検索"
          enterKeyHint="search"
          autoComplete="off"
          className={field}
        />
        <ul className="flex flex-col gap-2">
          {filtered.map(({ exercise, workoutCount, lastDate }) => (
            <li key={exercise.id}>
              <Link
                to={`/history/exercises/${exercise.id}`}
                className={`${cardButton} flex items-center gap-3 ${workoutCount === 0 ? 'opacity-60' : ''}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-lg font-semibold">
                    {exercise.name}
                    {exercise.archivedAt !== null && <span className="ml-2 text-xs text-slate-500">アーカイブ済み</span>}
                  </span>
                  <span className="block text-sm text-slate-400">
                    {workoutCount === 0 ? '記録なし' : `${workoutCount} 回・最終 ${lastDate ? formatDateJa(lastDate) : ''}`}
                  </span>
                </span>
                <span className="text-slate-500">›</span>
              </Link>
            </li>
          ))}
        </ul>
        {filtered.length === 0 && <p className="text-center text-sm text-slate-400">該当する種目がありません</p>}
      </div>
    </AppShell>
  )
}
