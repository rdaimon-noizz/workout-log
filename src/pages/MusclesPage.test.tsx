// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import MusclesPage from './MusclesPage'
import { db } from '../db/db'
import { createExercise } from '../db/exercises'
import { addExerciseSession } from '../db/sessions'
import { addSet } from '../db/sets'
import { startWorkout } from '../db/workouts'
import { combineLocalDateTime, todayLocalDate } from '../lib/time'
import { addWeeks, formatWeekRange, weekStartOf } from '../lib/week'

beforeEach(async () => {
  await Promise.all([db.workoutSets.clear(), db.exerciseSessions.clear(), db.workouts.clear(), db.exercises.clear()])
})

function LocationProbe() {
  return null
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/history/muscles']}>
      <Routes>
        <Route path="/history/muscles" element={<MusclesPage />} />
        <Route path="/history/weekly" element={<h1>週ごとの集計（遷移先）<LocationProbe /></h1>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('MusclesPage', () => {
  it('今週の部位別を横棒で並べ、前の週へ移動でき、行タップで週ごとの集計へ遷移する', async () => {
    const dl = await createExercise({ name: 'Deadlift', muscles: ['脊柱起立筋', 'ハムストリング'] })
    const pull = await createExercise({ name: 'Pull Up', muscles: ['広背筋'], usesBodyweight: true })
    const w = await startWorkout({ bodyweightKg: 70 })
    const s1 = await addExerciseSession(w.id, dl.id)
    await addSet(s1.id, { weightKg: 200, reps: 5, durationSec: null })
    await addSet(s1.id, { weightKg: 200, reps: 5, durationSec: null })
    const s2 = await addExerciseSession(w.id, pull.id)
    await addSet(s2.id, { weightKg: 0, reps: 10, durationSec: null })
    // 先週の記録
    const lastWeekDate = addWeeks(weekStartOf(todayLocalDate()), -1)
    // 体重は過去方向にしか補わないので、先週の Workout には体重を入れる
    const old = await startWorkout({ date: lastWeekDate, startedAt: combineLocalDateTime(lastWeekDate, '10:00'), bodyweightKg: 70 })
    const s3 = await addExerciseSession(old.id, pull.id)
    await addSet(s3.id, { weightKg: 0, reps: 8, durationSec: null })

    renderPage()
    await screen.findByRole('heading', { level: 1, name: '部位別（週）' })
    expect(await screen.findByText(formatWeekRange(weekStartOf(todayLocalDate())))).toBeInTheDocument()
    expect(screen.getByText('今週')).toBeInTheDocument()
    // 合計は重複なし: 3 セット、2000 + 700 = 2,700 kg、1 日
    expect(await screen.findByText('3 セット・2,700 kg・1 日')).toBeInTheDocument()

    const items = screen.getAllByRole('listitem')
    expect(items.map((li) => within(li).getByRole('button').textContent)).toEqual([
      'ハムストリング2 セット・2,000 kg',
      '脊柱起立筋2 セット・2,000 kg',
      '広背筋1 セット・700 kg',
    ])
    expect(screen.getByRole('button', { name: '次の週' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: '前の週' }))
    expect(await screen.findByText(formatWeekRange(lastWeekDate))).toBeInTheDocument()
    expect(screen.getByText('今週に戻る')).toBeInTheDocument()
    expect(await screen.findByText('1 セット・560 kg・1 日')).toBeInTheDocument() // 70×8
    expect(screen.getAllByRole('listitem')).toHaveLength(1)

    fireEvent.click(within(screen.getAllByRole('listitem')[0]).getByRole('button'))
    expect(await screen.findByRole('heading', { level: 1, name: /週ごとの集計/ })).toBeInTheDocument()
  })

  it('記録の無い週の表示', async () => {
    renderPage()
    await screen.findByRole('heading', { level: 1, name: '部位別（週）' })
    expect(await screen.findByText('この週の記録はありません')).toBeInTheDocument()
    expect(screen.getByText('0 セット・0 kg・0 日')).toBeInTheDocument()
  })
})
