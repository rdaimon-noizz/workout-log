import { afterEach, describe, expect, it } from 'vitest'
import { WorkoutLogDB } from './db'
import { archiveExercise, createExercise } from './exercises'
import { findPreviousRecord, listExercisesWithHistory, listWorkoutSummaries, loadExerciseHistory } from './history'
import { addExerciseSession } from './sessions'
import { addSet } from './sets'
import { startWorkout } from './workouts'
import { combineLocalDateTime } from '../lib/time'

const dbs: WorkoutLogDB[] = []
function freshDb(): WorkoutLogDB {
  const database = new WorkoutLogDB(`test-${crypto.randomUUID()}`)
  dbs.push(database)
  return database
}
afterEach(async () => {
  for (const database of dbs.splice(0)) await database.delete()
})

/** date と HH:mm を指定して Workout を作る */
function workoutAt(database: WorkoutLogDB, date: string, time: string) {
  return startWorkout({ date, startedAt: combineLocalDateTime(date, time) }, database)
}

describe('findPreviousRecord', () => {
  it('current より前の最新 Workout の、最後のセッションを返す（同一 Workout 内の再登場は除く）', async () => {
    const database = freshDb()
    const dl = await createExercise({ name: 'Deadlift', muscles: [] }, database)
    const w1 = await workoutAt(database, '2026-09-10', '10:00')
    const s1 = await addExerciseSession(w1.id, dl.id, database)
    await addSet(s1.id, { weightKg: 200, reps: 5, durationSec: null }, database)
    const w2 = await workoutAt(database, '2026-09-15', '10:00')
    const s2a = await addExerciseSession(w2.id, dl.id, database)
    await addSet(s2a.id, { weightKg: 210, reps: 5, durationSec: null }, database)
    const s2b = await addExerciseSession(w2.id, dl.id, database)
    await addSet(s2b.id, { weightKg: 180, reps: 8, durationSec: null }, database)
    const w3 = await workoutAt(database, '2026-09-18', '10:00')
    const s3 = await addExerciseSession(w3.id, dl.id, database)
    await addSet(s3.id, { weightKg: 220, reps: 3, durationSec: null }, database)

    const prev = await findPreviousRecord(dl.id, w3, database)
    expect(prev?.workout.id).toBe(w2.id)
    expect(prev?.session.id).toBe(s2b.id)
    expect(prev?.sets.map((s) => s.weightKg)).toEqual([180])
    expect(await findPreviousRecord(dl.id, w1, database)).toBeUndefined()
  })

  it('同じ日付なら開始時刻で前後を判定する', async () => {
    const database = freshDb()
    const dl = await createExercise({ name: 'Deadlift', muscles: [] }, database)
    const am = await workoutAt(database, '2026-09-15', '07:00')
    const sAm = await addExerciseSession(am.id, dl.id, database)
    await addSet(sAm.id, { weightKg: 100, reps: 5, durationSec: null }, database)
    const pm = await workoutAt(database, '2026-09-15', '19:00')
    await addExerciseSession(pm.id, dl.id, database)
    expect((await findPreviousRecord(dl.id, pm, database))?.workout.id).toBe(am.id)
    expect(await findPreviousRecord(dl.id, am, database)).toBeUndefined()
  })
})

