import Dexie, { type EntityTable } from 'dexie'
import type { Exercise, ExerciseSession, Workout, WorkoutSet } from './types'

/** IndexedDB スキーマの版。構造を変えるときに上げ、Dexie の version() を追加する */
export const SCHEMA_VERSION = 1

export class WorkoutLogDB extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>
  workouts!: EntityTable<Workout, 'id'>
  exerciseSessions!: EntityTable<ExerciseSession, 'id'>
  workoutSets!: EntityTable<WorkoutSet, 'id'>

  constructor(name = 'workout-log') {
    super(name)
    // 先頭が主キー（id は UUID で自前採番）、& は一意インデックス、[a+b] は複合インデックス。
    // null を持つ列（archivedAt / endedAt）はインデックスに乗らないため定義しない。
    this.version(SCHEMA_VERSION).stores({
      exercises: 'id, &nameKey, category',
      workouts: 'id, date, startedAt',
      exerciseSessions: 'id, workoutId, exerciseId, [workoutId+order]',
      workoutSets: 'id, exerciseSessionId, [exerciseSessionId+setNumber]',
    })
  }
}

export const db = new WorkoutLogDB()
