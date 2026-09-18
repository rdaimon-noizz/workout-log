import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { SCHEMA_VERSION, WorkoutLogDB } from './db'

const names: string[] = []
afterEach(async () => {
  for (const name of names.splice(0)) await Dexie.delete(name)
})

/** 版 1（Phase 1 時点）のスキーマで DB を作り、旧形式のデータを入れる */
async function createLegacyDb(name: string) {
  const legacy = new Dexie(name)
  legacy.version(1).stores({
    exercises: 'id, &nameKey, category',
    workouts: 'id, date, startedAt',
    exerciseSessions: 'id, workoutId, exerciseId, [workoutId+order]',
    workoutSets: 'id, exerciseSessionId, [exerciseSessionId+setNumber]',
  })
  const t = '2026-09-18T10:00:00+09:00'
  await legacy.table('exercises').bulkAdd([
    { id: 'e1', name: 'Deadlift', nameKey: 'deadlift', category: 'back', createdAt: t, updatedAt: t, archivedAt: null },
    { id: 'e2', name: 'Cable Fly', nameKey: 'cable fly', category: 'chest', createdAt: t, updatedAt: t, archivedAt: null },
    { id: 'e3', name: 'Leg Press', nameKey: 'leg press', category: 'legs', createdAt: t, updatedAt: t, archivedAt: t },
  ])
  await legacy.table('workoutSets').add({
    id: 's1',
    exerciseSessionId: 'x1',
    setNumber: 1,
    weightKg: 100,
    reps: 5,
    memo: '',
    createdAt: t,
    updatedAt: t,
  })
  legacy.close()
}

describe('スキーマ版 1 → 2 の移行', () => {
  it('category を部位配列に変換し、セットに durationSec を補う', async () => {
    const name = `test-migration-${crypto.randomUUID()}`
    names.push(name)
    await createLegacyDb(name)

    const database = new WorkoutLogDB(name)
    await database.open()
    expect(database.verno).toBe(SCHEMA_VERSION)

    const deadlift = await database.exercises.get('e1')
    expect(deadlift!.muscles).toEqual(['脊柱起立筋', 'ハムストリング', '大臀筋'])
    expect('category' in deadlift!).toBe(false)
    expect((await database.exercises.get('e2'))!.muscles).toEqual(['大胸筋'])
    expect((await database.exercises.get('e3'))!.muscles).toEqual(['脚'])

    const set = await database.workoutSets.get('s1')
    expect(set).toMatchObject({ weightKg: 100, reps: 5, durationSec: null })

    // multiEntry インデックスで部位から検索できる
    expect((await database.exercises.where('muscles').equals('大臀筋').toArray()).map((e) => e.id)).toEqual(['e1'])
    database.close()
  })
})
