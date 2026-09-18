// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import HistoryPage from './HistoryPage'
import { db } from '../db/db'
import { createExercise } from '../db/exercises'
import { addExerciseSession } from '../db/sessions'
import { addSet } from '../db/sets'
import { finishWorkout, startWorkout } from '../db/workouts'
import { combineLocalDateTime } from '../lib/time'

beforeEach(async () => {
  await Promise.all([db.workoutSets.clear(), db.exerciseSessions.clear(), db.workouts.clear(), db.exercises.clear()])
})

describe('HistoryPage', () => {
  it('Workout を新しい順に、種目名とセット数付きで一覧する', async () => {
    const dl = await createExercise({ name: 'Deadlift', muscles: [] })
    const bp = await createExercise({ name: 'Bench Press', muscles: [] })
    const w1 = await startWorkout({ date: '2026-09-10', startedAt: combineLocalDateTime('2026-09-10', '10:00') })
    const s1 = await addExerciseSession(w1.id, dl.id)
    await addSet(s1.id, { weightKg: 200, reps: 5, durationSec: null })
    await finishWorkout(w1.id)
    const w2 = await startWorkout({ date: '2026-09-15', startedAt: combineLocalDateTime('2026-09-15', '19:00') })
    await addExerciseSession(w2.id, bp.id)
    await addExerciseSession(w2.id, dl.id)

    render(
      <MemoryRouter>
        <HistoryPage />
      </MemoryRouter>,
    )
    const rows = await screen.findAllByRole('link', { name: /2026\/09\/1/ })
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('2026/09/15（火）')
    expect(rows[0]).toHaveTextContent('進行中')
    expect(rows[0]).toHaveTextContent('Bench Press / Deadlift')
    expect(rows[1]).toHaveTextContent('2026/09/10（木）')
    expect(rows[1]).toHaveTextContent('Deadlift・1 セット')
    expect(screen.getByRole('link', { name: /種目別の履歴/ })).toHaveAttribute('href', '/history/exercises')
  })

  it('記録が無いときの表示', async () => {
    render(
      <MemoryRouter>
        <HistoryPage />
      </MemoryRouter>,
    )
    expect(await screen.findByText('まだ記録がありません')).toBeInTheDocument()
  })
})
