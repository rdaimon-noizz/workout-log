import { db, type WorkoutLogDB } from './db'
import type { Workout } from './types'
import { newId, nowIso, todayLocalDate } from '../lib/time'

export interface WorkoutInput {
  date?: string
  /** 開始時刻（オフセット付き ISO）。省略時は現在時刻 */
  startedAt?: string
  bodyweightKg?: number | null
  memo?: string
}

type WorkoutFields = Partial<Pick<Workout, 'date' | 'startedAt' | 'endedAt' | 'bodyweightKg' | 'memo'>>

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/

function validateWorkoutFields(input: WorkoutFields): void {
  if (input.date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    throw new Error('日付は YYYY-MM-DD の形式で指定してください')
  }
  if (input.startedAt !== undefined && !ISO_RE.test(input.startedAt)) {
    throw new Error('開始時刻の形式が不正です')
  }
  if (input.endedAt != null && !ISO_RE.test(input.endedAt)) {
    throw new Error('終了時刻の形式が不正です')
  }
  if (input.bodyweightKg != null && (!Number.isFinite(input.bodyweightKg) || input.bodyweightKg <= 0)) {
    throw new Error('体重は 0 より大きい数値で入力してください')
  }
}

function assertEndAfterStart(startedAt: string, endedAt: string | null): void {
  if (endedAt !== null && new Date(endedAt).getTime() < new Date(startedAt).getTime()) {
    throw new Error('終了時刻が開始時刻より前になっています')
  }
}

/** 進行中（endedAt が null）の Workout。複数あれば開始が最も新しいもの */
export async function getActiveWorkout(database: WorkoutLogDB = db): Promise<Workout | undefined> {
  const open = await database.workouts.filter((w) => w.endedAt === null).toArray()
  open.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  return open[0]
}

/** Workout 内で最後に記録したセットの時刻。セットが無ければ undefined */
async function lastSetCreatedAt(workoutId: string, database: WorkoutLogDB): Promise<string | undefined> {
  const sessions = await database.exerciseSessions.where('workoutId').equals(workoutId).toArray()
  if (sessions.length === 0) return undefined
  const sets = await database.workoutSets
    .where('exerciseSessionId')
    .anyOf(sessions.map((s) => s.id))
    .toArray()
  if (sets.length === 0) return undefined
  return sets.map((s) => s.createdAt).sort().at(-1)
}

/** 終了していない Workout をすべて閉じる。終了時刻は最後のセットの時刻、無ければ開始時刻 */
export async function closeOpenWorkouts(database: WorkoutLogDB = db): Promise<number> {
  return database.transaction('rw', [database.workouts, database.exerciseSessions, database.workoutSets], async () => {
    const open = await database.workouts.filter((w) => w.endedAt === null).toArray()
    for (const w of open) {
      const endedAt = (await lastSetCreatedAt(w.id, database)) ?? w.startedAt
      await database.workouts.update(w.id, { endedAt, updatedAt: nowIso() })
    }
    return open.length
  })
}

/** 新しい Workout を開始する。進行中のものがあれば自動で閉じる */
export async function startWorkout(input: WorkoutInput = {}, database: WorkoutLogDB = db): Promise<Workout> {
  validateWorkoutFields(input)
  return database.transaction('rw', [database.workouts, database.exerciseSessions, database.workoutSets], async () => {
    await closeOpenWorkouts(database)
    const now = nowIso()
    const workout: Workout = {
      id: newId(),
      date: input.date ?? todayLocalDate(),
      startedAt: input.startedAt ?? now,
      endedAt: null,
      bodyweightKg: input.bodyweightKg ?? null,
      memo: input.memo ?? '',
      createdAt: now,
      updatedAt: now,
    }
    await database.workouts.add(workout)
    return workout
  })
}

export async function finishWorkout(id: string, database: WorkoutLogDB = db): Promise<void> {
  const now = nowIso()
  await database.workouts.update(id, { endedAt: now, updatedAt: now })
}

/** 日付・開始/終了時刻・体重・メモを変更する。終了が開始より前になる変更は拒否する */
export async function updateWorkout(id: string, patch: WorkoutFields, database: WorkoutLogDB = db): Promise<void> {
  validateWorkoutFields(patch)
  await database.transaction('rw', database.workouts, async () => {
    const current = await database.workouts.get(id)
    if (!current) throw new Error('トレーニングが見つかりません')
    const next = { ...current, ...patch }
    assertEndAfterStart(next.startedAt, next.endedAt)
    await database.workouts.update(id, { ...patch, updatedAt: nowIso() })
  })
}

/** Workout を配下の種目・セットごと削除する */
export async function deleteWorkout(id: string, database: WorkoutLogDB = db): Promise<void> {
  await database.transaction('rw', [database.workouts, database.exerciseSessions, database.workoutSets], async () => {
    const sessionIds = (await database.exerciseSessions.where('workoutId').equals(id).toArray()).map((s) => s.id)
    if (sessionIds.length > 0) {
      await database.workoutSets.where('exerciseSessionId').anyOf(sessionIds).delete()
      await database.exerciseSessions.bulkDelete(sessionIds)
    }
    await database.workouts.delete(id)
  })
}
