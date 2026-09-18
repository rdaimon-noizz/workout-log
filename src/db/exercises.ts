import { db, type WorkoutLogDB } from './db'
import type { Exercise } from './types'
import { newId, nowIso } from '../lib/time'

/** 種目名の一意キー。大文字小文字・前後空白・連続空白の違いを同一視する */
export function toNameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

export class DuplicateExerciseNameError extends Error {
  readonly existing: Exercise

  constructor(existing: Exercise) {
    super(
      existing.archivedAt === null
        ? `同じ名前の種目があります: ${existing.name}`
        : `同じ名前の種目がアーカイブにあります: ${existing.name}`,
    )
    this.name = 'DuplicateExerciseNameError'
    this.existing = existing
  }
}

export interface ExerciseInput {
  name: string
  /** 部位（複数可）。保存前に normalizeMuscles で整える */
  muscles: string[]
}

/** 部位配列の正規化: 前後空白と連続空白を整え、空と重複を除く。順序は維持 */
export function normalizeMuscles(muscles: readonly string[]): string[] {
  const out: string[] = []
  for (const raw of muscles) {
    const m = raw.trim().replace(/\s+/g, ' ')
    if (m && !out.includes(m)) out.push(m)
  }
  return out
}

/** 既存種目（アーカイブ含む）で使われている部位の一覧（重複なし・昇順） */
export async function listUsedMuscles(database: WorkoutLogDB = db): Promise<string[]> {
  const keys = await database.exercises.orderBy('muscles').uniqueKeys()
  return keys.map(String)
}

export function listActiveExercises(database: WorkoutLogDB = db): Promise<Exercise[]> {
  return database.exercises.filter((e) => e.archivedAt === null).sortBy('name')
}

export function listArchivedExercises(database: WorkoutLogDB = db): Promise<Exercise[]> {
  return database.exercises.filter((e) => e.archivedAt !== null).sortBy('name')
}

/** 部分一致検索（大文字小文字・空白の違いを無視）。空文字なら全件 */
export function filterExercises(exercises: Exercise[], query: string): Exercise[] {
  const q = toNameKey(query)
  if (!q) return exercises
  return exercises.filter((e) => e.nameKey.includes(q))
}

function cleanName(name: string): string {
  const cleaned = name.trim().replace(/\s+/g, ' ')
  if (!cleaned) throw new Error('種目名を入力してください')
  return cleaned
}

export async function createExercise(input: ExerciseInput, database: WorkoutLogDB = db): Promise<Exercise> {
  const name = cleanName(input.name)
  const nameKey = toNameKey(name)
  return database.transaction('rw', database.exercises, async () => {
    const dup = await database.exercises.where('nameKey').equals(nameKey).first()
    if (dup) throw new DuplicateExerciseNameError(dup)
    const now = nowIso()
    const exercise: Exercise = {
      id: newId(),
      name,
      nameKey,
      muscles: normalizeMuscles(input.muscles),
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    }
    await database.exercises.add(exercise)
    return exercise
  })
}

export async function updateExercise(
  id: string,
  patch: Partial<ExerciseInput>,
  database: WorkoutLogDB = db,
): Promise<void> {
  await database.transaction('rw', database.exercises, async () => {
    const current = await database.exercises.get(id)
    if (!current) throw new Error('種目が見つかりません')
    const changes: Partial<Exercise> = { updatedAt: nowIso() }
    if (patch.name !== undefined) {
      const name = cleanName(patch.name)
      const nameKey = toNameKey(name)
      const dup = await database.exercises.where('nameKey').equals(nameKey).first()
      if (dup && dup.id !== id) throw new DuplicateExerciseNameError(dup)
      changes.name = name
      changes.nameKey = nameKey
    }
    if (patch.muscles !== undefined) changes.muscles = normalizeMuscles(patch.muscles)
    await database.exercises.update(id, changes)
  })
}

/** 選択肢から外す。過去の記録は残る */
export async function archiveExercise(id: string, database: WorkoutLogDB = db): Promise<void> {
  const now = nowIso()
  await database.exercises.update(id, { archivedAt: now, updatedAt: now })
}

export async function unarchiveExercise(id: string, database: WorkoutLogDB = db): Promise<void> {
  await database.exercises.update(id, { archivedAt: null, updatedAt: nowIso() })
}
