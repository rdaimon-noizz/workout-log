import { afterEach, describe, expect, it } from 'vitest'
import { WorkoutLogDB } from './db'
import {
  archiveExercise,
  createExercise,
  filterExercises,
  listActiveExercises,
  listArchivedExercises,
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

describe('createExercise', () => {
  it('前後の空白と連続空白を整えて作成する', async () => {
    const database = freshDb()
    const ex = await createExercise({ name: '  Bench   Press ', category: 'chest' }, database)
    expect(ex.name).toBe('Bench Press')
    expect(ex.nameKey).toBe('bench press')
    expect(ex.archivedAt).toBe(null)
    expect(await listActiveExercises(database)).toHaveLength(1)
  })

  it('空の名前は拒否する', async () => {
    const database = freshDb()
    await expect(createExercise({ name: '   ', category: 'other' }, database)).rejects.toThrow('種目名を入力してください')
  })

  it('大文字小文字だけ違う名前は重複として拒否する', async () => {
    const database = freshDb()
    await createExercise({ name: 'Deadlift', category: 'back' }, database)
    await expect(createExercise({ name: 'deadlift', category: 'back' }, database)).rejects.toMatchObject({
      name: 'DuplicateExerciseNameError',
      message: '同じ名前の種目があります: Deadlift',
    })
  })

  it('アーカイブ済みの同名種目がある場合はその旨を伝える', async () => {
    const database = freshDb()
    const ex = await createExercise({ name: 'Squat', category: 'legs' }, database)
    await archiveExercise(ex.id, database)
    await expect(createExercise({ name: 'Squat', category: 'legs' }, database)).rejects.toMatchObject({
      message: '同じ名前の種目がアーカイブにあります: Squat',
    })
  })
})

describe('updateExercise', () => {
  it('名前とカテゴリを変更できる', async () => {
    const database = freshDb()
    const ex = await createExercise({ name: 'Row', category: 'other' }, database)
    await updateExercise(ex.id, { name: 'Barbell Row', category: 'back' }, database)
    const updated = await database.exercises.get(ex.id)
    expect(updated).toMatchObject({ name: 'Barbell Row', nameKey: 'barbell row', category: 'back' })
    expect(updated!.updatedAt >= ex.updatedAt).toBe(true)
  })

  it('他の種目と同じ名前には変更できないが、自分自身の表記変更はできる', async () => {
    const database = freshDb()
    const a = await createExercise({ name: 'Deadlift', category: 'back' }, database)
    await createExercise({ name: 'Squat', category: 'legs' }, database)
    await expect(updateExercise(a.id, { name: 'squat' }, database)).rejects.toMatchObject({
      name: 'DuplicateExerciseNameError',
    })
    await expect(updateExercise(a.id, { name: 'DEADLIFT' }, database)).resolves.toBeUndefined()
    expect((await database.exercises.get(a.id))!.name).toBe('DEADLIFT')
  })
})

describe('archive / unarchive', () => {
  it('アーカイブすると選択肢から消え、復元すると戻る', async () => {
    const database = freshDb()
    const ex = await createExercise({ name: 'Lat Pulldown', category: 'back' }, database)
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
    await createExercise({ name: 'Bench Press', category: 'chest' }, database)
    await createExercise({ name: 'Incline Bench', category: 'chest' }, database)
    await createExercise({ name: 'Squat', category: 'legs' }, database)
    const all = await listActiveExercises(database)
    expect(filterExercises(all, 'bench').map((e) => e.name)).toEqual(['Bench Press', 'Incline Bench'])
    expect(filterExercises(all, 'SQ')).toHaveLength(1)
    expect(filterExercises(all, '  ')).toHaveLength(3)
  })
})
