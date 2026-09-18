import { db, type WorkoutLogDB } from '../db/db'
import type { Workout } from '../db/types'
import { compareWorkoutsDesc, isBeforeWorkout } from './workoutOrder'

export interface ResolvedBodyweight {
  /** 使う体重。どこにも記録が無ければ null */
  kg: number | null
  /** this = その Workout の入力値、previous = 直近で体重を入れた別の Workout の値 */
  source: 'this' | 'previous' | null
  /** 体重を取った Workout の日付 */
  date: string | null
}

/**
 * 体重の解決: その Workout の bodyweightKg → 無ければ、それより前で体重のある直近の Workout の値 → 無ければ null。
 * all にはその Workout を含む全 Workout を渡す（順不同でよい）。
 */
export function resolveBodyweight(current: Workout, all: readonly Workout[]): ResolvedBodyweight {
  if (current.bodyweightKg !== null) return { kg: current.bodyweightKg, source: 'this', date: current.date }
  const earlier = all
    .filter((w) => w.bodyweightKg !== null && isBeforeWorkout(w, current))
    .sort(compareWorkoutsDesc)[0]
  if (earlier) return { kg: earlier.bodyweightKg, source: 'previous', date: earlier.date }
  return { kg: null, source: null, date: null }
}

export async function resolveBodyweightFor(workout: Workout, database: WorkoutLogDB = db): Promise<ResolvedBodyweight> {
  return resolveBodyweight(workout, await database.workouts.toArray())
}

/**
 * セットの負荷。通常種目は weightKg そのもの。自重種目は 体重 + 加重（体重が無ければ null）。
 */
export function computeLoad(weightKg: number, usesBodyweight: boolean, bodyweightKg: number | null): number | null {
  if (!usesBodyweight) return weightKg
  if (bodyweightKg === null) return null
  return Math.round((bodyweightKg + weightKg) * 100) / 100
}
