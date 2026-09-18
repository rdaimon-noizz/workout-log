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

/** Workout 内の種目の並びを指定順に置き換える（order を 1 から振り直す）。指定が種目と一致しなければ拒否 */
export async function reorderSessions(workoutId: string, orderedIds: readonly string[], database: WorkoutLogDB = db): Promise<void> {
  await database.transaction('rw', database.exerciseSessions, async () => {
    const sessions = await database.exerciseSessions.where('workoutId').equals(workoutId).toArray()
    const ids = new Set(sessions.map((s) => s.id))
    const valid =
      orderedIds.length === sessions.length && new Set(orderedIds).size === orderedIds.length && orderedIds.every((id) => ids.has(id))
    if (!valid) throw new Error('並び順の指定がこのトレーニングの種目と一致しません')
    const now = nowIso()
    for (const [i, id] of orderedIds.entries()) {
      const current = sessions.find((s) => s.id === id)
      if (current && current.order !== i + 1) await database.exerciseSessions.update(id, { order: i + 1, updatedAt: now })
    }
  })
}

/** 種目を 1 つ上（前）または下（後）へ動かす。端では何もしない */
export async function moveExerciseSession(id: string, direction: 'up' | 'down', database: WorkoutLogDB = db): Promise<void> {
  await database.transaction('rw', database.exerciseSessions, async () => {
    const session = await database.exerciseSessions.get(id)
    if (!session) return
    const sorted = await database.exerciseSessions.where('workoutId').equals(session.workoutId).sortBy('order')
    const index = sorted.findIndex((s) => s.id === id)
    const target = direction === 'up' ? index - 1 : index + 1
    if (index < 0 || target < 0 || target >= sorted.length) return
    const ids = sorted.map((s) => s.id)
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    await reorderSessions(session.workoutId, ids, database)
  })
}