describe('loadExerciseHistory', () => {
  it('Workout ごとの最高重量と、その重量での最大 reps を古い順に返す。セットの無いセッションは除く', async () => {
    const database = freshDb()
    const dl = await createExercise({ name: 'Deadlift', muscles: [] }, database)
    const w1 = await workoutAt(database, '2026-09-10', '10:00')
    const s1 = await addExerciseSession(w1.id, dl.id, database)
    await addSet(s1.id, { weightKg: 200, reps: 5, durationSec: null }, database)
    await addSet(s1.id, { weightKg: 200, reps: 7, durationSec: null }, database)
    await addSet(s1.id, { weightKg: 180, reps: 10, durationSec: null }, database)
    const w2 = await workoutAt(database, '2026-09-15', '10:00')
    await addExerciseSession(w2.id, dl.id, database) // セットなし
    const w3 = await workoutAt(database, '2026-09-18', '10:00')
    const s3 = await addExerciseSession(w3.id, dl.id, database)
    await addSet(s3.id, { weightKg: 0, reps: null, durationSec: 60 }, database)

    const h = await loadExerciseHistory(dl.id, database)
    expect(h.exercise?.name).toBe('Deadlift')
    expect(h.entries.map((e) => e.workout.id)).toEqual([w3.id, w1.id])
    expect(h.points.map((p) => [p.date, p.maxLoadKg, p.repsAtMax, p.durationAtMax])).toEqual([
      ['2026-09-10', 200, 7, null],
      ['2026-09-18', 0, null, 60],
    ])
  })

  it('自重種目は 体重 + 加重 の最高負荷を点にし、体重が解決できない Workout は点を打たない', async () => {
    const database = freshDb()
    const pullUp = await createExercise({ name: 'Pull Up', muscles: ['広背筋'], usesBodyweight: true }, database)
    // 9/10: 体重なし・直近もなし → 点なし
    const w1 = await workoutAt(database, '2026-09-10', '10:00')
    const s1 = await addExerciseSession(w1.id, pullUp.id, database)
    await addSet(s1.id, { weightKg: 0, reps: 8, durationSec: null }, database)
    // 9/12: 体重 70
    const w2 = await startWorkout({ date: '2026-09-12', startedAt: combineLocalDateTime('2026-09-12', '10:00'), bodyweightKg: 70 }, database)
    const s2 = await addExerciseSession(w2.id, pullUp.id, database)
    await addSet(s2.id, { weightKg: 0, reps: 10, durationSec: null }, database)
    await addSet(s2.id, { weightKg: 10, reps: 6, durationSec: null }, database)
    // 9/15: 体重なし → 9/12 の 70 を使う
    const w3 = await workoutAt(database, '2026-09-15', '10:00')
    const s3 = await addExerciseSession(w3.id, pullUp.id, database)
    await addSet(s3.id, { weightKg: 5, reps: 8, durationSec: null }, database)

    const h = await loadExerciseHistory(pullUp.id, database)
    expect(h.entries).toHaveLength(3)
    expect(h.entries[0].bodyweight).toEqual({ kg: 70, source: 'previous', date: '2026-09-12' })
    expect(h.points.map((p) => [p.date, p.maxLoadKg, p.repsAtMax, p.bodyweight.source])).toEqual([
      ['2026-09-10', null, null, null],
      ['2026-09-12', 80, 6, 'this'],
      ['2026-09-15', 75, 8, 'previous'],
    ])
    expect(h.points.every((p) => p.usesBodyweight)).toBe(true)
    // 体重不明の日はボリューム・推定 1RM も null
    expect([h.points[0].volumeKg, h.points[0].e1rmKg]).toEqual([null, null])
    // 9/12: 70×10 + 80×6 = 1180、推定 1RM は max(70×(1+10/30)=93.3, 80×(1+6/30)=96) = 96
    expect([h.points[1].volumeKg, h.points[1].volumeReps, h.points[1].e1rmKg, h.points[1].e1rmSet]).toEqual([1180, 16, 96, { loadKg: 80, reps: 6 }])
  })

  it('ボリューム・負荷×時間・合計時間・推定 1RM を対象セットから計算する', async () => {
    const database = freshDb()
    const dl = await createExercise({ name: 'Deadlift', muscles: [] }, database)
    const w1 = await workoutAt(database, '2026-09-10', '10:00')
    const s1 = await addExerciseSession(w1.id, dl.id, database)
    await addSet(s1.id, { weightKg: 200, reps: 5, durationSec: null }, database)
    await addSet(s1.id, { weightKg: 200, reps: 7, durationSec: null }, database)
    await addSet(s1.id, { weightKg: 180, reps: 10, durationSec: null }, database)
    await addSet(s1.id, { weightKg: 150, reps: 3, durationSec: 2 }, database) // ポーズ: 回数と秒の両方
    await addSet(s1.id, { weightKg: 100, reps: null, durationSec: 30 }, database) // ホールドのみ

    const [p] = (await loadExerciseHistory(dl.id, database)).points
    expect(p.maxLoadKg).toBe(200)
    expect(p.repsAtMax).toBe(7)
    // ボリューム: 200×5 + 200×7 + 180×10 + 150×3 = 1000+1400+1800+450 = 4650（ホールドのみのセットは含まない）
    expect([p.volumeKg, p.volumeReps]).toEqual([4650, 25])
    // 推定 1RM: 200×(1+7/30) = 246.7 が最大
    expect([p.e1rmKg, p.e1rmSet]).toEqual([246.7, { loadKg: 200, reps: 7 }])
    // 負荷×時間: 150×2 + 100×30 = 3300（2 セット）。合計時間: 32 秒
    expect([p.loadSeconds, p.loadSecondsSets]).toEqual([3300, 2])
    expect([p.totalSeconds, p.durationSets]).toEqual([32, 2])
  })

  it('失敗セット（reps 0）は最高負荷と推定 1RM に入らず、ボリュームには 0 で入る', async () => {
    const database = freshDb()
    const dl = await createExercise({ name: 'Deadlift', muscles: [] }, database)
    const w1 = await workoutAt(database, '2026-09-10', '10:00')
    const s1 = await addExerciseSession(w1.id, dl.id, database)
    await addSet(s1.id, { weightKg: 200, reps: 5, durationSec: null }, database)
    await addSet(s1.id, { weightKg: 230, reps: 0, durationSec: null }, database) // 失敗

    const [p] = (await loadExerciseHistory(dl.id, database)).points
    expect([p.maxLoadKg, p.repsAtMax]).toEqual([200, 5])
    expect([p.volumeKg, p.volumeReps]).toEqual([1000, 5])
    expect(p.e1rmSet).toEqual({ loadKg: 200, reps: 5 })
  })

  it('失敗セットしか無い Workout は最高負荷・推定 1RM が null で、点は残る', async () => {
    const database = freshDb()
    const dl = await createExercise({ name: 'Deadlift', muscles: [] }, database)
    const w1 = await workoutAt(database, '2026-09-10', '10:00')
    const s1 = await addExerciseSession(w1.id, dl.id, database)
    await addSet(s1.id, { weightKg: 230, reps: 0, durationSec: null }, database)

    const { points } = await loadExerciseHistory(dl.id, database)
    expect(points).toHaveLength(1)
    expect([points[0].maxLoadKg, points[0].e1rmKg, points[0].volumeKg]).toEqual([null, null, 0])
  })

  it('秒だけの種目（プランク・通常種目扱い）は最高負荷 0、ボリューム・推定 1RM は null、合計時間は入る', async () => {
    const database = freshDb()
    const plank = await createExercise({ name: 'Plank', muscles: ['腹直筋'] }, database)
    const w1 = await workoutAt(database, '2026-09-10', '10:00')
    const s1 = await addExerciseSession(w1.id, plank.id, database)
    await addSet(s1.id, { weightKg: 0, reps: null, durationSec: 60 }, database)
    await addSet(s1.id, { weightKg: 0, reps: null, durationSec: 45 }, database)
    const [p] = (await loadExerciseHistory(plank.id, database)).points
    expect([p.maxLoadKg, p.durationAtMax, p.volumeKg, p.e1rmKg]).toEqual([0, 60, null, null])
    expect([p.loadSeconds, p.totalSeconds, p.durationSets]).toEqual([0, 105, 2])
  })

  it('記録が無ければ空', async () => {
    const database = freshDb()
    const dl = await createExercise({ name: 'Deadlift', muscles: [] }, database)
    expect(await loadExerciseHistory(dl.id, database)).toEqual({ exercise: expect.objectContaining({ id: dl.id }), entries: [], points: [] })
  })
})

