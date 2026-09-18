import { db, type WorkoutLogDB } from './db'
import type { Exercise, ExerciseCategory } from './types'
import { newId, nowIso } from '../lib/time'

/** 初回起動時に投入する種目 */
export const INITIAL_EXERCISES: ReadonlyArray<{ name: string; category: ExerciseCategory }> = [
  { name: 'Deadlift', category: 'back' },
  { name: 'Bench Press', category: 'chest' },
  { name: 'Squat', category: 'legs' },
  { name: 'Romanian Deadlift', category: 'legs' },
  { name: 'Lat Pulldown', category: 'back' },
  { name: 'Barbell Row', category: 'back' },
  { name: 'Overhead Press', category: 'shoulder' },
]

/** 種目名の一意キー。大文字小文字・前後空白・連続空白の違いを同一視する */
export function toNameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * 種目テーブルが空のときだけ初期種目を投入する。
 * 1 件でもあれば何もしない（ユーザーがアーカイブした種目を復活させないため）。
 * 戻り値は投入した件数。
 */
export async function ensureSeedExercises(database: WorkoutLogDB = db): Promise<number> {
  return database.transaction('rw', database.exercises, async () => {
    const count = await database.exercises.count()
    if (count > 0) return 0
    const now = nowIso()
    const rows: Exercise[] = INITIAL_EXERCISES.map(({ name, category }) => ({
      id: newId(),
      name,
      nameKey: toNameKey(name),
      category,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    }))
    await database.exercises.bulkAdd(rows)
    return rows.length
  })
}
