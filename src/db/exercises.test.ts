import { afterEach, describe, expect, it } from 'vitest'
import { WorkoutLogDB } from './db'
import {
  archiveExercise,
  createExercise,
  filterExercises,
  listActiveExercises,
  listArchivedExercises,
  listUsedMuscles,
  normalizeMuscles,
  unarchiveExercise,
  updateExercise,
} from './exercises'

const dbs: WorkoutLogDB[] = []
function freshDb(): WorkoutLogDB {
  const database = new WorkoutLogDB(`test-${crypto.randomUUID()}`)
  dbs.push(database)
  return database
}
afterEach(async () => {
  for (const database of dbs.splice(0)) await database.delete()
})

describe('normalizeMuscles', () => {
  it('前後空白・連続空白を整え、空と重複を除き、順序を保つ', () => {
    expect(normalizeMuscles([' 広背筋 ', '', '僧帽筋', '広背筋', '大　胸筋'])).toEqual(['広背筋', '僧帽筋', '大 胸筋'])
  })
})

describe('createExercise', () => {
  it('名前と部位を整えて作成する', async () => {
    const database = freshDb()
    const ex = await createExercise({ name: '  Bench   Press ', muscles: ['大胸筋', '大胸筋', ' 上腕三頭筋'] }, database)
    expect(ex.name).toBe('Bench Press')
    expect(ex.nameKey).toBe('bench press')
    expect(ex.muscles).toEqual(['大胸筋', '上腕三頭筋'])
    expect(ex.archivedAt).toBe(null)
    expect(await listActiveExercises(database)).toHaveLength(1)
  })

  it('部位なしでも作成できる', async () => {
    const database = freshDb()
    const ex = await createExercise({ name: 'Farmer Walk', muscles: [] }, database)
    expect(ex.muscles).toEqual([])
  })

  it('空の名前は拒否する', async () => {
    const database = freshDb()
    await expect(createExercise({ name: '   ', muscles: [] }, database)).rejects.toThrow('種目名を入力してください')
  })

  it('大文字小文字だけ違う名前は重複として拒否する', async () => {
    const database = freshDb()
    await createExercise({ name: 'Deadlift', muscles: ['脊柱起立筋'] }, database)
    await expect(createExercise({ name: 'deadlift', muscles: [] }, database)).rejects.toMatchObject({
      name: 'DuplicateExerciseNameError',
      message: '同じ名前の種目があります: Deadlift',
    })
  })

  it('アーカイブ済みの同名種目がある場合はその旨を伝える', async () => {
    const database = freshDb()
    const ex = await createExercise({ name: 'Squat', muscles: ['大腿四頭筋'] }, database)
    await archiveExercise(ex.id, database)
    await expect(createExercise({ name: 'Squat', muscles: [] }, database)).rejects.toMatchObject({
      message: '同じ名前の種目がアーカイブにあります: Squat',
    })
  })
})

describe('updateExercise', () => {
  it('名前と部位を変更できる', async () => {
    const database = freshDb()
    const ex = await createExercise({ name: 'Row', muscles: [] }, database)
    await updateExercise(ex.id, { name: 'Barbell Row', muscles: ['広背筋', '僧帽筋'] }, database)
    const updated = await database.exercises.get(ex.id)
    expect(updated).toMatchObject({ name: 'Barbell Row', nameKey: 'barbell row', muscles: ['広背筋', '僧帽筋'] })
    expect(updated!.updatedAt >= ex.updatedAt).toBe(true)
  })

  it('他の種目と同じ名前には変更できないが、自分自身の表記変更はできる', async () => {
    const database = freshDb()
    const a = await createExercise({ name: 'Deadlift', muscles: [] }, database)
    await createExercise({ name: 'Squat', muscles: [] }, database)
    await expect(updateExercise(a.id, { name: 'squat' }, database)).rejects.toMatchObject({
      name: 'DuplicateExerciseNameError',
    })
    await expect(updateExercise(a.id, { name: 'DEADLIFT' }, database)).resolves.toBeUndefined()
    expect((await database.exercises.get(a.id))!.name).toBe('DEADLIFT')
  })
})

describe('listUsedMuscles', () => {
  it('アーカイブ含む全種目の部位を重複なしで返す（自由入力した部位も候補になる）', async () => {
    const database = freshDb()
    await createExercise({ name: 'A', muscles: ['広背筋', '前鋸筋'] }, database)
    const b = await createExercise({ name: 'B', muscles: ['広背筋', '僧帽筋'] }, database)
    await archiveExercise(b.id, database)
    expect([...(await listUsedMuscles(database))].sort()).toEqual(['前鋸筋', '僧帽筋', '広背筋'].sort())
  })
})

describe('archive / unarchive', () => {
  it('アーカイブすると選択肢から消え、復元すると戻る', async () => {
    const database = freshDb()
    const ex = await createExercise({ name: 'Lat Pulldown', muscles: ['広背筋'] }, database)
    await archiveExercise(ex.id, database)
    expect(await listActiveExercises(database)).toHaveLength(0)
    expect(await listArchivedExercises(database)).toHaveLength(1)
    await unarchiveExercise(ex.id, database)
    expect(await listActiveExercises(database)).toHaveLength(1)
    expect(await listArchivedExercises(database)).toHaveLength(0)
  })
})

describe('filterExercises', () => {
  it('部分一致・大文字小文字無視で絞り込む。空文字は全件', async () => {
    const database = freshDb()
    await createExercise({ name: 'Bench Press', muscles: [] }, database)
    await createExercise({ name: 'Incline Bench', muscles: [] }, database)
    await createExercise({ name: 'Squat', muscles: [] }, database)
    const all = await listActiveExercises(database)
    expect(filterExercises(all, 'bench').map((e) => e.name)).toEqual(['Bench Press', 'Incline Bench'])
    expect(filterExercises(all, 'SQ')).toHaveLength(1)
    expect(filterExercises(all, '  ')).toHaveLength(3)
  })
})
