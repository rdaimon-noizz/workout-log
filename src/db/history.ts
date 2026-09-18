import { db, type WorkoutLogDB } from './db'
import type { Exercise, ExerciseSession, Workout, WorkoutSet } from './types'
import { computeLoad, resolveBodyweight, type ResolvedBodyweight } from '../lib/load'
import { estimateOneRepMax } from '../lib/metrics'
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

/**
 * グラフの 1 点 = 1 Workout。指標ごとに値を持ち、対象セットが無い指標は null（その指標では点を打たない）。
 * 負荷 = 通常種目は重量、自重種目は 体重 + 加重（体重が不明なら負荷も不明）。
 */
export interface HistoryPoint {
  workoutId: string
  date: string
  startedAt: string
  usesBodyweight: boolean
  /** 使った体重とその出典（自重種目の表示用） */
  bodyweight: ResolvedBodyweight
  /** 最高負荷。負荷の分かるセットが無ければ null */
  maxLoadKg: number | null
  /** 最高負荷のセットのうち最大の reps / 秒 */
  repsAtMax: number | null
  durationAtMax: number | null
  /** ボリューム = Σ 負荷 × 回数（回数があり負荷の分かるセット）。無ければ null */
  volumeKg: number | null
  volumeReps: number
  /** 負荷×時間 = Σ 負荷 × 秒（秒があり負荷の分かるセット）。無ければ null */
  loadSeconds: number | null
  loadSecondsSets: number
  /** 合計時間 = Σ 秒（秒のあるセット。負荷は不要）。無ければ null */
  totalSeconds: number | null
  durationSets: number
  /** 推定 1RM（Epley）の最大と、その元になったセット */
  e1rmKg: number | null
  e1rmSet: { loadKg: number; reps: number } | null
}

export interface ExerciseHistory {
  exercise: Exercise | undefined
  /** 新しい順 */
  entries: ExerciseHistoryEntry[]
  /** 古い順（時系列グラフ用）。entries と同じ Workout を含む */
  points: HistoryPoint[]
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

  const points = entries.map(({ workout, sessions: ss, bodyweight }) =>
    buildPoint(workout, ss.flatMap((x) => x.sets), usesBodyweight, bodyweight),
  )
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

const round2 = (v: number) => Math.round(v * 100) / 100

/** 1 Workout 分のセットから各指標を計算する */
export function buildPoint(
  workout: Workout,
  sets: readonly WorkoutSet[],
  usesBodyweight: boolean,
  bodyweight: ResolvedBodyweight,
): HistoryPoint {
  const loaded = sets
    .map((set) => ({ set, load: computeLoad(set.weightKg, usesBodyweight, bodyweight.kg) }))
    .filter((x): x is { set: WorkoutSet; load: number } => x.load !== null)

  // 最高負荷
  let maxLoadKg: number | null = null
  let repsAtMax: number | null = null
  let durationAtMax: number | null = null
  if (loaded.length > 0) {
    maxLoadKg = Math.max(...loaded.map((x) => x.load))
    const top = loaded.filter((x) => x.load === maxLoadKg).map((x) => x.set)
    const reps = top.map((t) => t.reps).filter((r): r is number => r !== null)
    const durations = top.map((t) => t.durationSec).filter((d): d is number => d !== null)
    repsAtMax = reps.length > 0 ? Math.max(...reps) : null
    durationAtMax = durations.length > 0 ? Math.max(...durations) : null
  }

  // ボリュームと推定 1RM（回数のあるセット）
  const repSets = loaded.filter((x) => x.set.reps !== null) as Array<{ set: WorkoutSet & { reps: number }; load: number }>
  const volumeKg = repSets.length > 0 ? round2(repSets.reduce((sum, x) => sum + x.load * x.set.reps, 0)) : null
  const volumeReps = repSets.reduce((sum, x) => sum + x.set.reps, 0)
  let e1rmKg: number | null = null
  let e1rmSet: HistoryPoint['e1rmSet'] = null
  for (const x of repSets) {
    const est = estimateOneRepMax(x.load, x.set.reps)
    if (e1rmKg === null || est > e1rmKg) {
      e1rmKg = est
      e1rmSet = { loadKg: x.load, reps: x.set.reps }
    }
  }

  // 負荷×時間（秒があり負荷の分かるセット）と合計時間（秒のある全セット）
  const durLoaded = loaded.filter((x) => x.set.durationSec !== null) as Array<{ set: WorkoutSet & { durationSec: number }; load: number }>
  const loadSeconds = durLoaded.length > 0 ? round2(durLoaded.reduce((sum, x) => sum + x.load * x.set.durationSec, 0)) : null
  const durAll = sets.filter((t) => t.durationSec !== null) as Array<WorkoutSet & { durationSec: number }>
  const totalSeconds = durAll.length > 0 ? durAll.reduce((sum, t) => sum + t.durationSec, 0) : null

  return {
    workoutId: workout.id,
    date: workout.date,
    startedAt: workout.startedAt,
    usesBodyweight,
    bodyweight,
    maxLoadKg,
    repsAtMax,
    durationAtMax,
    volumeKg,
    volumeReps,
    loadSeconds,
    loadSecondsSets: durLoaded.length,
    totalSeconds,
    durationSets: durAll.length,
    e1rmKg,
    e1rmSet,
  }
}
