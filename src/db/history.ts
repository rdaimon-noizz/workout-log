import { db, type WorkoutLogDB } from './db'
import type { Exercise, ExerciseSession, Workout, WorkoutSet } from './types'

/** 新しい順（date 降順 → startedAt 降順） */
export function compareWorkoutsDesc(a: Pick<Workout, 'date' | 'startedAt'>, b: Pick<Workout, 'date' | 'startedAt'>): number {
  return b.date.localeCompare(a.date) || b.startedAt.localeCompare(a.startedAt)
}

/** w が current より前の Workout か（同日なら開始時刻で比較。current 自身は含めない） */
export function isBeforeWorkout(w: Pick<Workout, 'id' | 'date' | 'startedAt'>, current: Pick<Workout, 'id' | 'date' | 'startedAt'>): boolean {
  if (w.id === current.id) return false
  return w.date < current.date || (w.date === current.date && w.startedAt < current.startedAt)
}

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
  const workoutIds = [...new Set(sessions.map((s) => s.workoutId))]
  const workouts = (await database.workouts.bulkGet(workoutIds)).filter((w): w is Workout => w !== undefined)
  const candidates = workouts.filter((w) => isBeforeWorkout(w, current)).sort(compareWorkoutsDesc)
  const workout = candidates[0]
  if (!workout) return undefined
  const session = sessions.filter((s) => s.workoutId === workout.id).sort((a, b) => b.order - a.order)[0]
  const sets = await database.workoutSets.where('exerciseSessionId').equals(session.id).sortBy('setNumber')
  return { workout, session, sets }
}

export interface ExerciseHistoryEntry {
  workout: Workout
  /** その Workout 内で行った当該種目のセッション（order 順）。セットの無いセッションは除く */
  sessions: Array<{ session: ExerciseSession; sets: WorkoutSet[] }>
}

/** グラフの 1 点 = 1 Workout の最高重量 */
export interface WeightPoint {
  workoutId: string
  date: string
  startedAt: string
  maxWeightKg: number
  /** 最高重量のセットのうち最大の reps（reps の無いセットだけなら null） */
  repsAtMax: number | null
  /** 最高重量のセットのうち最大の秒（秒の無いセットだけなら null） */
  durationAtMax: number | null
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

  const workoutIds = [...new Set(sessions.map((s) => s.workoutId))]
  const workouts = (await database.workouts.bulkGet(workoutIds)).filter((w): w is Workout => w !== undefined)

  const entries: ExerciseHistoryEntry[] = []
  for (const workout of workouts.sort(compareWorkoutsDesc)) {
    const withSets = sessions
      .filter((s) => s.workoutId === workout.id)
      .sort((a, b) => a.order - b.order)
      .map((session) => ({ session, sets: (setsBySession.get(session.id) ?? []).sort((a, b) => a.setNumber - b.setNumber) }))
      .filter((x) => x.sets.length > 0)
    if (withSets.length > 0) entries.push({ workout, sessions: withSets })
  }

  const points: WeightPoint[] = entries
    .map(({ workout, sessions: ss }) => {
      const all = ss.flatMap((x) => x.sets)
      const maxWeightKg = Math.max(...all.map((s) => s.weightKg))
      const top = all.filter((s) => s.weightKg === maxWeightKg)
      const reps = top.map((s) => s.reps).filter((r): r is number => r !== null)
      const durations = top.map((s) => s.durationSec).filter((d): d is number => d !== null)
      return {
        workoutId: workout.id,
        date: workout.date,
        startedAt: workout.startedAt,
        maxWeightKg,
        repsAtMax: reps.length > 0 ? Math.max(...reps) : null,
        durationAtMax: durations.length > 0 ? Math.max(...durations) : null,
      }
    })
    .reverse()

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
