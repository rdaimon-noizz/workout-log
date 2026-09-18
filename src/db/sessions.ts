import { db, type WorkoutLogDB } from './db'
import type { ExerciseSession } from './types'
import { newId, nowIso } from '../lib/time'

export function listSessions(workoutId: string, database: WorkoutLogDB = db): Promise<ExerciseSession[]> {
  return database.exerciseSessions.where('workoutId').equals(workoutId).sortBy('order')
}

/** Workout に種目を追加する。order は末尾に付ける */
export async function addExerciseSession(
  workoutId: string,
  exerciseId: string,
  database: WorkoutLogDB = db,
): Promise<ExerciseSession> {
  return database.transaction('rw', database.exerciseSessions, async () => {
    const existing = await database.exerciseSessions.where('workoutId').equals(workoutId).toArray()
    const order = existing.reduce((max, s) => Math.max(max, s.order), 0) + 1
    const now = nowIso()
    const session: ExerciseSession = {
      id: newId(),
      workoutId,
      exerciseId,
      order,
      memo: '',
      createdAt: now,
      updatedAt: now,
    }
    await database.exerciseSessions.add(session)
    return session
  })
}

export async function updateSessionMemo(id: string, memo: string, database: WorkoutLogDB = db): Promise<void> {
  await database.exerciseSessions.update(id, { memo, updatedAt: nowIso() })
}

/** 種目を配下のセットごと削除し、残った種目の order を 1 から振り直す */
export async function deleteExerciseSession(id: string, database: WorkoutLogDB = db): Promise<void> {
  await database.transaction('rw', [database.exerciseSessions, database.workoutSets], async () => {
    const session = await database.exerciseSessions.get(id)
    if (!session) return
    await database.workoutSets.where('exerciseSessionId').equals(id).delete()
    await database.exerciseSessions.delete(id)
    const rest = await database.exerciseSessions.where('workoutId').equals(session.workoutId).sortBy('order')
    for (const [i, s] of rest.entries()) {
      if (s.order !== i + 1) await database.exerciseSessions.update(s.id, { order: i + 1 })
    }
  })
}
