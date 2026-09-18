// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import WeeklyPage from './WeeklyPage'
import { db } from '../db/db'
import { createExercise } from '../db/exercises'
import { addExerciseSession } from '../db/sessions'
import { addSet } from '../db/sets'
import { startWorkout } from '../db/workouts'
import { todayLocalDate } from '../lib/time'
import { formatWeekRange, weekStartOf } from '../lib/week'

beforeEach(async () => {
  await Promise.all([db.workoutSets.clear(), db.exerciseSessions.clear(), db.workouts.clear(), db.exercises.clear()])
})

function renderPage(path = '/history/weekly') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/history/weekly" element={<WeeklyPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('WeeklyPage', () => {
  it('対象・指標・範囲を切り替えられ、表に今週の合計が出る', async () => {
    const dl = await createExercise({ name: 'Deadlift', muscles: ['脊柱起立筋'] })
    const w = await startWorkout({})
    const s = await addExerciseSession(w.id, dl.id)
    await addSet(s.id, { weightKg: 200, reps: 5, durationSec: null })
    await addSet(s.id, { weightKg: 200, reps: 5, durationSec: null })

    renderPage()
    await screen.findByRole('heading', { level: 1, name: '週ごとの集計' })
    const metricGroup = await screen.findByRole('group', { name: '指標' })
    expect(within(metricGroup).getAllByRole('button').map((b) => b.textContent)).toEqual(['ボリューム', 'セット数', '回数', 'トレーニング日数'])
    expect(screen.getByText('全種目 の週ごとのボリューム（kg）')).toBeInTheDocument()

    // 表: 今週の行にボリューム 2,000・セット 2
    const thisWeekRow = screen.getByText(formatWeekRange(weekStartOf(todayLocalDate()))).closest('tr')!
    expect(thisWeekRow).toHaveTextContent('2,000')
    expect(within(thisWeekRow).getAllByRole('cell')).toHaveLength(5)

    fireEvent.click(within(metricGroup).getByRole('button', { name: 'セット数' }))
    expect(screen.getByText('全種目 の週ごとのセット数（セット）')).toBeInTheDocument()

    fireEvent.click(within(screen.getByRole('group', { name: '範囲' })).getByRole('button', { name: '26週' }))
    expect(screen.getAllByRole('row')).toHaveLength(27) // ヘッダー + 26 週

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: `e:${dl.id}` } })
    expect(await screen.findByText('Deadlift の週ごとのセット数（セット）')).toBeInTheDocument()
    fireEvent.change(select, { target: { value: 'm:脊柱起立筋' } })
    expect(await screen.findByText('脊柱起立筋 の週ごとのセット数（セット）')).toBeInTheDocument()
  })

  it('URL の muscle 指定で部位に絞った状態で開く', async () => {
    const pull = await createExercise({ name: 'Pull Up', muscles: ['広背筋'], usesBodyweight: true })
    const w = await startWorkout({ bodyweightKg: 70 })
    const s = await addExerciseSession(w.id, pull.id)
    await addSet(s.id, { weightKg: 0, reps: 10, durationSec: null })
    renderPage('/history/weekly?muscle=%E5%BA%83%E8%83%8C%E7%AD%8B')
    expect(await screen.findByText('広背筋 の週ごとのボリューム（kg）')).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toHaveValue('m:広背筋')
    const row = screen.getByText(formatWeekRange(weekStartOf(todayLocalDate()))).closest('tr')!
    expect(row).toHaveTextContent('700') // 70×10
  })
})
