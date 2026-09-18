import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { AppShell } from '../components/AppShell'
import { ExerciseFormSheet } from '../components/ExerciseFormSheet'
import { btnSecondary, card, field } from '../components/ui'
import { createExercise, filterExercises, listActiveExercises } from '../db/exercises'
import { addExerciseSession } from '../db/sessions'
import { EXERCISE_CATEGORY_LABELS } from '../db/types'

export default function AddExercisePage() {
  const { workoutId = '' } = useParams()
  const navigate = useNavigate()
  const exercises = useLiveQuery(() => listActiveExercises(), [], [])
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const filtered = filterExercises(exercises, query)
  const trimmed = query.trim()

  async function choose(exerciseId: string) {
    const session = await addExerciseSession(workoutId, exerciseId)
    navigate(`/workouts/${workoutId}/sessions/${session.id}`, { replace: true })
  }

  return (
    <AppShell title="種目を追加" back={`/workouts/${workoutId}`}>
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
                onClick={() => choose(e.id)}
                className={`${card} flex w-full items-center justify-between gap-3 text-left`}
              >
                <span className="min-w-0 flex-1 truncate text-lg font-semibold">{e.name}</span>
                <span className="shrink-0 text-sm text-slate-400">{EXERCISE_CATEGORY_LABELS[e.category]}</span>
              </button>
            </li>
          ))}
        </ul>
        {filtered.length === 0 && <p className="text-center text-sm text-slate-400">該当する種目がありません</p>}
        <button type="button" onClick={() => setCreating(true)} className={`${btnSecondary} w-full`}>
          ＋ 新しい種目を作成{trimmed && `「${trimmed}」`}
        </button>
      </div>
      {creating && (
        <ExerciseFormSheet
          title="新しい種目"
          submitLabel="作成して追加"
          initial={{ name: trimmed, category: 'other' }}
          onClose={() => setCreating(false)}
          onSubmit={async (input) => {
            const exercise = await createExercise(input)
            await choose(exercise.id)
          }}
        />
      )}
    </AppShell>
  )
}
