import { INITIAL_EXERCISES } from './initialExercises'

/** スキーマ版 1 の種目カテゴリ（単一選択） */
export type LegacyExerciseCategory = 'chest' | 'back' | 'shoulder' | 'legs' | 'arms' | 'core' | 'other'

const LEGACY_CATEGORY_MUSCLE: Record<LegacyExerciseCategory, string> = {
  chest: '大胸筋',
  shoulder: '三角筋',
  core: '腹直筋',
  back: '背中',
  legs: '脚',
  arms: '腕',
  other: 'その他',
}

const SEED_MUSCLES_BY_NAME_KEY = new Map(INITIAL_EXERCISES.map((e) => [e.name.toLowerCase(), e.muscles]))

/**
 * 版 1 の category を版 2 の部位配列に変換する。
 * 初期種目は名前で判定して細かい部位を割り当て、それ以外は旧カテゴリに対応する 1 部位にする。
 */
export function legacyMuscles(nameKey: string, category: string | undefined): string[] {
  const seeded = SEED_MUSCLES_BY_NAME_KEY.get(nameKey)
  if (seeded) return [...seeded]
  const mapped = LEGACY_CATEGORY_MUSCLE[category as LegacyExerciseCategory]
  return mapped ? [mapped] : []
}
