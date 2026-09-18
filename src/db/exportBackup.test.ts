import { afterEach, describe, expect, it } from 'vitest'
import { SCHEMA_VERSION, WorkoutLogDB } from './db'
import { buildBackup, countRecords, parseBackup, restoreBackup, upgradeBackup } from './export'
import { seedTwoWorkouts } from './exportFixture'
import { createExercise } from './exercises'

const dbs: WorkoutLogDB[] = []
function freshDb(): WorkoutLogDB {
  const database = new WorkoutLogDB(`test-${crypto.randomUUID()}`)
  dbs.push(database)
  return database
}
afterEach(async () => {
  for (const database of dbs.splice(0)) await database.delete()
})

const byId = <T extends { id: string }>(rows: T[]) => [...rows].sort((a, b) => a.id.localeCompare(b.id))

describe('backup / restore', () => {
  it('書き出し → 別 DB に復元で全レコードが一致する（復元先の既存データは置き換わる）', async () => {
    const source = freshDb()
    await seedTwoWorkouts(source)
    const backup = await buildBackup('abc1234', source)
    expect(backup).toMatchObject({ app: 'workout-log', schemaVersion: SCHEMA_VERSION, buildId: 'abc1234' })
    expect(backup.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)

    const target = freshDb()
    await createExercise({ name: 'Should Be Replaced', muscles: [] }, target)
    const parsed = parseBackup(JSON.stringify(backup))
    const counts = await restoreBackup(parsed, target)
    expect(counts).toEqual({ exercises: 2, workouts: 2, exerciseSessions: 2, workoutSets: 3 })
    expect(await countRecords(target)).toEqual(counts)
    expect(byId(await target.exercises.toArray())).toEqual(byId(await source.exercises.toArray()))
    expect(byId(await target.workouts.toArray())).toEqual(byId(await source.workouts.toArray()))
    expect(byId(await target.exerciseSessions.toArray())).toEqual(byId(await source.exerciseSessions.toArray()))
    expect(byId(await target.workoutSets.toArray())).toEqual(byId(await source.workoutSets.toArray()))
  })

  it('壊れた・別物・版違いのファイルは日本語のメッセージで拒否する', () => {
    const v = SCHEMA_VERSION
    const tables = { exercises: [], workouts: [], exerciseSessions: [], workoutSets: [] }
    expect(() => parseBackup('{not json')).toThrow('JSON として読めませんでした')
    expect(() => parseBackup(JSON.stringify({ app: 'other' }))).toThrow('このアプリのバックアップではありません')
    expect(() => parseBackup(JSON.stringify({ app: 'workout-log', schemaVersion: v + 1, tables }))).toThrow('新しい形式')
    expect(() => parseBackup(JSON.stringify({ app: 'workout-log', schemaVersion: 1, tables }))).toThrow('古い形式')
    expect(() => parseBackup(JSON.stringify({ app: 'workout-log', schemaVersion: v }))).toThrow('テーブルがありません')
    const broken = { app: 'workout-log', schemaVersion: v, tables: { ...tables, exercises: [{ name: 'no id' }] } }
    expect(() => parseBackup(JSON.stringify(broken))).toThrow('exercises')
  })

  it('版 2 のバックアップは usesBodyweight を補って現在の版として読める', async () => {
    const source = freshDb()
    await seedTwoWorkouts(source)
    const backup = await buildBackup('old', source)
    const v2 = {
      ...backup,
      schemaVersion: 2,
      tables: {
        ...backup.tables,
        exercises: backup.tables.exercises.map((e) => {
          const copy: Record<string, unknown> = { ...e }
          delete copy.usesBodyweight
          return copy
        }),
      },
    }
    const parsed = parseBackup(JSON.stringify(v2))
    expect(parsed.schemaVersion).toBe(SCHEMA_VERSION)
    expect(parsed.tables.exercises.every((e) => e.usesBodyweight === false)).toBe(true)
    expect(upgradeBackup(backup)).toBe(backup)

    const target = freshDb()
    await restoreBackup(parsed, target)
    expect((await target.exercises.toArray()).map((e) => e.usesBodyweight)).toEqual([false, false])
  })

  it('復元中に失敗したら元のデータが残る（id 重複で bulkAdd が失敗）', async () => {
    const database = freshDb()
    const kept = await createExercise({ name: 'Keep Me', muscles: [] }, database)
    const bad = await buildBackup('x', database)
    bad.tables.exercises = [kept, { ...kept }]
    await expect(restoreBackup(bad, database)).rejects.toBeTruthy()
    expect((await database.exercises.toArray()).map((e) => e.name)).toEqual(['Keep Me'])
  })
})
