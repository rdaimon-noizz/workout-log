/** 種目カテゴリ（保存値は英語コード。表示ラベルは EXERCISE_CATEGORY_LABELS） */
export const EXERCISE_CATEGORIES = ['chest', 'back', 'shoulder', 'legs', 'arms', 'core', 'other'] as const
export type ExerciseCategory = (typeof EXERCISE_CATEGORIES)[number]

export const EXERCISE_CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  chest: '胸',
  back: '背中',
  shoulder: '肩',
  legs: '脚',
  arms: '腕',
  core: '体幹',
  other: 'その他',
}

/** ISO 8601 オフセット付き時刻文字列（例 2026-09-18T19:30:00+09:00） */
export type IsoDateTime = string
/** 端末ローカルの日付文字列 YYYY-MM-DD */
export type LocalDate = string

/** 種目マスタ。削除は物理削除せず archivedAt を立てる */
export interface Exercise {
  id: string
  name: string
  /** name を正規化した一意キー（小文字化・前後空白除去・連続空白の圧縮） */
  nameKey: string
  category: ExerciseCategory
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
  archivedAt: IsoDateTime | null
}

/** 1 回のトレーニング全体 */
export interface Workout {
  id: string
  date: LocalDate
  startedAt: IsoDateTime
  /** null = 進行中 */
  endedAt: IsoDateTime | null
  bodyweightKg: number | null
  memo: string
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

/** Workout 内で行った 1 種目 */
export interface ExerciseSession {
  id: string
  workoutId: string
  exerciseId: string
  /** Workout 内の並び順（1 始まり。削除時に振り直す） */
  order: number
  memo: string
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

/** 1 セットの実績。JS 組み込みの Set と衝突するため WorkoutSet と呼ぶ */
export interface WorkoutSet {
  id: string
  exerciseSessionId: string
  /** セッション内の何本目か（1 始まり。削除時に振り直す） */
  setNumber: number
  /** kg。小数可。自重種目は 0 */
  weightKg: number
  reps: number
  memo: string
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}
