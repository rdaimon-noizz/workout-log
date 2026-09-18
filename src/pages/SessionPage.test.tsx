// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import SessionPage from './SessionPage'
import { db } from '../db/db'
import { createExercise } from '../db/exercises'
import { addExerciseSession } from '../db/sessions'
import { startWorkout } from '../db/workouts'

let workoutId = ''
let sessionId = ''

beforeEach(async () => {
  await Promise.all([db.workoutSets.clear(), db.exerciseSessions.clear(), db.workouts.clear(), db.exercises.clear()])
  const exercise = await createExercise({ name: 'Deadlift', category: 'back' })
  const workout = await startWorkout({})
  const session = await addExerciseSession(workout.id, exercise.id)
  workoutId = workout.id
  sessionId = session.id
})

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/workouts/${workoutId}/sessions/${sessionId}`]}>
      <Routes>
        <Route path="/workouts/:workoutId/sessions/:sessionId" element={<SessionPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('SessionPage', () => {
  it('種目名を表示し、重量と reps を入れてセットを追加できる', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { level: 1, name: 'Deadlift' })).toBeInTheDocument()
    expect(await screen.findByText('まだセットがありません')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('重量'), { target: { value: '220' } })
    fireEvent.change(screen.getByLabelText('Reps'), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: 'セット追加' }))

    const row = await screen.findByRole('button', { name: /220\s*kg\s*×\s*5/ })
    expect(row).toBeInTheDocument()
    expect(await db.workoutSets.where('exerciseSessionId').equals(sessionId).count()).toBe(1)
    // 追加後も入力値は残り、次のセットを 1 タップで足せる
    expect(screen.getByLabelText('重量')).toHaveValue('220')
    expect(screen.getByLabelText('Reps')).toHaveValue('5')
  })

  it('数値入力欄は iOS のテンキーが出る属性を持つ', async () => {
    renderPage()
    await screen.findByRole('heading', { level: 1, name: 'Deadlift' })
    expect(screen.getByLabelText('重量')).toHaveAttribute('inputmode', 'decimal')
    expect(screen.getByLabelText('Reps')).toHaveAttribute('inputmode', 'numeric')
    expect(screen.getByLabelText('Reps')).toHaveAttribute('pattern', '[0-9]*')
  })

  it('reps が空なら追加せずエラーを出す', async () => {
    renderPage()
    await screen.findByRole('heading', { level: 1, name: 'Deadlift' })
    fireEvent.change(screen.getByLabelText('重量'), { target: { value: '100' } })
    fireEvent.click(screen.getByRole('button', { name: 'セット追加' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Reps')
    expect(await db.workoutSets.count()).toBe(0)
  })
})
