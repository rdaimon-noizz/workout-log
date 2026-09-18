import { db, type WorkoutLogDB } from './db'
import type { Exercise, ExerciseSession, Workout, WorkoutSet } from './types'
import { computeLoad, resolveBodyweight, type ResolvedBodyweight } from '../lib/load'
import { compareWorkoutsDesc, isBeforeWorkout } from '../lib/workoutOrder'

export { compareWorkoutsDesc, isBeforeWorkout }

export interface WorkoutSummary {
  workout: Workout
  /** 種目名を order 順に（種目マスタから消えたものは除く） */
  exerciseNames: string[]
  setCount: number
}

/** 全 Workout を新しい順に、種目名とセット数を付けて返す */
export async function listWorkoutSummaries(database: WorkoutLogDB = db): Promise<WorkoutSummary[]> {
  const [workouts, sessions, sets, exercises] = await Promise.all([
    database.workouts.toArray(),
    database.exerciseSessions.toArray(),
    database.workoutSets.toArray(),
    database.exercises.toArray(),
  ])
  const nameById = new Map(exercises.map((e) => [e.id, e.name]))
  const setCountBySession = new Map<string, number>()
  for (const s of sets) setCountBySession.set(s.exerciseSessionId, (setCountBySession.get(s.exerciseSessionId) ?? 0) + 1)
  const sessionsByWorkout = new Map<string, ExerciseSession[]>()
  for (const s of sessions) {
    const list = sessionsByWorkout.get(s.workoutId) ?? []
    list.push(s)
    sessionsByWorkout.set(s.workoutId, list)
  }
  return workouts.sort(compareWorkoutsDesc).map((workout) => {
    const ss = (sessionsByWorkout.get(workout.id) ?? []).sort((a, b) => a.order - b.order)
    return {
      workout,
      exerciseNames: ss.map((s) => nameById.get(s.exerciseId)).filter((n): n is string => n !== undefined),
      setCount: ss.reduce((n, s) => n + (setCountBySession.get(s.id) ?? 0), 0),
    }
  })
}

export interface PreviousRecord {
  workout: Workout
  session: ExerciseSession
  sets: WorkoutSet[]
  /** 前回の Workout 時点で解決した体重（自重種目の負荷表示用） */
  bodyweight: ResolvedBodyweight
}

/**
 * 前回記録: 同じ種目のうち、current より前の Workout に属する最新の ExerciseSession。
 * 同じ Workout 内の再登場は含めない。前回の Workout に同じ種目が複数あれば order が大きいもの。
 */
export async function findPreviousRecord(
  exerciseId: string,
  current: Pick<Workout, 'id' | 'date' | 'startedAt'>,
  database: WorkoutLogDB = db,
): Promise<PreviousRecord | undefined> {
  const sessions = await database.exerciseSessions.where('exerciseId').equals(exerciseId).toArray()
  if (sessions.length === 0) return undefined
  const allWorkouts = await database.workouts.toArray()
  const workoutIds = new Set(sessions.map((s) => s.workoutId))
  const candidates = allWorkouts.filter((w) => workoutIds.has(w.id) && isBeforeWorkout(w, current)).sort(compareWorkoutsDesc)
  const workout = candidates[0]
  if (!workout) return undefined
  const session = sessions.filter((s) => s.workoutId === workout.id).sort((a, b) => b.order - a.order)[0]
  const sets = await database.workoutSets.where('exerciseSessionId').equals(session.id).sortBy('setNumber')
  return { workout, session, sets, bodyweight: resolveBodyweight(workout, allWorkouts) }
}

export interface ExerciseHistoryEntry {
  workout: Workout
  /** その Workout 内で行った当該種目のセッション（order 順）。セットの無いセッションは除く */
  sessions: Array<{ session: ExerciseSession; sets: WorkoutSet[] }>
  /** その Workout 時点で解決した体重（自重種目の負荷表示用） */
  bodyweight: ResolvedBodyweight
}

/** グラフの 1 点 = 1 Workout の最高負荷（通常種目は最高重量、自重種目は 体重 + 加重 の最大） */
export interface WeightPoint {
  workoutId: string
  date: string
  startedAt: string
  maxLoadKg: number
  /** 最高負荷のセットのうち最大の reps（reps の無いセットだけなら null） */
  repsAtMax: number | null
  /** 最高負荷のセットのうち最大の秒（秒の無いセットだけなら null） */
  durationAtMax: number | null
  usesBodyweight: boolean
  /** 自重種目のとき、使った体重とその出典 */
  bodyweight: ResolvedBodyweight
}

export interface ExerciseHistory {
  exercise: Exercise | undefined
  /** 新しい順 */
  entries: ExerciseHistoryEntry[]
  /** 古い順（時系列グラフ用） */
  points: WeightPoint[]
}

