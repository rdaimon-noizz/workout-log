import { afterEach, describe, expect, it } from 'vitest'
import { WorkoutLogDB } from './db'
import { createExercise } from './exercises'
import { addExerciseSession, deleteExerciseSession, listSessions, moveExerciseSession, reorderSessions } from './sessions'
import { addSet, deleteSet, listSets, updateSet } from './sets'
import { deleteWorkout, finishWorkout, getActiveWorkout, startWorkout, updateWorkout } from './workouts'
import { combineLocalDateTime, todayLocalDate } from '../lib/time'

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
  const exercise = await createExercise({ name: 'Deadlift', muscles: ['脊柱起立筋'] }, database)
  const workout = await startWorkout({}, database)
  const session = await addExerciseSession(workout.id, exercise.id, database)
  return { exercise, workout, session }
}

describe('startWorkout / getActiveWorkout', () => {
  it('今日の日付・現在時刻で進行中の Workout を作る', async () => {
    const database = freshDb()
    const w = await startWorkout({ bodyweightKg: 72.5, memo: 'test' }, database)
    expect(w.date).toBe(todayLocalDate())
    expect(w.endedAt).toBe(null)
    expect(w.bodyweightKg).toBe(72.5)
    expect((await getActiveWorkout(database))?.id).toBe(w.id)
  })

  it('開始時刻を指定して作れる', async () => {
    const database = freshDb()
    const startedAt = combineLocalDateTime('2026-09-17', '07:15')
    const w = await startWorkout({ date: '2026-09-17', startedAt }, database)
    expect(w.startedAt).toBe(startedAt)
  })

  it('進行中のものがあれば自動で閉じる（セットなし → 開始時刻で終了）', async () => {
    const database = freshDb()
    const first = await startWorkout({}, database)
    const second = await startWorkout({ date: '2026-09-19' }, database)
    expect((await database.workouts.get(first.id))!.endedAt).toBe(first.startedAt)
    expect((await getActiveWorkout(database))?.id).toBe(second.id)
  })

  it('自動で閉じるとき、セットがあれば最後のセットの時刻で終了する', async () => {
    const database = freshDb()
    const { workout, session } = await setup(database)
    const set = await addSet(session.id, { weightKg: 100, reps: 5, durationSec: null }, database)
    await startWorkout({}, database)
    expect((await database.workouts.get(workout.id))!.endedAt).toBe(set.createdAt)
  })

  it('不正な入力を拒否する', async () => {
    const database = freshDb()
    await expect(startWorkout({ bodyweightKg: -1 }, database)).rejects.toThrow('体重')
    await expect(startWorkout({ date: '2026/09/18' }, database)).rejects.toThrow('日付')
    await expect(startWorkout({ startedAt: '2026-09-18 19:30' }, database)).rejects.toThrow('開始時刻')
  })

  it('finishWorkout で終了し、進行中が無くなる', async () => {
    const database = freshDb()
    const w = await startWorkout({}, database)
    await finishWorkout(w.id, database)
    expect((await database.workouts.get(w.id))!.endedAt).not.toBe(null)
    expect(await getActiveWorkout(database)).toBeUndefined()
  })
})

describe('updateWorkout', () => {
  it('開始・終了時刻を変更でき、終了が開始より前なら拒否する', async () => {
    const database = freshDb()
    const w = await startWorkout({ date: '2026-09-18', startedAt: combineLocalDateTime('2026-09-18', '19:00') }, database)
    await finishWorkout(w.id, database)
    const startedAt = combineLocalDateTime('2026-09-18', '18:30')
    const endedAt = combineLocalDateTime('2026-09-18', '20:10')
    await updateWorkout(w.id, { startedAt, endedAt }, database)
    expect(await database.workouts.get(w.id)).toMatchObject({ startedAt, endedAt })
    await expect(
      updateWorkout(w.id, { endedAt: combineLocalDateTime('2026-09-18', '18:00') }, database),
    ).rejects.toThrow('終了時刻が開始時刻より前')
    await expect(
      updateWorkout(w.id, { startedAt: combineLocalDateTime('2026-09-18', '21:00') }, database),
    ).rejects.toThrow('終了時刻が開始時刻より前')
  })
})

describe('sessions', () => {
  it('order は 1 から増え、削除すると振り直される（配下のセットも消える）', async () => {
    const database = freshDb()
    const { exercise, workout, session: s1 } = await setup(database)
    const s2 = await addExerciseSession(workout.id, exercise.id, database)
    const s3 = await addExerciseSession(workout.id, exercise.id, database)
    expect([s1.order, s2.order, s3.order]).toEqual([1, 2, 3])
    await addSet(s2.id, { weightKg: 100, reps: 5, durationSec: null }, database)

    await deleteExerciseSession(s2.id, database)
    const rest = await listSessions(workout.id, database)
    expect(rest.map((s) => [s.id, s.order])).toEqual([
      [s1.id, 1],
      [s3.id, 2],
    ])
    expect(await database.workoutSets.where('exerciseSessionId').equals(s2.id).count()).toBe(0)
  })
})

