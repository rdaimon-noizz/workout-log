import { SCHEMA_VERSION, db, type WorkoutLogDB } from './db'
import { compareWorkoutsDesc } from './history'
import type { Exercise, ExerciseSession, Workout, WorkoutSet } from './types'
import { csvValue, toCsv } from '../lib/csv'
import { computeLoad, resolveBodyweight } from '../lib/load'
import { nowIso } from '../lib/time'

/** CSV の列（この順で固定。追加は末尾のみ。改名・意味変更はしない） */
export const CSV_COLUMNS = [
  'date',
  'workout_id',
  'started_at',
  'ended_at',
  'bodyweight_kg',
  'workout_memo',
  'exercise_id',
  'exercise',
  'exercise_muscles',
  'exercise_order',
  'exercise_session_id',
  'exercise_memo',
  'set_id',
  'set_number',
  'weight_kg',
  'reps',
  'set_memo',
  'set_created_at',
  'duration_sec',
  'is_bodyweight_exercise',
  'load_kg',
] as const

/** 1 行 = 1 セット。Workout の古い順 → 種目の order → setNumber */
export async function buildCsvRows(database: WorkoutLogDB = db): Promise<string[][]> {
  const [workouts, sessions, sets, exercises] = await Promise.all([
    database.workouts.toArray(),
    database.exerciseSessions.toArray(),
    database.workoutSets.toArray(),
    database.exercises.toArray(),
  ])
  const exerciseById = new Map(exercises.map((e) => [e.id, e]))
  const sessionsByWorkout = new Map<string, ExerciseSession[]>()
  for (const s of sessions) sessionsByWorkout.set(s.workoutId, [...(sessionsByWorkout.get(s.workoutId) ?? []), s])
  const setsBySession = new Map<string, WorkoutSet[]>()
  for (const s of sets) setsBySession.set(s.exerciseSessionId, [...(setsBySession.get(s.exerciseSessionId) ?? []), s])

  const rows: string[][] = [[...CSV_COLUMNS]]
  for (const w of [...workouts].sort(compareWorkoutsDesc).reverse()) {
    const bodyweight = resolveBodyweight(w, workouts)
    for (const session of (sessionsByWorkout.get(w.id) ?? []).sort((a, b) => a.order - b.order)) {
      const exercise = exerciseById.get(session.exerciseId)
      const usesBodyweight = exercise?.usesBodyweight ?? false
      for (const set of (setsBySession.get(session.id) ?? []).sort((a, b) => a.setNumber - b.setNumber)) {
        rows.push([
          w.date,
          w.id,
          w.startedAt,
          csvValue(w.endedAt),
          csvValue(w.bodyweightKg),
          w.memo,
          session.exerciseId,
          exercise?.name ?? '',
          (exercise?.muscles ?? []).join(';'),
          csvValue(session.order),
          session.id,
          session.memo,
          set.id,
          csvValue(set.setNumber),
          csvValue(set.weightKg),
          csvValue(set.reps),
          set.memo,
          set.createdAt,
          csvValue(set.durationSec),
          usesBodyweight ? '1' : '0',
          csvValue(computeLoad(set.weightKg, usesBodyweight, bodyweight.kg)),
        ])
      }
    }
  }
  return rows
}

/** 全記録の CSV（UTF-8 BOM・CRLF） */
export async function exportCsv(database: WorkoutLogDB = db): Promise<string> {
  return toCsv(await buildCsvRows(database))
}

export interface BackupFile {
  app: 'workout-log'
  schemaVersion: number
  exportedAt: string
  buildId: string
  tables: {
    exercises: Exercise[]
    workouts: Workout[]
    exerciseSessions: ExerciseSession[]
    workoutSets: WorkoutSet[]
  }
}

export interface RecordCounts {
  exercises: number
  workouts: number
  exerciseSessions: number
  workoutSets: number
}