/** 種目別履歴: Workout ごとのセット一覧と、最高重量の推移 */
export async function loadExerciseHistory(exerciseId: string, database: WorkoutLogDB = db): Promise<ExerciseHistory> {
  const exercise = await database.exercises.get(exerciseId)
  const sessions = await database.exerciseSessions.where('exerciseId').equals(exerciseId).toArray()
  if (sessions.length === 0) return { exercise, entries: [], points: [] }

  const sets = await database.workoutSets
    .where('exerciseSessionId')
    .anyOf(sessions.map((s) => s.id))
    .toArray()
  const setsBySession = new Map<string, WorkoutSet[]>()
  for (const s of sets) {
    const list = setsBySession.get(s.exerciseSessionId) ?? []
    list.push(s)
    setsBySession.set(s.exerciseSessionId, list)
  }

  const allWorkouts = await database.workouts.toArray()
  const workoutIds = new Set(sessions.map((s) => s.workoutId))
  const workouts = allWorkouts.filter((w) => workoutIds.has(w.id))
  const usesBodyweight = exercise?.usesBodyweight ?? false

  const entries: ExerciseHistoryEntry[] = []
  for (const workout of workouts.sort(compareWorkoutsDesc)) {
    const withSets = sessions
      .filter((s) => s.workoutId === workout.id)
      .sort((a, b) => a.order - b.order)
      .map((session) => ({ session, sets: (setsBySession.get(session.id) ?? []).sort((a, b) => a.setNumber - b.setNumber) }))
      .filter((x) => x.sets.length > 0)
    if (withSets.length > 0) entries.push({ workout, sessions: withSets, bodyweight: resolveBodyweight(workout, allWorkouts) })
  }

  const points: WeightPoint[] = []
  for (const { workout, sessions: ss, bodyweight } of entries) {
    const all = ss.flatMap((x) => x.sets)
    const loaded = all
      .map((s) => ({ set: s, load: computeLoad(s.weightKg, usesBodyweight, bodyweight.kg) }))
      .filter((x): x is { set: WorkoutSet; load: number } => x.load !== null)
    // 自重種目で体重が解決できない Workout は点を打たない
    if (loaded.length === 0) continue
    const maxLoadKg = Math.max(...loaded.map((x) => x.load))
    const top = loaded.filter((x) => x.load === maxLoadKg).map((x) => x.set)
    const reps = top.map((s) => s.reps).filter((r): r is number => r !== null)
    const durations = top.map((s) => s.durationSec).filter((d): d is number => d !== null)
    points.push({
      workoutId: workout.id,
      date: workout.date,
      startedAt: workout.startedAt,
      maxLoadKg,
      repsAtMax: reps.length > 0 ? Math.max(...reps) : null,
      durationAtMax: durations.length > 0 ? Math.max(...durations) : null,
      usesBodyweight,
      bodyweight,
    })
  }
  points.reverse()

  return { exercise, entries, points }
}

export interface ExerciseWithHistory {
  exercise: Exercise
  /** 記録のある Workout 数 */
  workoutCount: number
  /** 最後に行った日。無ければ null */
  lastDate: string | null
}

/** 種目別履歴の入口用: 有効な種目と、記録のあるアーカイブ済み種目。最後に行った日が新しい順 → 名前順 */
export async function listExercisesWithHistory(database: WorkoutLogDB = db): Promise<ExerciseWithHistory[]> {
  const [exercises, sessions, workouts] = await Promise.all([
    database.exercises.toArray(),
    database.exerciseSessions.toArray(),
    database.workouts.toArray(),
  ])
  const dateByWorkout = new Map(workouts.map((w) => [w.id, w.date]))
  const stats = new Map<string, { workoutIds: Set<string>; lastDate: string | null }>()
  for (const s of sessions) {
    const stat = stats.get(s.exerciseId) ?? { workoutIds: new Set<string>(), lastDate: null }
    stat.workoutIds.add(s.workoutId)
    const d = dateByWorkout.get(s.workoutId)
    if (d !== undefined && (stat.lastDate === null || d > stat.lastDate)) stat.lastDate = d
    stats.set(s.exerciseId, stat)
  }
  return exercises
    .filter((e) => e.archivedAt === null || stats.has(e.id))
    .map((exercise) => {
      const stat = stats.get(exercise.id)
      return { exercise, workoutCount: stat?.workoutIds.size ?? 0, lastDate: stat?.lastDate ?? null }
    })
    .sort((a, b) => (b.lastDate ?? '').localeCompare(a.lastDate ?? '') || a.exercise.name.localeCompare(b.exercise.name))
}
