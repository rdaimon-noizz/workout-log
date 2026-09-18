// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import ExerciseHistoryPage from './ExerciseHistoryPage'
import { db } from '../db/db'
import { createExercise } from '../db/exercises'
import { addExerciseSession } from '../db/sessions'
import { addSet } from '../db/sets'
import { startWorkout } from '../db/workouts'
import { combineLocalDateTime } from '../lib/time'

beforeEach(async () => {
  await Promise.all([db.workoutSets.clear(), db.exerciseSessions.clear(), db.workouts.clear(), db.exercises.clear()])
})

function renderPage(exerciseId: string) {
  return render(
    <MemoryRouter initialEntries={[`/history/exercises/${exerciseId}`]}>
      <Routes>
        <Route path="/history/exercises/:exerciseId" element={<ExerciseHistoryPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ExerciseHistoryPage', () => {
  it('記録にある指標だけ切替ボタンを出し、切り替えると見出しが変わる', async () => {
    const dl = await createExercise({ name: 'Deadlift', muscles: [] })
    const w1 = await startWorkout({ date: '2026-09-10', startedAt: combineLocalDateTime('2026-09-10', '10:00') })
    const s1 = await addExerciseSession(w1.id, dl.id)
    await addSet(s1.id, { weightKg: 200, reps: 5, durationSec: null })
    await addSet(s1.id, { weightKg: 150, reps: 3, durationSec: 2 })

    renderPage(dl.id)
    await screen.findByRole('heading', { level: 1, name: 'Deadlift' })
    const group = await screen.findByRole('group', { name: 'グラフの指標' })
    expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual([
      '最高負荷',
      'ボリューム',
      '負荷×時間',
      '合計時間',
      '推定1RM',
    ])
    expect(within(group).getByRole('button', { name: '最高負荷', pressed: true })).toBeInTheDocument()
    expect(screen.getByText('Workout ごとの最高負荷（kg）')).toBeInTheDocument()

    fireEvent.click(within(group).getByRole('button', { name: 'ボリューム' }))
    expect(within(group).getByRole('button', { name: 'ボリューム', pressed: true })).toBeInTheDocument()
    expect(screen.getByText('Workout ごとのボリューム（kg）')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Workout ごとのボリュームの推移' })).toBeInTheDocument()
  })

  it('回数のあるセットが無い種目にはボリューム・推定1RM を出さず、切替ボタン自体も出ない', async () => {
    const plank = await createExercise({ name: 'Plank', muscles: ['腹直筋'] })
    const w1 = await startWorkout({ date: '2026-09-10', startedAt: combineLocalDateTime('2026-09-10', '10:00') })
    const s1 = await addExerciseSession(w1.id, plank.id)
    await addSet(s1.id, { weightKg: 0, reps: null, durationSec: 60 })

    renderPage(plank.id)
    await screen.findByRole('heading', { level: 1, name: 'Plank' })
    // 最高負荷（0）・負荷×時間（0）・合計時間 の 3 つは値があるので切替は出る
    const group = await screen.findByRole('group', { name: 'グラフの指標' })
    expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual(['最高負荷', '負荷×時間', '合計時間'])
    expect(within(group).queryByRole('button', { name: 'ボリューム' })).not.toBeInTheDocument()
    expect(within(group).queryByRole('button', { name: '推定1RM' })).not.toBeInTheDocument()
  })
})
