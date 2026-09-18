import { afterEach, describe, expect, it } from 'vitest'
import { WorkoutLogDB } from './db'
import { INITIAL_EXERCISES, ensureSeedExercises } from './seed'
import { toNameKey } from './exercises'
import { newId, nowIso } from '../lib/time'

const dbs: WorkoutLogDB[] = []
function freshDb(): WorkoutLogDB {
  const database = new WorkoutLogDB(`test-${crypto.randomUUID()}`)
  dbs.push(database)
  return database
}

afterEach(async () => {
  for (const database of dbs.splice(0)) {
    await database.delete()
  }
})

describe('ensureSeedExercises', () => {
  it('空の DB に初期種目を投入する', async () => {
    const database = freshDb()
    const inserted = await ensureSeedExercises(database)
    expect(inserted).toBe(INITIAL_EXERCISES.length)
    const rows = await database.exercises.toArray()
    expect(rows.map((e) => e.name).sort()).toEqual([...INITIAL_EXERCISES.map((e) => e.name)].sort())
    expect(rows.find((e) => e.name === 'Deadlift')!.muscles).toEqual(['脊柱起立筋', 'ハムストリング', '大臀筋'])
  })

  it('2 回目は何もしない', async () => {
    const database = freshDb()
    await ensureSeedExercises(database)
    const inserted = await ensureSeedExercises(database)
    expect(inserted).toBe(0)
    expect(await database.exercises.count()).toBe(INITIAL_EXERCISES.length)
  })

  it('ユーザーが種目を残している DB には投入しない', async () => {
    const database = freshDb()
    const now = nowIso()
    await database.exercises.add({
      id: newId(),
      name: 'Pull Up',
      nameKey: toNameKey('Pull Up'),
      muscles: ['広背筋'],
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    })
    const inserted = await ensureSeedExercises(database)
    expect(inserted).toBe(0)
    expect(await database.exercises.count()).toBe(1)
  })
})

describe('nameKey の一意性', () => {
  it('大文字小文字・空白だけが違う名前は同じキーになる', () => {
    expect(toNameKey('  Bench   Press ')).toBe(toNameKey('bench press'))
  })

  it('同じキーの種目は追加できない', async () => {
    const database = freshDb()
    await ensureSeedExercises(database)
    const now = nowIso()
    await expect(
      database.exercises.add({
        id: newId(),
        name: 'deadlift',
        nameKey: toNameKey('deadlift'),
        muscles: ['広背筋'],
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
      }),
    ).rejects.toMatchObject({ name: 'ConstraintError' })
  })
})
