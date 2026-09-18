import { afterEach, describe, expect, it } from 'vitest'
import { WorkoutLogDB } from './db'
import { createExercise, archiveExercise } from './exercises'
import { findPreviousRecord, listExercisesWithHistory, listWorkoutSummaries, loadExerciseHistory } from './history'
import { addExerciseSession } from './sessions'
import { addSet } from './sets'
import { startWorkout } from './workouts'
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

/** date と HH:mm を指定して Workout を作る */
function workoutAt(database: WorkoutLogDB, date: string, time: string) {
  return startWorkout({ date, startedAt: combineLocalDateTime(date, time) }, database)
}

describe('findPreviousRecord', () => {
  it('current より前の最新 Workout の、最後のセッションを返す（同一 Workout 内の再登場は除く）', async () => {
    const database = freshDb()
    const dl = await createExercise({ name: 'Deadlift', muscles: [] }, database)
    const w1 = await workoutAt(database, '2026-09-10', '10:00')
    const s1 = await addExerciseSession(w1.id, dl.id, database)
    await addSet(s1.id, { weightKg: 200, reps: 5, durationSec: null }, database)
    const w2 = await workoutAt(database, '2026-09-15', '10:00')
    const s2a = await addExerciseSession(w2.id, dl.id, database)
    await addSet(s2a.id, { weightKg: 210, reps: 5, durationSec: null }, database)
    const s2b = await addExerciseSession(w2.id, dl.id, database)
    await addSet(s2b.id, { weightKg: 180, reps: 8, durationSec: null }, database)
    const w3 = await workoutAt(database, '2026-09-18', '10:00')
    const s3 = await addExerciseSession(w3.id, dl.id, database)
    await addSet(s3.id, { weightKg: 220, reps: 3, durationSec: null }, database)

    const prev = await findPreviousRecord(dl.id, w3, database)
    expect(prev?.workout.id).toBe(w2.id)
    expect(prev?.session.id).toBe(s2b.id)
    expect(prev?.sets.map((s) => s.weightKg)).toEqual([180])
    expect(await findPreviousRecord(dl.id, w1, database)).toBeUndefined()
  })

  it('同じ日付なら開始時刻で前後を判定する', async () => {
    const database = freshDb()
    const dl = await createExercise({ name: 'Deadlift', muscles: [] }, database)
    const am = await workoutAt(database, '2026-09-15', '07:00')
    const sAm = await addExerciseSession(am.id, dl.id, database)
    await addSet(sAm.id, { weightKg: 100, reps: 5, durationSec: null }, database)
    const pm = await workoutAt(database, '2026-09-15', '19:00')
    await addExerciseSession(pm.id, dl.id, database)
    expect((await findPreviousRecord(dl.id, pm, database))?.workout.id).toBe(am.id)
    expect(await findPreviousRecord(dl.id, am, database)).toBeUndefined()
  })
})

describe('loadExerciseHistory', () => {
  it('Workout ごとの最高重量と、その重量での最大 reps を古い順に返す。セットの無いセッションは除く', async () => {
    const database = freshDb()
    const dl = await createExercise({ name: 'Deadlift', muscles: [] }, database)
    const w1 = await workoutAt(database, '2026-09-10', '10:00')
    const s1 = await addExerciseSession(w1.id, dl.id, database)
    await addSet(s1.id, { weightKg: 200, reps: 5, durationSec: null }, database)
    await addSet(s1.id, { weightKg: 200, reps: 7, durationSec: null }, database)
    await addSet(s1.id, { weightKg: 180, reps: 10, durationSec: null }, database)
    const w2 = await workoutAt(database, '2026-09-15', '10:00')
    await addExerciseSession(w2.id, dl.id, database) // セットなし
    const w3 = await workoutAt(database, '2026-09-18', '10:00')
    const s3 = await addExerciseSession(w3.id, dl.id, database)
    await addSet(s3.id, { weightKg: 0, reps: null, durationSec: 60 }, database)

    const h = await loadExerciseHistory(dl.id, database)
    expect(h.exercise?.name).toBe('Deadlift')
    expect(h.entries.map((e) => e.workout.id)).toEqual([w3.id, w1.id])
    expect(h.points.map((p) => [p.date, p.maxWeightKg, p.repsAtMax, p.durationAtMax])).toEqual([
      ['2026-09-10', 200, 7, null],
      ['2026-09-18', 0, null, 60],
    ])
  })

  it('記録が無ければ空', async () => {
    const database = freshDb()
    const dl = await createExercise({ name: 'Deadlift', muscles: [] }, database)
    expect(await loadExerciseHistory(dl.id, database)).toEqual({ exercise: expect.objectContaining({ id: dl.id }), entries: [], points: [] })
  })
})

describe('listWorkoutSummaries / listExercisesWithHistory', () => {
  it('Workout を新しい順に、種目名とセット数付きで返す', async () => {
    const database = freshDb()
    const dl = await createExercise({ name: 'Deadlift', muscles: [] }, database)
    const bp = await createExercise({ name: 'Bench Press', muscles: [] }, database)
    const w1 = await workoutAt(database, '2026-09-10', '10:00')
    const s1 = await addExerciseSession(w1.id, dl.id, database)
    await addSet(s1.id, { weightKg: 200, reps: 5, durationSec: null }, database)
    const w2 = await workoutAt(database, '2026-09-15', '10:00')
    const s2 = await addExerciseSession(w2.id, bp.id, database)
    const s2b = await addExerciseSession(w2.id, dl.id, database)
    await addSet(s2.id, { weightKg: 100, reps: 5, durationSec: null }, database)
    await addSet(s2b.id, { weightKg: 200, reps: 5, durationSec: null }, database)

    const list = await listWorkoutSummaries(database)
    expect(list.map((x) => [x.workout.id, x.exerciseNames, x.setCount])).toEqual([
      [w2.id, ['Bench Press', 'Deadlift'], 2],
      [w1.id, ['Deadlift'], 1],
    ])
  })

  it('種目別の入口: 記録のある種目が最後に行った日の新しい順、記録の無い有効種目も含む。アーカイブ済みは記録があれば含む', async () => {
    const database = freshDb()
    const dl = await createExercise({ name: 'Deadlift', muscles: [] }, database)
    const bp = await createExercise({ name: 'Bench Press', muscles: [] }, database)
    const sq = await createExercise({ name: 'Squat', muscles: [] }, database)
    const old = await createExercise({ name: 'Old Move', muscles: [] }, database)
    const none = await createExercise({ name: 'Never Done Archived', muscles: [] }, database)
    const w1 = await workoutAt(database, '2026-09-10', '10:00')
    await addExerciseSession(w1.id, dl.id, database)
    await addExerciseSession(w1.id, old.id, database)
    const w2 = await workoutAt(database, '2026-09-15', '10:00')
    await addExerciseSession(w2.id, bp.id, database)
    await addExerciseSession(w2.id, dl.id, database)
    await archiveExercise(old.id, database)
    await archiveExercise(none.id, database)

    const list = await listExercisesWithHistory(database)
    expect(list.map((x) => [x.exercise.name, x.workoutCount, x.lastDate])).toEqual([
      ['Bench Press', 1, '2026-09-15'],
      ['Deadlift', 2, '2026-09-15'],
      ['Old Move', 1, '2026-09-10'],
      ['Squat', 0, null],
    ])
    expect(list.some((x) => x.exercise.id === sq.id)).toBe(true)
  })
})
