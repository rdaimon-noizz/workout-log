import { db, type WorkoutLogDB } from './db'
import type { Exercise, ExerciseSession, Workout, WorkoutSet } from './types'

export interface SessionDetail {
  session: ExerciseSession
  /** 種目マスタから消えている場合は undefined */
  exercise: Exercise | undefined
  sets: WorkoutSet[]
}

export interface WorkoutDetail {
  workout: Workout
  sessions: SessionDetail[]
}

/** Workout 内の種目を order 順に、種目名とセット一覧を付けて返す */
export async function loadSessionDetails(workoutId: string, database: WorkoutLogDB = db): Promise<SessionDetail[]> {
  const sessions = await database.exerciseSessions.where('workoutId').equals(workoutId).sortBy('order')
  if (sessions.length === 0) return []

  const exerciseIds = [...new Set(sessions.map((s) => s.exerciseId))]
  const exerciseById = new Map<string, Exercise>()
  for (const e of await database.exercises.bulkGet(exerciseIds)) {
    if (e) exerciseById.set(e.id, e)
  }

  const setsBySession = new Map<string, WorkoutSet[]>()
  const sets = await database.workoutSets
    .where('exerciseSessionId')
    .anyOf(sessions.map((s) => s.id))
    .toArray()
  for (const s of sets) {
    const list = setsBySession.get(s.exerciseSessionId) ?? []
    list.push(s)
    setsBySession.set(s.exerciseSessionId, list)
  }

  return sessions.map((session) => ({
    session,
    exercise: exerciseById.get(session.exerciseId),
    sets: (setsBySession.get(session.id) ?? []).sort((a, b) => a.setNumber - b.setNumber),
  }))
}

export async function loadWorkoutDetail(
  workoutId: string,
  database: WorkoutLogDB = db,
): Promise<WorkoutDetail | undefined> {
  const workout = await database.workouts.get(workoutId)
  if (!workout) return undefined
  return { workout, sessions: await loadSessionDetails(workoutId, database) }
}
