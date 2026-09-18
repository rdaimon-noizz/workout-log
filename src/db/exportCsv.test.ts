import { afterEach, describe, expect, it } from 'vitest'
import { WorkoutLogDB } from './db'
import { CSV_COLUMNS, buildCsvRows, exportCsv } from './export'
import { seedTwoWorkouts } from './exportFixture'
import { createExercise } from './exercises'
import { addExerciseSession } from './sessions'
import { addSet } from './sets'
import { startWorkout } from './workouts'
import { CSV_BOM } from '../lib/csv'
import { combineLocalDateTime } from '../lib/time'

const dbs: WorkoutLogDB[] = []
function freshDb(): WorkoutLogDB {
  const database = new WorkoutLogDB(`test-${crypto.randomUUID()}`)
  dbs.push(database)
  return database
}
afterEach(async () => {
  for (const database of dbs.splice(0)) await database.delete()
})

const col = (name: (typeof CSV_COLUMNS)[number]) => CSV_COLUMNS.indexOf(name)

describe('buildCsvRows', () => {
  it('19 列固定のヘッダーと、Workout の古い順・種目 order・setNumber 順の行を返す', async () => {
    const database = freshDb()
    const { dl, plank, w1, w2, s1, s2 } = await seedTwoWorkouts(database)
    const rows = await buildCsvRows(database)
    expect(rows[0]).toEqual([...CSV_COLUMNS])
    expect(rows[0]).toHaveLength(21)
    expect(rows).toHaveLength(4)

    // 1 行目 = 9/10 のプランク（秒だけ・体重なし・reps 空・進行中なので ended_at 空）
    expect(rows[1][col('date')]).toBe('2026-09-10')
    expect(rows[1][col('workout_id')]).toBe(w1.id)
    expect(rows[1][col('ended_at')]).toBe('')
    expect(rows[1][col('bodyweight_kg')]).toBe('')
    expect(rows[1][col('exercise_id')]).toBe(plank.id)
    expect(rows[1][col('exercise')]).toBe('Plank')
    expect(rows[1][col('exercise_muscles')]).toBe('腹直筋')
    expect(rows[1][col('exercise_session_id')]).toBe(s1.id)
    expect(rows[1][col('exercise_memo')]).toBe('体幹')
    expect(rows[1][col('weight_kg')]).toBe('0')
    expect(rows[1][col('reps')]).toBe('')
    expect(rows[1][col('duration_sec')]).toBe('60')

    // 2〜3 行目 = 9/18 のデッドリフト
    expect(rows[2][col('workout_id')]).toBe(w2.id)
    expect(rows[2][col('bodyweight_kg')]).toBe('72.5')
    expect(rows[2][col('workout_memo')]).toBe('memo, with "quotes"\nand newline')
    expect(rows[2][col('exercise_id')]).toBe(dl.id)
    expect(rows[2][col('exercise_muscles')]).toBe('脊柱起立筋;ハムストリング')
    expect(rows[2][col('exercise_order')]).toBe('1')
    expect(rows[2][col('exercise_session_id')]).toBe(s2.id)
    expect([rows[2][col('set_number')], rows[3][col('set_number')]]).toEqual(['1', '2'])
    expect([rows[2][col('weight_kg')], rows[2][col('reps')], rows[2][col('set_memo')]]).toEqual(['220', '5', 'belt'])
    expect([rows[3][col('weight_kg')], rows[3][col('reps')], rows[3][col('duration_sec')]]).toEqual(['200', '3', '2'])
    expect(rows[2][col('started_at')]).toMatch(/^2026-09-18T19:00:00/)
    expect(rows[2][col('ended_at')]).not.toBe('')
    // 通常種目: 自重フラグ 0、負荷 = 重量
    expect([rows[2][col('is_bodyweight_exercise')], rows[2][col('load_kg')]]).toEqual(['0', '220'])
    expect([rows[1][col('is_bodyweight_exercise')], rows[1][col('load_kg')]]).toEqual(['0', '0'])
    expect(rows[2][col('set_created_at')]).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('自重種目は is_bodyweight_exercise = 1、load_kg = 体重 + 加重（体重は直近の記録で補い、無ければ空）', async () => {
    const database = freshDb()
    const pullUp = await createExercise({ name: 'Pull Up', muscles: ['広背筋'], usesBodyweight: true }, database)
    const w0 = await startWorkout({ date: '2026-09-05', startedAt: combineLocalDateTime('2026-09-05', '10:00') }, database)
    const s0 = await addExerciseSession(w0.id, pullUp.id, database)
    await addSet(s0.id, { weightKg: 0, reps: 5, durationSec: null }, database)
    const w1 = await startWorkout({ date: '2026-09-10', startedAt: combineLocalDateTime('2026-09-10', '10:00'), bodyweightKg: 70 }, database)
    const s1 = await addExerciseSession(w1.id, pullUp.id, database)
    await addSet(s1.id, { weightKg: 0, reps: 8, durationSec: null }, database)
    await addSet(s1.id, { weightKg: 10, reps: 5, durationSec: null }, database)
    const w2 = await startWorkout({ date: '2026-09-12', startedAt: combineLocalDateTime('2026-09-12', '10:00') }, database)
    const s2 = await addExerciseSession(w2.id, pullUp.id, database)
    await addSet(s2.id, { weightKg: 5, reps: 6, durationSec: null }, database)

    const rows = await buildCsvRows(database)
    const pick = (r: string[]) => [r[col('date')], r[col('bodyweight_kg')], r[col('weight_kg')], r[col('is_bodyweight_exercise')], r[col('load_kg')]]
    expect(rows.slice(1).map(pick)).toEqual([
      ['2026-09-05', '', '0', '1', ''],
      ['2026-09-10', '70', '0', '1', '70'],
      ['2026-09-10', '70', '10', '1', '80'],
      ['2026-09-12', '', '5', '1', '75'],
    ])
  })

  it('セットが無ければヘッダーだけ', async () => {
    const database = freshDb()
    expect(await buildCsvRows(database)).toEqual([[...CSV_COLUMNS]])
  })
})

describe('exportCsv', () => {
  it('BOM で始まり CRLF 区切りで、メモのカンマ・引用符・改行が引用される', async () => {
    const database = freshDb()
    await seedTwoWorkouts(database)
    const csv = await exportCsv(database)
    expect(csv.startsWith(CSV_BOM + 'date,workout_id,')).toBe(true)
    expect(csv).toContain('"memo, with ""quotes""\nand newline"')
    // 引用部分を除けば、行区切りは CRLF だけ（5 行 = ヘッダー + 3 行 + 末尾改行）
    const body = csv.slice(1).replace(/"[^"]*(?:""[^"]*)*"/g, 'Q')
    expect(body.split('\r\n')).toHaveLength(5)
    expect(body.replace(/\r\n/g, '')).not.toContain('\n')
  })
})