export async function countRecords(database: WorkoutLogDB = db): Promise<RecordCounts> {
  const [exercises, workouts, exerciseSessions, workoutSets] = await Promise.all([
    database.exercises.count(),
    database.workouts.count(),
    database.exerciseSessions.count(),
    database.workoutSets.count(),
  ])
  return { exercises, workouts, exerciseSessions, workoutSets }
}

export function countsOf(backup: BackupFile): RecordCounts {
  return {
    exercises: backup.tables.exercises.length,
    workouts: backup.tables.workouts.length,
    exerciseSessions: backup.tables.exerciseSessions.length,
    workoutSets: backup.tables.workoutSets.length,
  }
}

/** 全テーブルを 1 つの JSON にまとめる（復元用。CSV と違い項目を落とさない） */
export async function buildBackup(buildId: string, database: WorkoutLogDB = db): Promise<BackupFile> {
  const [exercises, workouts, exerciseSessions, workoutSets] = await Promise.all([
    database.exercises.toArray(),
    database.workouts.toArray(),
    database.exerciseSessions.toArray(),
    database.workoutSets.toArray(),
  ])
  return { app: 'workout-log', schemaVersion: SCHEMA_VERSION, exportedAt: nowIso(), buildId, tables: { exercises, workouts, exerciseSessions, workoutSets } }
}

const TABLE_NAMES = ['exercises', 'workouts', 'exerciseSessions', 'workoutSets'] as const

/** バックアップ JSON の文字列を検証して返す。問題があれば日本語のメッセージで例外 */
export function parseBackup(text: string): BackupFile {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('JSON として読めませんでした')
  }
  if (typeof data !== 'object' || data === null) throw new Error('バックアップの形式が違います')
  const obj = data as Record<string, unknown>
  if (obj.app !== 'workout-log') throw new Error('このアプリのバックアップではありません')
  if (typeof obj.schemaVersion !== 'number') throw new Error('バックアップの形式が違います（版の情報がありません）')
  if (obj.schemaVersion > SCHEMA_VERSION) {
    throw new Error(`このバックアップは新しい形式（版 ${obj.schemaVersion}）です。アプリを更新してから復元してください`)
  }
  if (obj.schemaVersion < 2) {
    throw new Error(`このバックアップは古い形式（版 ${obj.schemaVersion}）で、復元に対応していません`)
  }
  const tables = obj.tables as Record<string, unknown> | undefined
  if (typeof tables !== 'object' || tables === null) throw new Error('バックアップの内容が壊れています（テーブルがありません）')
  for (const name of TABLE_NAMES) {
    const rows = tables[name]
    if (!Array.isArray(rows) || rows.some((r) => typeof r !== 'object' || r === null || typeof (r as { id?: unknown }).id !== 'string')) {
      throw new Error(`バックアップの内容が壊れています（${name}）`)
    }
  }
  return upgradeBackup(data as BackupFile)
}

/** 旧版のバックアップを現在の版に変換する。版 2 → 3: 種目に usesBodyweight = false を補う */
export function upgradeBackup(backup: BackupFile): BackupFile {
  if (backup.schemaVersion >= SCHEMA_VERSION) return backup
  const exercises = backup.tables.exercises.map((e) => ({ ...e, usesBodyweight: e.usesBodyweight ?? false }))
  return { ...backup, schemaVersion: SCHEMA_VERSION, tables: { ...backup.tables, exercises } }
}

/** 全テーブルを置き換えて復元する。途中で失敗したら元のデータのまま（1 トランザクション） */
export async function restoreBackup(backup: BackupFile, database: WorkoutLogDB = db): Promise<RecordCounts> {
  await database.transaction('rw', [database.exercises, database.workouts, database.exerciseSessions, database.workoutSets], async () => {
    await Promise.all(TABLE_NAMES.map((name) => database[name].clear()))
    await database.exercises.bulkAdd(backup.tables.exercises)
    await database.workouts.bulkAdd(backup.tables.workouts)
    await database.exerciseSessions.bulkAdd(backup.tables.exerciseSessions)
    await database.workoutSets.bulkAdd(backup.tables.workoutSets)
  })
  return countsOf(backup)
}
