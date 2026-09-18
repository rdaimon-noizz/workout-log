import { db, type WorkoutLogDB } from './db'
import { computeLoad, resolveBodyweight } from '../lib/load'
import { addWeeks, currentWeekStart, weekStartOf } from '../lib/week'

/** 集計用の 1 セット分の事実（Workout・種目の情報を結合し、負荷を解決したもの） */
export interface SetFact {
  workoutId: string
  date: string
  weekStart: string
  exerciseId: string
  exerciseName: string
  muscles: string[]
  usesBodyweight: boolean
  /** 負荷（v4 の規則）。体重不明の自重種目は null */
  loadKg: number | null
  reps: number | null
  durationSec: number | null
}

export async function loadSetFacts(database: WorkoutLogDB = db): Promise<SetFact[]> {
  const [workouts, sessions, sets, exercises] = await Promise.all([
    database.workouts.toArray(),
    database.exerciseSessions.toArray(),
    database.workoutSets.toArray(),
    database.exercises.toArray(),
  ])
  const workoutById = new Map(workouts.map((w) => [w.id, w]))
  const sessionById = new Map(sessions.map((s) => [s.id, s]))
  const exerciseById = new Map(exercises.map((e) => [e.id, e]))
  const bodyweightByWorkout = new Map(workouts.map((w) => [w.id, resolveBodyweight(w, workouts)]))

  const facts: SetFact[] = []
  for (const set of sets) {
    const session = sessionById.get(set.exerciseSessionId)
    const workout = session && workoutById.get(session.workoutId)
    const exercise = session && exerciseById.get(session.exerciseId)
    if (!session || !workout || !exercise) continue
    facts.push({
      workoutId: workout.id,
      date: workout.date,
      weekStart: weekStartOf(workout.date),
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      muscles: exercise.muscles,
      usesBodyweight: exercise.usesBodyweight,
      loadKg: computeLoad(set.weightKg, exercise.usesBodyweight, bodyweightByWorkout.get(workout.id)?.kg ?? null),
      reps: set.reps,
      durationSec: set.durationSec,
    })
  }
  return facts
}

export type AnalyticsFilter = { kind: 'all' } | { kind: 'exercise'; exerciseId: string } | { kind: 'muscle'; muscle: string }

export const NO_MUSCLE = '部位未設定'

function musclesOf(f: SetFact): string[] {
  return f.muscles.length > 0 ? f.muscles : [NO_MUSCLE]
}

export function matchesFilter(f: SetFact, filter: AnalyticsFilter): boolean {
  if (filter.kind === 'all') return true
  if (filter.kind === 'exercise') return f.exerciseId === filter.exerciseId
  return musclesOf(f).includes(filter.muscle)
}

export interface WeeklyRow {
  weekStart: string
  volumeKg: number
  sets: number
  reps: number
  seconds: number
  workoutDays: number
}

const round2 = (v: number) => Math.round(v * 100) / 100

/** 直近 weeks 週（endWeekStart の週を含む）を古い順に。記録の無い週は 0 */
export function aggregateWeekly(
  facts: readonly SetFact[],
  filter: AnalyticsFilter,
  weeks: number,
  endWeekStart: string = currentWeekStart(),
): WeeklyRow[] {
  const rows = new Map<string, WeeklyRow & { days: Set<string> }>()
  const firstWeek = addWeeks(endWeekStart, -(weeks - 1))
  for (let i = 0; i < weeks; i++) {
    const weekStart = addWeeks(firstWeek, i)
    rows.set(weekStart, { weekStart, volumeKg: 0, sets: 0, reps: 0, seconds: 0, workoutDays: 0, days: new Set() })
  }
  for (const f of facts) {
    if (!matchesFilter(f, filter)) continue
    const row = rows.get(f.weekStart)
    if (!row) continue
    row.sets += 1
    if (f.reps !== null) {
      row.reps += f.reps
      if (f.loadKg !== null) row.volumeKg += f.loadKg * f.reps
    }
    if (f.durationSec !== null) row.seconds += f.durationSec
    row.days.add(f.date)
  }
  return [...rows.values()].map(({ days, ...row }) => ({ ...row, volumeKg: round2(row.volumeKg), workoutDays: days.size }))
}

