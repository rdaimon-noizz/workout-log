import { db, type WorkoutLogDB } from './db'
import { toNameKey } from './exercises'
import { INITIAL_EXERCISES } from './initialExercises'
import type { Exercise } from './types'
import { newId, nowIso } from '../lib/time'

export { INITIAL_EXERCISES }

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
    const rows: Exercise[] = INITIAL_EXERCISES.map(({ name, muscles }) => ({
      id: newId(),
      name,
      nameKey: toNameKey(name),
      muscles: [...muscles],
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    }))
    await database.exercises.bulkAdd(rows)
    return rows.length
  })
}
