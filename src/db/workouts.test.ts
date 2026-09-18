import { afterEach, describe, expect, it } from 'vitest'
import { WorkoutLogDB } from './db'
import { createExercise } from './exercises'
import { addExerciseSession, deleteExerciseSession, listSessions } from './sessions'
import { addSet, deleteSet, listSets, updateSet } from './sets'
import { deleteWorkout, finishWorkout, getActiveWorkout, startWorkout } from './workouts'
import { todayLocalDate } from '../lib/time'

const dbs: WorkoutLogDB[] = []
function freshDb(): WorkoutLogDB {
  const database = new WorkoutLogDB(`test-${crypto.randomUUID()}`)
  dbs.push(database)
  return database
}
afterEach(async () => {
  for (const database of dbs.splice(0)) await database.delete()
})

async function setup(database: WorkoutLogDB) {
  const exercise = await createExercise({ name: 'Deadlift', category: 'back' }, database)
  const workout = await startWorkout({}, database)
  const session = await addExerciseSession(workout.id, exercise.id, database)
  return { exercise, workout, session }
}

describe('startWorkout / getActiveWorkout', () => {
  it('今日の日付で進行中の Workout を作る', async () => {
    const database = freshDb()
    const w = await startWorkout({ bodyweightKg: 72.5, memo: 'test' }, database)
    expect(w.date).toBe(todayLocalDate())
    expect(w.endedAt).toBe(null)
    expect(w.bodyweightKg).toBe(72.5)
    expect((await getActiveWorkout(database))?.id).toBe(w.id)
  })

  it('進行中のものがあれば自動で閉じる（セットなし → 開始時刻で終了）', async () => {
    const database = freshDb()
    const first = await startWorkout({}, database)
    const second = await startWorkout({ date: '2026-09-19' }, database)
    const closed = await database.workouts.get(first.id)
    expect(closed!.endedAt).toBe(first.startedAt)
    expect((await getActiveWorkout(database))?.id).toBe(second.id)
  })

  it('自動で閉じるとき、セットがあれば最後のセットの時刻で終了する', async () => {
    const database = freshDb()
    const { workout, session } = await setup(database)
    const set = await addSet(session.id, { weightKg: 100, reps: 5 }, database)
    await startWorkout({}, database)
    expect((await database.workouts.get(workout.id))!.endedAt).toBe(set.createdAt)
  })

  it('不正な入力を拒否する', async () => {
    const database = freshDb()
    await expect(startWorkout({ bodyweightKg: -1 }, database)).rejects.toThrow('体重')
    await expect(startWorkout({ date: '2026/09/18' }, database)).rejects.toThrow('日付')
  })

  it('finishWorkout で終了し、進行中が無くなる', async () => {
    const database = freshDb()
    const w = await startWorkout({}, database)
    await finishWorkout(w.id, database)
    expect((await database.workouts.get(w.id))!.endedAt).not.toBe(null)
    expect(await getActiveWorkout(database)).toBeUndefined()
  })
})

describe('sessions', () => {
  it('order は 1 から増え、削除すると振り直される（配下のセットも消える）', async () => {
    const database = freshDb()
    const { exercise, workout, session: s1 } = await setup(database)
    const s2 = await addExerciseSession(workout.id, exercise.id, database)
    const s3 = await addExerciseSession(workout.id, exercise.id, database)
    expect([s1.order, s2.order, s3.order]).toEqual([1, 2, 3])
    await addSet(s2.id, { weightKg: 100, reps: 5 }, database)

    await deleteExerciseSession(s2.id, database)
    const rest = await listSessions(workout.id, database)
    expect(rest.map((s) => [s.id, s.order])).toEqual([
      [s1.id, 1],
      [s3.id, 2],
    ])
    expect(await database.workoutSets.where('exerciseSessionId').equals(s2.id).count()).toBe(0)
  })
})

describe('sets', () => {
  it('setNumber は 1 から増え、削除すると振り直される', async () => {
    const database = freshDb()
    const { session } = await setup(database)
    const a = await addSet(session.id, { weightKg: 220, reps: 5 }, database)
    const b = await addSet(session.id, { weightKg: 220, reps: 5 }, database)
    const c = await addSet(session.id, { weightKg: 225, reps: 3 }, database)
    expect([a.setNumber, b.setNumber, c.setNumber]).toEqual([1, 2, 3])

    await deleteSet(b.id, database)
    const rest = await listSets(session.id, database)
    expect(rest.map((s) => [s.id, s.setNumber])).toEqual([
      [a.id, 1],
      [c.id, 2],
    ])
  })

  it('updateSet で値を変え、不正な値は拒否する', async () => {
    const database = freshDb()
    const { session } = await setup(database)
    const a = await addSet(session.id, { weightKg: 220, reps: 5 }, database)
    await updateSet(a.id, { weightKg: 222.5, memo: 'belt' }, database)
    expect(await database.workoutSets.get(a.id)).toMatchObject({ weightKg: 222.5, reps: 5, memo: 'belt' })
    await expect(updateSet(a.id, { reps: 0 }, database)).rejects.toThrow('Reps')
    await expect(addSet(session.id, { weightKg: -1, reps: 5 }, database)).rejects.toThrow('重量')
    await expect(addSet(session.id, { weightKg: 100, reps: 2.5 }, database)).rejects.toThrow('Reps')
  })

  it('自重種目の 0 kg を許容する', async () => {
    const database = freshDb()
    const { session } = await setup(database)
    await expect(addSet(session.id, { weightKg: 0, reps: 12 }, database)).resolves.toMatchObject({ weightKg: 0 })
  })
})

describe('deleteWorkout', () => {
  it('配下の種目とセットをすべて削除する', async () => {
    const database = freshDb()
    const { workout, session } = await setup(database)
    await addSet(session.id, { weightKg: 100, reps: 5 }, database)
    await addSet(session.id, { weightKg: 100, reps: 5 }, database)
    await deleteWorkout(workout.id, database)
    expect(await database.workouts.count()).toBe(0)
    expect(await database.exerciseSessions.count()).toBe(0)
    expect(await database.workoutSets.count()).toBe(0)
  })
})