export interface MuscleRow {
  muscle: string
  sets: number
  reps: number
  volumeKg: number
}

/** 1 週間の部位別。種目の各部位に満額で数える（分割しない）。セット数の多い順 */
export function aggregateMuscles(facts: readonly SetFact[], weekStart: string): MuscleRow[] {
  const rows = new Map<string, MuscleRow>()
  for (const f of facts) {
    if (f.weekStart !== weekStart) continue
    for (const muscle of musclesOf(f)) {
      const row = rows.get(muscle) ?? { muscle, sets: 0, reps: 0, volumeKg: 0 }
      row.sets += 1
      if (f.reps !== null) {
        row.reps += f.reps
        if (f.loadKg !== null) row.volumeKg += f.loadKg * f.reps
      }
      rows.set(muscle, row)
    }
  }
  return [...rows.values()]
    .map((r) => ({ ...r, volumeKg: round2(r.volumeKg) }))
    .sort((a, b) => b.sets - a.sets || b.volumeKg - a.volumeKg || a.muscle.localeCompare(b.muscle, 'ja'))
}

/** 1 週間の合計（部位の重複を数えない実数） */
export function weekTotals(facts: readonly SetFact[], weekStart: string): WeeklyRow {
  return aggregateWeekly(facts, { kind: 'all' }, 1, weekStart)[0]
}

/** 対象の選択肢: 記録のある種目と部位（名前順） */
export function filterOptions(facts: readonly SetFact[]): { exercises: Array<{ id: string; name: string }>; muscles: string[] } {
  const exercises = new Map<string, string>()
  const muscles = new Set<string>()
  for (const f of facts) {
    exercises.set(f.exerciseId, f.exerciseName)
    for (const m of musclesOf(f)) muscles.add(m)
  }
  return {
    exercises: [...exercises].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'ja')),
    muscles: [...muscles].sort((a, b) => a.localeCompare(b, 'ja')),
  }
}

export type WeeklyMetricKey = 'volumeKg' | 'sets' | 'reps' | 'seconds' | 'workoutDays'

export interface WeeklyMetricDef {
  key: WeeklyMetricKey
  label: string
  unit: string
  value: (row: WeeklyRow) => number
  format: (v: number) => string
  /** 範囲内の値がすべて 0 でも出すか */
  alwaysShow: boolean
}

const num = (v: number) => v.toLocaleString('ja-JP', { maximumFractionDigits: 2 })

export const WEEKLY_METRICS: readonly WeeklyMetricDef[] = [
  { key: 'volumeKg', label: 'ボリューム', unit: 'kg', value: (r) => r.volumeKg, format: (v) => `${num(v)} kg`, alwaysShow: false },
  { key: 'sets', label: 'セット数', unit: 'セット', value: (r) => r.sets, format: (v) => `${num(v)} セット`, alwaysShow: true },
  { key: 'reps', label: '回数', unit: '回', value: (r) => r.reps, format: (v) => `${num(v)} 回`, alwaysShow: false },
  { key: 'seconds', label: '合計時間', unit: '秒', value: (r) => r.seconds, format: (v) => `${num(v)} 秒`, alwaysShow: false },
  { key: 'workoutDays', label: 'トレーニング日数', unit: '日', value: (r) => r.workoutDays, format: (v) => `${num(v)} 日`, alwaysShow: true },
]

/** 範囲内で値のある指標だけ（セット数・日数は常に） */
export function availableWeeklyMetrics(rows: readonly WeeklyRow[]): WeeklyMetricDef[] {
  return WEEKLY_METRICS.filter((m) => m.alwaysShow || rows.some((r) => m.value(r) > 0))
}
