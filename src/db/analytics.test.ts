import { afterEach, describe, expect, it } from 'vitest'
import { WorkoutLogDB } from './db'
import { aggregateMuscles, aggregateWeekly, availableWeeklyMetrics, filterOptions, loadSetFacts, weekTotals } from './analytics'
import { createExercise } from './exercises'
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

/** 2 週分の記録。9/14 週と 9/21 週 */
async function seed(database: WorkoutLogDB) {
  const dl = await createExercise({ name: 'Deadlift', muscles: ['脊柱起立筋', 'ハムストリング'] }, database)
  const pullUp = await createExercise({ name: 'Pull Up', muscles: ['広背筋'], usesBodyweight: true }, database)
  const plank = await createExercise({ name: 'Plank', muscles: [] }, database)
  // 9/15（火）体重 70
  const w1 = await startWorkout({ date: '2026-09-15', startedAt: combineLocalDateTime('2026-09-15', '10:00'), bodyweightKg: 70 }, database)
  const s1 = await addExerciseSession(w1.id, dl.id, database)
  await addSet(s1.id, { weightKg: 200, reps: 5, durationSec: null }, database)
  await addSet(s1.id, { weightKg: 200, reps: 5, durationSec: null }, database)
  const s2 = await addExerciseSession(w1.id, pullUp.id, database)
  await addSet(s2.id, { weightKg: 10, reps: 8, durationSec: null }, database) // 負荷 80
  // 9/20（日）体重なし → 直近 70。プランク 60 秒
  const w2 = await startWorkout({ date: '2026-09-20', startedAt: combineLocalDateTime('2026-09-20', '10:00') }, database)
  const s3 = await addExerciseSession(w2.id, plank.id, database)
  await addSet(s3.id, { weightKg: 0, reps: null, durationSec: 60 }, database)
  // 9/22（火）次の週
  const w3 = await startWorkout({ date: '2026-09-22', startedAt: combineLocalDateTime('2026-09-22', '10:00') }, database)
  const s4 = await addExerciseSession(w3.id, dl.id, database)
  await addSet(s4.id, { weightKg: 210, reps: 3, durationSec: null }, database)
  return { dl, pullUp, plank }
}

describe('loadSetFacts', () => {
  it('セットに Workout・種目・週・負荷を結合する', async () => {
    const database = freshDb()
    await seed(database)
    const facts = await loadSetFacts(database)
    expect(facts).toHaveLength(5)
    const pull = facts.find((f) => f.exerciseName === 'Pull Up')!
    expect(pull).toMatchObject({ date: '2026-09-15', weekStart: '2026-09-14', muscles: ['広背筋'], usesBodyweight: true, loadKg: 80, reps: 8 })
    const plank = facts.find((f) => f.exerciseName === 'Plank')!
    expect(plank).toMatchObject({ weekStart: '2026-09-14', loadKg: 0, reps: null, durationSec: 60 })
  })
})

describe('aggregateWeekly', () => {
  it('直近 N 週を 0 埋めで古い順に返し、指標を合計する', async () => {
    const database = freshDb()
    await seed(database)
    const facts = await loadSetFacts(database)
    const rows = aggregateWeekly(facts, { kind: 'all' }, 3, '2026-09-21')
    expect(rows.map((r) => r.weekStart)).toEqual(['2026-09-07', '2026-09-14', '2026-09-21'])
    expect(rows[0]).toMatchObject({ volumeKg: 0, sets: 0, reps: 0, seconds: 0, workoutDays: 0 })
    // 9/14 週: 200×5 + 200×5 + 80×8 = 2640、セット 4、回数 18、秒 60、日数 2（9/15, 9/20）
    expect(rows[1]).toEqual({ weekStart: '2026-09-14', volumeKg: 2640, sets: 4, reps: 18, seconds: 60, workoutDays: 2 })
    expect(rows[2]).toEqual({ weekStart: '2026-09-21', volumeKg: 630, sets: 1, reps: 3, seconds: 0, workoutDays: 1 })
  })

  it('種目・部位で絞り込める', async () => {
    const database = freshDb()
    const { dl } = await seed(database)
    const facts = await loadSetFacts(database)
    const byExercise = aggregateWeekly(facts, { kind: 'exercise', exerciseId: dl.id }, 2, '2026-09-21')
    expect(byExercise.map((r) => [r.weekStart, r.volumeKg, r.sets])).toEqual([
      ['2026-09-14', 2000, 2],
      ['2026-09-21', 630, 1],
    ])
    const byMuscle = aggregateWeekly(facts, { kind: 'muscle', muscle: '広背筋' }, 2, '2026-09-21')
    expect(byMuscle.map((r) => [r.weekStart, r.volumeKg, r.sets])).toEqual([
      ['2026-09-14', 640, 1],
      ['2026-09-21', 0, 0],
    ])
    const unset = aggregateWeekly(facts, { kind: 'muscle', muscle: '部位未設定' }, 1, '2026-09-14')
    expect(unset[0]).toMatchObject({ sets: 1, seconds: 60, volumeKg: 0 })
  })
})

describe('availableWeeklyMetrics', () => {
  it('範囲内で値の無い指標は出さない（セット数・日数は常に）', async () => {
    const database = freshDb()
    await seed(database)
    const facts = await loadSetFacts(database)
    const keys = (rows: ReturnType<typeof aggregateWeekly>) => availableWeeklyMetrics(rows).map((m) => m.key)
    expect(keys(aggregateWeekly(facts, { kind: 'all' }, 2, '2026-09-21'))).toEqual(['volumeKg', 'sets', 'reps', 'seconds', 'workoutDays'])
    expect(keys(aggregateWeekly(facts, { kind: 'all' }, 1, '2026-09-21'))).toEqual(['volumeKg', 'sets', 'reps', 'workoutDays'])
    expect(keys(aggregateWeekly(facts, { kind: 'all' }, 1, '2026-08-03'))).toEqual(['sets', 'workoutDays'])
  })
})

describe('aggregateMuscles / weekTotals / filterOptions', () => {
  it('部位ごとに満額で数え、セット数の多い順。部位の無い種目は「部位未設定」', async () => {
    const database = freshDb()
    await seed(database)
    const facts = await loadSetFacts(database)
    expect(aggregateMuscles(facts, '2026-09-14')).toEqual([
      { muscle: 'ハムストリング', sets: 2, reps: 10, volumeKg: 2000 },
      { muscle: '脊柱起立筋', sets: 2, reps: 10, volumeKg: 2000 },
      { muscle: '広背筋', sets: 1, reps: 8, volumeKg: 640 },
      { muscle: '部位未設定', sets: 1, reps: 0, volumeKg: 0 },
    ])
    // 合計は部位の重複を数えない実数
    expect(weekTotals(facts, '2026-09-14')).toMatchObject({ sets: 4, volumeKg: 2640, workoutDays: 2 })
    expect(aggregateMuscles(facts, '2026-08-03')).toEqual([])
    expect(filterOptions(facts)).toEqual({
      exercises: [
        { id: expect.any(String), name: 'Deadlift' },
        { id: expect.any(String), name: 'Plank' },
        { id: expect.any(String), name: 'Pull Up' },
      ],
      muscles: ['ハムストリング', '広背筋', '脊柱起立筋', '部位未設定'],
    })
  })
})
