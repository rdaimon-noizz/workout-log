// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import ExercisesPage from './ExercisesPage'
import { db } from '../db/db'
import { createExercise } from '../db/exercises'

let exerciseId = ''

beforeEach(async () => {
  await Promise.all([db.workoutSets.clear(), db.exerciseSessions.clear(), db.workouts.clear(), db.exercises.clear()])
  const ex = await createExercise({ name: 'Lat Pulldown', muscles: ['広背筋'] })
  exerciseId = ex.id
})

function renderPage() {
  return render(
    <MemoryRouter>
      <ExercisesPage />
    </MemoryRouter>,
  )
}

describe('ExercisesPage', () => {
  it('既存の種目をタップすると部位が選択済みの編集シートが開き、部位を足して保存できる', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: /Lat Pulldown/ }))
    const dialog = await screen.findByRole('dialog', { name: '種目を編集' })
    expect(within(dialog).getByLabelText('種目名')).toHaveValue('Lat Pulldown')
    expect(within(dialog).getByRole('button', { name: '広背筋', pressed: true })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: '僧帽筋', pressed: false })).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: '僧帽筋' }))
    expect(within(dialog).getByRole('button', { name: '僧帽筋', pressed: true })).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: '保存' }))

    await waitFor(async () => {
      expect((await db.exercises.get(exerciseId))!.muscles).toEqual(['広背筋', '僧帽筋'])
    })
    expect(await screen.findByText('広背筋・僧帽筋')).toBeInTheDocument()
  })

  it('候補にない部位を自由入力で追加すると選択済みのチップになり、保存後は候補に残る', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: /Lat Pulldown/ }))
    const dialog = await screen.findByRole('dialog', { name: '種目を編集' })
    fireEvent.change(within(dialog).getByLabelText('候補にない部位を追加'), { target: { value: ' 前鋸筋 ' } })
    fireEvent.click(within(dialog).getByRole('button', { name: '追加' }))
    expect(within(dialog).getByRole('button', { name: '前鋸筋', pressed: true })).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: '保存' }))

    await waitFor(async () => {
      expect((await db.exercises.get(exerciseId))!.muscles).toEqual(['広背筋', '前鋸筋'])
    })
    // 別の種目を作るときにも候補として出る
    fireEvent.click(screen.getByRole('button', { name: '＋ 作成' }))
    const createDialog = await screen.findByRole('dialog', { name: '新しい種目' })
    expect(await within(createDialog).findByRole('button', { name: '前鋸筋', pressed: false })).toBeInTheDocument()
  })
})
