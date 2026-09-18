import type { Workout } from '../db/types'

type WorkoutKey = Pick<Workout, 'date' | 'startedAt'>

/** 新しい順（date 降順 → startedAt 降順） */
export function compareWorkoutsDesc(a: WorkoutKey, b: WorkoutKey): number {
  return b.date.localeCompare(a.date) || b.startedAt.localeCompare(a.startedAt)
}

/** w が current より前の Workout か（同日なら開始時刻で比較。current 自身は含めない） */
export function isBeforeWorkout(w: Pick<Workout, 'id'> & WorkoutKey, current: Pick<Workout, 'id'> & WorkoutKey): boolean {
  if (w.id === current.id) return false
  return w.date < current.date || (w.date === current.date && w.startedAt < current.startedAt)
}
