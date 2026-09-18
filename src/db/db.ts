import Dexie, { type EntityTable } from 'dexie'
import { legacyMuscles } from './legacy'
import type { Exercise, ExerciseSession, Workout, WorkoutSet } from './types'

/** IndexedDB スキーマの版。構造を変えるときに上げ、Dexie の version() と upgrade() を追加する */
export const SCHEMA_VERSION = 2

export class WorkoutLogDB extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>
  workouts!: EntityTable<Workout, 'id'>
  exerciseSessions!: EntityTable<ExerciseSession, 'id'>
  workoutSets!: EntityTable<WorkoutSet, 'id'>

  constructor(name = 'workout-log') {
    super(name)
    // 先頭が主キー（id は UUID で自前採番）、& は一意インデックス、* は multiEntry、[a+b] は複合インデックス。
    // null を持つ列（archivedAt / endedAt）はインデックスに乗らないため定義しない。

    // 版 1（Phase 1）: 種目は単一の category、セットは reps 必須
    this.version(1).stores({
      exercises: 'id, &nameKey, category',
      workouts: 'id, date, startedAt',
      exerciseSessions: 'id, workoutId, exerciseId, [workoutId+order]',
      workoutSets: 'id, exerciseSessionId, [exerciseSessionId+setNumber]',
    })

    // 版 2（Phase 2.5）: 種目は複数の部位、セットに秒を追加し reps を省略可にした
    this.version(SCHEMA_VERSION)
      .stores({
        exercises: 'id, &nameKey, *muscles',
        workouts: 'id, date, startedAt',
        exerciseSessions: 'id, workoutId, exerciseId, [workoutId+order]',
        workoutSets: 'id, exerciseSessionId, [exerciseSessionId+setNumber]',
      })
      .upgrade(async (tx) => {
        await tx
          .table('exercises')
          .toCollection()
          .modify((e: Record<string, unknown>) => {
            e.muscles = legacyMuscles(String(e.nameKey), typeof e.category === 'string' ? e.category : undefined)
            delete e.category
          })
        await tx
          .table('workoutSets')
          .toCollection()
          .modify((s: Record<string, unknown>) => {
            if (s.durationSec === undefined) s.durationSec = null
            if (s.reps === undefined) s.reps = null
          })
      })
  }
}

export const db = new WorkoutLogDB()
