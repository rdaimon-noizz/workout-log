import { afterEach, describe, expect, it } from 'vitest'
import { WorkoutLogDB } from './db'
import { CSV_COLUMNS, buildCsvRows, exportCsv } from './export'
import { seedTwoWorkouts } from './exportFixture'
import { CSV_BOM } from '../lib/csv'

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
    expect(rows[0]).toHaveLength(19)
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
    expect(rows[2][col('set_created_at')]).toMatch(/^\d{4}-\d{2}-\d{2}T/)
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
