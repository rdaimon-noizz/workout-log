import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { AppShell } from '../components/AppShell'
import { ExerciseFormSheet } from '../components/ExerciseFormSheet'
import { btnDanger, btnGhost, btnSecondary, card, field } from '../components/ui'
import {
  archiveExercise,
  createExercise,
  filterExercises,
  listActiveExercises,
  listArchivedExercises,
  unarchiveExercise,
  updateExercise,
} from '../db/exercises'
import { EXERCISE_CATEGORY_LABELS, type Exercise } from '../db/types'

/** 種目マスタの管理: 検索・作成・編集・アーカイブ・復元 */
export default function ExercisesPage() {
  const active = useLiveQuery(() => listActiveExercises(), [], [])
  const archived = useLiveQuery(() => listArchivedExercises(), [], [])
  const [query, setQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Exercise | null>(null)
  const filtered = filterExercises(active, query)

  async function handleArchive(exercise: Exercise) {
    if (!window.confirm(`「${exercise.name}」をアーカイブしますか？\n過去の記録は残ります。`)) return
    await archiveExercise(exercise.id)
    setEditing(null)
  }

  return (
    <AppShell
      title="種目"
      nav
      action={
        <button type="button" onClick={() => setCreating(true)} className={btnGhost}>
          ＋ 作成
        </button>
      }
    >
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
          {filtered.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => setEditing(e)}
                className={`${card} flex w-full items-center justify-between gap-3 text-left`}
              >
                <span className="min-w-0 flex-1 truncate text-lg font-semibold">{e.name}</span>
                <span className="shrink-0 text-sm text-slate-400">{EXERCISE_CATEGORY_LABELS[e.category]}</span>
              </button>
            </li>
          ))}
        </ul>
        {filtered.length === 0 && <p className="text-center text-sm text-slate-400">該当する種目がありません</p>}

        {archived.length > 0 && (
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="mt-2 text-sm text-slate-400 underline-offset-2 hover:underline"
          >
            アーカイブ済み {archived.length} 件を{showArchived ? '隠す' : '表示'}
          </button>
        )}
        {showArchived && (
          <ul className="flex flex-col gap-2">
            {archived.map((e) => (
              <li key={e.id} className={`${card} flex items-center justify-between gap-3 opacity-70`}>
                <span className="min-w-0 flex-1 truncate">{e.name}</span>
                <button type="button" onClick={() => unarchiveExercise(e.id)} className={`${btnSecondary} shrink-0`}>
                  復元
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {creating && (
        <ExerciseFormSheet
          title="新しい種目"
          submitLabel="作成"
          initial={{ name: '', category: 'other' }}
          onClose={() => setCreating(false)}
          onSubmit={async (input) => {
            await createExercise(input)
          }}
        />
      )}
      {editing && (
        <ExerciseFormSheet
          title="種目を編集"
          initial={{ name: editing.name, category: editing.category }}
          onClose={() => setEditing(null)}
          onSubmit={async (input) => {
            await updateExercise(editing.id, input)
          }}
          footer={
            <button type="button" onClick={() => handleArchive(editing)} className={`${btnDanger} w-full`}>
              アーカイブ（選択肢から外す）
            </button>
          }
        />
      )}
    </AppShell>
  )
}