describe('sessions の並べ替え', () => {
  it('上へ／下へで order が入れ替わり、端では何も起きない', async () => {
    const database = freshDb()
    const { exercise, workout, session: s1 } = await setup(database)
    const s2 = await addExerciseSession(workout.id, exercise.id, database)
    const s3 = await addExerciseSession(workout.id, exercise.id, database)
    const orderOf = async () => (await listSessions(workout.id, database)).map((s) => [s.id, s.order])

    await moveExerciseSession(s3.id, 'up', database)
    expect(await orderOf()).toEqual([[s1.id, 1], [s3.id, 2], [s2.id, 3]])
    await moveExerciseSession(s1.id, 'down', database)
    expect(await orderOf()).toEqual([[s3.id, 1], [s1.id, 2], [s2.id, 3]])
    // 端
    await moveExerciseSession(s3.id, 'up', database)
    await moveExerciseSession(s2.id, 'down', database)
    expect(await orderOf()).toEqual([[s3.id, 1], [s1.id, 2], [s2.id, 3]])
    // 存在しない id は無視
    await expect(moveExerciseSession('nope', 'up', database)).resolves.toBeUndefined()
  })

  it('reorderSessions は指定順に振り直し、種目と一致しない指定は拒否する', async () => {
    const database = freshDb()
    const { exercise, workout, session: s1 } = await setup(database)
    const s2 = await addExerciseSession(workout.id, exercise.id, database)
    await reorderSessions(workout.id, [s2.id, s1.id], database)
    expect((await listSessions(workout.id, database)).map((s) => s.id)).toEqual([s2.id, s1.id])
    await expect(reorderSessions(workout.id, [s1.id], database)).rejects.toThrow('一致しません')
    await expect(reorderSessions(workout.id, [s1.id, s1.id], database)).rejects.toThrow('一致しません')
    await expect(reorderSessions(workout.id, [s1.id, 'other'], database)).rejects.toThrow('一致しません')
  })
})

describe('sets', () => {
  it('setNumber は 1 から増え、削除すると振り直される', async () => {
    const database = freshDb()
    const { session } = await setup(database)
    const a = await addSet(session.id, { weightKg: 220, reps: 5, durationSec: null }, database)
    const b = await addSet(session.id, { weightKg: 220, reps: 5, durationSec: null }, database)
    const c = await addSet(session.id, { weightKg: 225, reps: 3, durationSec: null }, database)
    expect([a.setNumber, b.setNumber, c.setNumber]).toEqual([1, 2, 3])

    await deleteSet(b.id, database)
    const rest = await listSets(session.id, database)
    expect(rest.map((s) => [s.id, s.setNumber])).toEqual([
      [a.id, 1],
      [c.id, 2],
    ])
  })

  it('秒だけのセット（プランク）と、reps＋秒のセット（ポーズ種目）を記録できる', async () => {
    const database = freshDb()
    const { session } = await setup(database)
    await expect(addSet(session.id, { weightKg: 0, reps: null, durationSec: 60 }, database)).resolves.toMatchObject({
      weightKg: 0,
      reps: null,
      durationSec: 60,
    })
    await expect(addSet(session.id, { weightKg: 200, reps: 3, durationSec: 2 }, database)).resolves.toMatchObject({
      reps: 3,
      durationSec: 2,
    })
  })

  it('reps と秒の両方が無いセットは拒否する', async () => {
    const database = freshDb()
    const { session } = await setup(database)
    await expect(addSet(session.id, { weightKg: 100, reps: null, durationSec: null }, database)).rejects.toThrow(
      'Reps か秒',
    )
  })

  it('updateSet で値を変え、null で項目を消せ、不正な値は拒否する', async () => {
    const database = freshDb()
    const { session } = await setup(database)
    const a = await addSet(session.id, { weightKg: 220, reps: 5, durationSec: null }, database)
    await updateSet(a.id, { weightKg: 222.5, memo: 'belt' }, database)
    expect(await database.workoutSets.get(a.id)).toMatchObject({ weightKg: 222.5, reps: 5, memo: 'belt' })
    await updateSet(a.id, { reps: null, durationSec: 30 }, database)
    expect(await database.workoutSets.get(a.id)).toMatchObject({ reps: null, durationSec: 30 })
    await expect(updateSet(a.id, { durationSec: null }, database)).rejects.toThrow('Reps か秒')
    // reps 0 は失敗として通る。負の数は通らない
    await updateSet(a.id, { reps: 0, durationSec: null }, database)
    expect(await database.workoutSets.get(a.id)).toMatchObject({ reps: 0, durationSec: null })
    await expect(updateSet(a.id, { reps: -1 }, database)).rejects.toThrow('Reps')
    await expect(addSet(session.id, { weightKg: -1, reps: 5, durationSec: null }, database)).rejects.toThrow('重量')
    await expect(addSet(session.id, { weightKg: 100, reps: 2.5, durationSec: null }, database)).rejects.toThrow('Reps')
    await expect(addSet(session.id, { weightKg: 100, reps: 5, durationSec: 0 }, database)).rejects.toThrow('秒')
  })
})

describe('deleteWorkout', () => {
  it('配下の種目とセットをすべて削除する', async () => {
    const database = freshDb()
    const { workout, session } = await setup(database)
    await addSet(session.id, { weightKg: 100, reps: 5, durationSec: null }, database)
    await addSet(session.id, { weightKg: 100, reps: 5, durationSec: null }, database)
    await deleteWorkout(workout.id, database)
    expect(await database.workouts.count()).toBe(0)
    expect(await database.exerciseSessions.count()).toBe(0)
    expect(await database.workoutSets.count()).toBe(0)
  })
})
