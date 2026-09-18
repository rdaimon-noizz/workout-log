// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import SessionPage from './SessionPage'
import { db } from '../db/db'
import { createExercise } from '../db/exercises'
import { addExerciseSession } from '../db/sessions'
import { startWorkout } from '../db/workouts'
import { addSet } from '../db/sets'
import { combineLocalDateTime } from '../lib/time'

let workoutId = ''
let sessionId = ''
let exerciseId = ''

beforeEach(async () => {
  await Promise.all([db.workoutSets.clear(), db.exerciseSessions.clear(), db.workouts.clear(), db.exercises.clear()])
  const exercise = await createExercise({ name: 'Deadlift', muscles: ['脊柱起立筋'] })
  exerciseId = exercise.id
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

    expect(await screen.findByRole('button', { name: /220 kg × 5/ })).toBeInTheDocument()
    expect(await db.workoutSets.where('exerciseSessionId').equals(sessionId).count()).toBe(1)
    // 追加後も入力値は残り、次のセットを 1 タップで足せる
    expect(screen.getByLabelText('重量')).toHaveValue('220')
    expect(screen.getByLabelText('Reps')).toHaveValue('5')
  })

  it('秒だけのセット（プランク）を追加できる', async () => {
    renderPage()
    await screen.findByRole('heading', { level: 1, name: 'Deadlift' })
    fireEvent.change(screen.getByLabelText('重量'), { target: { value: '0' } })
    fireEvent.change(screen.getByLabelText('秒'), { target: { value: '60' } })
    fireEvent.click(screen.getByRole('button', { name: 'セット追加' }))
    expect(await screen.findByRole('button', { name: /60秒/ })).toBeInTheDocument()
    expect(await db.workoutSets.toArray()).toMatchObject([{ weightKg: 0, reps: null, durationSec: 60 }])
  })

  it('reps も秒も空なら追加せずエラーを出す', async () => {
    renderPage()
    await screen.findByRole('heading', { level: 1, name: 'Deadlift' })
    fireEvent.change(screen.getByLabelText('重量'), { target: { value: '100' } })
    fireEvent.click(screen.getByRole('button', { name: 'セット追加' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Reps か秒')
    expect(await db.workoutSets.count()).toBe(0)
  })

  it('ヘッダーの「種目編集」から種目の部位を変えられる', async () => {
    renderPage()
    await screen.findByRole('heading', { level: 1, name: 'Deadlift' })
    fireEvent.click(screen.getByRole('button', { name: '種目編集' }))
    const dialog = await screen.findByRole('dialog', { name: '種目を編集' })
    expect(within(dialog).getByRole('button', { name: '脊柱起立筋', pressed: true })).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'ハムストリング' }))
    fireEvent.click(within(dialog).getByRole('button', { name: '保存' }))
    await waitFor(async () => {
      expect((await db.exercises.toArray())[0].muscles).toEqual(['脊柱起立筋', 'ハムストリング'])
    })
  })

  it('前回記録が無ければその旨を表示する', async () => {
    renderPage()
    expect(await screen.findByText('前回の記録はありません')).toBeInTheDocument()
  })

  it('前回記録を表示し、セットが無いときは前回の 1 セット目を入力欄の初期値にする', async () => {
    // 現在の Workout より前の Workout に同じ種目の記録を作る
    const past = await startWorkout({ date: '2026-09-10', startedAt: combineLocalDateTime('2026-09-10', '10:00') })
    const pastSession = await addExerciseSession(past.id, exerciseId)
    await addSet(pastSession.id, { weightKg: 100, reps: 8, durationSec: null })
    await addSet(pastSession.id, { weightKg: 105, reps: 6, durationSec: null })
    // startWorkout が今日の Workout を閉じてしまうので、進行中に戻す
    await db.workouts.update(workoutId, { endedAt: null })

    renderPage()
    expect(await screen.findByText('前回：2026/09/10（木）')).toBeInTheDocument()
    expect(screen.getByText('100 kg × 8')).toBeInTheDocument()
    expect(screen.getByText('105 kg × 6')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('重量')).toHaveValue('100'))
    expect(screen.getByLabelText('Reps')).toHaveValue('8')
    expect(screen.getByRole('link', { name: 'この種目の履歴・推移 ›' })).toHaveAttribute('href', `/history/exercises/${exerciseId}`)
  })

  it('数値入力欄は iOS のテンキーが出る属性を持つ', async () => {
    renderPage()
    await screen.findByRole('heading', { level: 1, name: 'Deadlift' })
    expect(screen.getByLabelText('重量')).toHaveAttribute('inputmode', 'decimal')
    expect(screen.getByLabelText('Reps')).toHaveAttribute('inputmode', 'numeric')
    expect(screen.getByLabelText('Reps')).toHaveAttribute('pattern', '[0-9]*')
    expect(screen.getByLabelText('秒')).toHaveAttribute('inputmode', 'numeric')
  })
})
