import { db, type WorkoutLogDB } from './db'
import type { WorkoutSet } from './types'
import { newId, nowIso } from '../lib/time'

export interface SetInput {
  weightKg: number
  /** 回数。秒だけの種目では null */
  reps: number | null
  /** 秒。使わなければ null */
  durationSec: number | null
  memo?: string
}

export function validateSetInput(input: Pick<SetInput, 'weightKg' | 'reps' | 'durationSec'>): void {
  if (!Number.isFinite(input.weightKg) || input.weightKg < 0) {
    throw new Error('重量は 0 以上の数値で入力してください')
  }
  if (input.reps !== null && (!Number.isInteger(input.reps) || input.reps < 1)) {
    throw new Error('Reps は 1 以上の整数で入力してください')
  }
  if (input.durationSec !== null && (!Number.isInteger(input.durationSec) || input.durationSec < 1)) {
    throw new Error('秒は 1 以上の整数で入力してください')
  }
  if (input.reps === null && input.durationSec === null) {
    throw new Error('Reps か秒のどちらかを入力してください')
  }
}

export function listSets(sessionId: string, database: WorkoutLogDB = db): Promise<WorkoutSet[]> {
  return database.workoutSets.where('exerciseSessionId').equals(sessionId).sortBy('setNumber')
}

/** セットを末尾に追加する。setNumber は既存の最大値 + 1 */
export async function addSet(sessionId: string, input: SetInput, database: WorkoutLogDB = db): Promise<WorkoutSet> {
  validateSetInput(input)
  return database.transaction('rw', database.workoutSets, async () => {
    const existing = await database.workoutSets.where('exerciseSessionId').equals(sessionId).toArray()
    const setNumber = existing.reduce((max, s) => Math.max(max, s.setNumber), 0) + 1
    const now = nowIso()
    const set: WorkoutSet = {
      id: newId(),
      exerciseSessionId: sessionId,
      setNumber,
      weightKg: input.weightKg,
      reps: input.reps,
      durationSec: input.durationSec,
      memo: input.memo ?? '',
      createdAt: now,
      updatedAt: now,
    }
    await database.workoutSets.add(set)
    return set
  })
}

/** 指定した項目だけ変更する。null を渡すとその項目を消す（undefined は変更なし） */
export async function updateSet(id: string, patch: Partial<SetInput>, database: WorkoutLogDB = db): Promise<void> {
  await database.transaction('rw', database.workoutSets, async () => {
    const current = await database.workoutSets.get(id)
    if (!current) throw new Error('セットが見つかりません')
    const next = {
      weightKg: patch.weightKg ?? current.weightKg,
      reps: patch.reps !== undefined ? patch.reps : current.reps,
      durationSec: patch.durationSec !== undefined ? patch.durationSec : current.durationSec,
    }
    validateSetInput(next)
    await database.workoutSets.update(id, { ...next, memo: patch.memo ?? current.memo, updatedAt: nowIso() })
  })
}

/** セットを削除し、残ったセットの setNumber を 1 から振り直す */
export async function deleteSet(id: string, database: WorkoutLogDB = db): Promise<void> {
  await database.transaction('rw', database.workoutSets, async () => {
    const set = await database.workoutSets.get(id)
    if (!set) return
    await database.workoutSets.delete(id)
    const rest = await database.workoutSets.where('exerciseSessionId').equals(set.exerciseSessionId).sortBy('setNumber')
    for (const [i, s] of rest.entries()) {
      if (s.setNumber !== i + 1) await database.workoutSets.update(s.id, { setNumber: i + 1 })
    }
  })
}
