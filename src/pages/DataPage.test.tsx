// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DataPage from './DataPage'
import { db } from '../db/db'
import { buildBackup } from '../db/export'
import { createExercise } from '../db/exercises'
import { startWorkout } from '../db/workouts'

beforeEach(async () => {
  await Promise.all([db.workoutSets.clear(), db.exerciseSessions.clear(), db.workouts.clear(), db.exercises.clear()])
})
afterEach(() => {
  vi.restoreAllMocks()
})

function renderPage() {
  return render(
    <MemoryRouter>
      <DataPage />
    </MemoryRouter>,
  )
}

describe('DataPage', () => {
  it('件数と書き出し・復元の操作を表示する', async () => {
    await createExercise({ name: 'Deadlift', muscles: [] })
    await createExercise({ name: 'Squat', muscles: [] })
    await startWorkout({})
    renderPage()
    // 種目 2 件・トレーニング 1 件・セット 0 件
    expect(await screen.findByText('2 件', { selector: 'dd' })).toBeInTheDocument()
    expect(screen.getByText('1 件', { selector: 'dd' })).toBeInTheDocument()
    expect(screen.getByText('0 件', { selector: 'dd' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'CSV を書き出す' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'JSON バックアップを書き出す' })).toBeInTheDocument()
    expect(screen.getByLabelText('復元するバックアップファイル')).toHaveAttribute('accept', '.json,application/json')
  })

  it('JSON バックアップを選ぶと確認のうえ全データを置き換える', async () => {
    await createExercise({ name: 'From Backup', muscles: ['広背筋'] })
    const backup = await buildBackup('test')
    await db.exercises.clear()
    await createExercise({ name: 'Current', muscles: [] })
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderPage()
    const input = await screen.findByLabelText('復元するバックアップファイル')
    const file = new File([JSON.stringify(backup)], 'workout-log_backup.json', { type: 'application/json' })
    fireEvent.change(input, { target: { files: [file] } })

    expect(await screen.findByRole('status')).toHaveTextContent('復元しました')
    expect(window.confirm).toHaveBeenCalledTimes(1)
    await waitFor(async () => {
      expect((await db.exercises.toArray()).map((e) => e.name)).toEqual(['From Backup'])
    })
  })

  it('壊れたファイルはエラーを表示し、データを変えない', async () => {
    await createExercise({ name: 'Current', muscles: [] })
    renderPage()
    const input = await screen.findByLabelText('復元するバックアップファイル')
    fireEvent.change(input, { target: { files: [new File(['{broken'], 'x.json', { type: 'application/json' })] } })
    expect(await screen.findByRole('alert')).toHaveTextContent('JSON として読めませんでした')
    expect((await db.exercises.toArray()).map((e) => e.name)).toEqual(['Current'])
  })
})