describe('listWorkoutSummaries / listExercisesWithHistory', () => {
  it('Workout を新しい順に、種目名とセット数付きで返す', async () => {
    const database = freshDb()
    const dl = await createExercise({ name: 'Deadlift', muscles: [] }, database)
    const bp = await createExercise({ name: 'Bench Press', muscles: [] }, database)
    const w1 = await workoutAt(database, '2026-09-10', '10:00')
    const s1 = await addExerciseSession(w1.id, dl.id, database)
    await addSet(s1.id, { weightKg: 200, reps: 5, durationSec: null }, database)
    const w2 = await workoutAt(database, '2026-09-15', '10:00')
    const s2 = await addExerciseSession(w2.id, bp.id, database)
    const s2b = await addExerciseSession(w2.id, dl.id, database)
    await addSet(s2.id, { weightKg: 100, reps: 5, durationSec: null }, database)
    await addSet(s2b.id, { weightKg: 200, reps: 5, durationSec: null }, database)

    const list = await listWorkoutSummaries(database)
    expect(list.map((x) => [x.workout.id, x.exerciseNames, x.setCount])).toEqual([
      [w2.id, ['Bench Press', 'Deadlift'], 2],
      [w1.id, ['Deadlift'], 1],
    ])
  })

  it('種目別の入口: 記録のある種目が最後に行った日の新しい順、記録の無い有効種目も含む。アーカイブ済みは記録があれば含む', async () => {
    const database = freshDb()
    const dl = await createExercise({ name: 'Deadlift', muscles: [] }, database)
    const bp = await createExercise({ name: 'Bench Press', muscles: [] }, database)
    const sq = await createExercise({ name: 'Squat', muscles: [] }, database)
    const old = await createExercise({ name: 'Old Move', muscles: [] }, database)
    const none = await createExercise({ name: 'Never Done Archived', muscles: [] }, database)
    const w1 = await workoutAt(database, '2026-09-10', '10:00')
    await addExerciseSession(w1.id, dl.id, database)
    await addExerciseSession(w1.id, old.id, database)
    const w2 = await workoutAt(database, '2026-09-15', '10:00')
    await addExerciseSession(w2.id, bp.id, database)
    await addExerciseSession(w2.id, dl.id, database)
    await archiveExercise(old.id, database)
    await archiveExercise(none.id, database)

    const list = await listExercisesWithHistory(database)
    expect(list.map((x) => [x.exercise.name, x.workoutCount, x.lastDate])).toEqual([
      ['Bench Press', 1, '2026-09-15'],
      ['Deadlift', 2, '2026-09-15'],
      ['Old Move', 1, '2026-09-10'],
      ['Squat', 0, null],
    ])
    expect(list.some((x) => x.exercise.id === sq.id)).toBe(true)
  })
})
