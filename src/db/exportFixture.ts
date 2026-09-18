import type { WorkoutLogDB } from './db'
import { createExercise } from './exercises'
import { addExerciseSession, updateSessionMemo } from './sessions'
import { addSet } from './sets'
import { finishWorkout, startWorkout } from './workouts'
import { combineLocalDateTime } from '../lib/time'

/** テスト用: 2 回分のトレーニング（新しい方を先に作り、並びが日付順になることを確かめられるようにする） */
export async function seedTwoWorkouts(database: WorkoutLogDB) {
  const dl = await createExercise({ name: 'Deadlift', muscles: ['脊柱起立筋', 'ハムストリング'] }, database)
  const plank = await createExercise({ name: 'Plank', muscles: ['腹直筋'] }, database)
  const w2 = await startWorkout(
    {
      date: '2026-09-18',
      startedAt: combineLocalDateTime('2026-09-18', '19:00'),
      bodyweightKg: 72.5,
      memo: 'memo, with "quotes"\nand newline',
    },
    database,
  )
  const s2 = await addExerciseSession(w2.id, dl.id, database)
  await addSet(s2.id, { weightKg: 220, reps: 5, durationSec: null, memo: 'belt' }, database)
  await addSet(s2.id, { weightKg: 200, reps: 3, durationSec: 2 }, database)
  await finishWorkout(w2.id, database)
  const w1 = await startWorkout({ date: '2026-09-10', startedAt: combineLocalDateTime('2026-09-10', '10:00') }, database)
  const s1 = await addExerciseSession(w1.id, plank.id, database)
  await updateSessionMemo(s1.id, '体幹', database)
  await addSet(s1.id, { weightKg: 0, reps: null, durationSec: 60 }, database)
  return { dl, plank, w1, w2, s1, s2 }
}
