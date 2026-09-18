// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import WorkoutPage from './WorkoutPage'
import { db } from '../db/db'
import { createExercise } from '../db/exercises'
import { addExerciseSession, listSessions } from '../db/sessions'
import { startWorkout } from '../db/workouts'

let workoutId = ''
let ids: string[] = []

beforeEach(async () => {
  await Promise.all([db.workoutSets.clear(), db.exerciseSessions.clear(), db.workouts.clear(), db.exercises.clear()])
  const dl = await createExercise({ name: 'Deadlift', muscles: [] })
  const bp = await createExercise({ name: 'Bench Press', muscles: [] })
  const sq = await createExercise({ name: 'Squat', muscles: [] })
  const workout = await startWorkout({})
  workoutId = workout.id
  ids = []
  for (const ex of [dl, bp, sq]) ids.push((await addExerciseSession(workoutId, ex.id)).id)
})

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/workouts/${workoutId}`]}>
      <Routes>
        <Route path="/workouts/:workoutId" element={<WorkoutPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

const rowNames = () => screen.getAllByRole('listitem').map((li) => li.textContent?.replace(/^\d/, '').split('セットなし')[0])

describe('WorkoutPage の並べ替え', () => {
  it('並べ替えモードで ▲▼ を押すと順番が入れ替わり、保存される', async () => {
    renderPage()
    await screen.findByText('Deadlift')
    expect(rowNames()).toEqual(['Deadlift', 'Bench Press', 'Squat'])
    // 通常表示では行はリンク
    expect(screen.getAllByRole('link', { name: /Deadlift|Bench Press|Squat/ })).toHaveLength(3)

    fireEvent.click(screen.getByRole('button', { name: '並べ替え' }))
    expect(screen.queryByRole('link', { name: /Deadlift/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Deadliftを上へ' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Squatを下へ' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Squatを上へ' }))
    await waitFor(() => expect(rowNames()).toEqual(['Deadlift', 'Squat', 'Bench Press']))
    fireEvent.click(screen.getByRole('button', { name: 'Deadliftを下へ' }))
    await waitFor(() => expect(rowNames()).toEqual(['Squat', 'Deadlift', 'Bench Press']))

    const saved = await listSessions(workoutId)
    expect(saved.map((s) => [s.id, s.order])).toEqual([
      [ids[2], 1],
      [ids[0], 2],
      [ids[1], 3],
    ])

    fireEvent.click(screen.getByRole('button', { name: '完了' }))
    expect(screen.getAllByRole('link', { name: /Deadlift|Bench Press|Squat/ })).toHaveLength(3)
    const first = screen.getAllByRole('listitem')[0]
    expect(within(first).getByRole('link')).toHaveTextContent('Squat')
  })

  it('種目が 1 つなら並べ替えボタンを出さない', async () => {
    await db.exerciseSessions.bulkDelete(ids.slice(1))
    renderPage()
    await screen.findByText('Deadlift')
    expect(screen.queryByRole('button', { name: '並べ替え' })).not.toBeInTheDocument()
  })
})
