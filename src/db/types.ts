/** ISO 8601 オフセット付き時刻文字列（例 2026-09-18T19:30:00+09:00） */
export type IsoDateTime = string
/** 端末ローカルの日付文字列 YYYY-MM-DD */
export type LocalDate = string

/**
 * 部位の候補。ユーザーが自由に追加した部位は、既存種目で使われているものを集めて候補に加える。
 * 保存値は文字列そのもの（コード表は持たない）。
 */
export const MUSCLE_SUGGESTIONS: readonly string[] = [
  '大胸筋',
  '広背筋',
  '僧帽筋',
  '脊柱起立筋',
  '三角筋',
  '上腕二頭筋',
  '上腕三頭筋',
  '前腕',
  '腹直筋',
  '腹斜筋',
  '大腿四頭筋',
  'ハムストリング',
  '大臀筋',
  '内転筋',
  'ふくらはぎ',
  '全身',
  'その他',
]

/** 種目マスタ。削除は物理削除せず archivedAt を立てる */
export interface Exercise {
  id: string
  name: string
  /** name を正規化した一意キー（小文字化・前後空白除去・連続空白の圧縮） */
  nameKey: string
  /** 部位（複数可・空も可）。Dexie では multiEntry インデックス */
  muscles: string[]
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
  /** 回数。秒だけの種目（プランク等）では null */
  reps: number | null
  /** 秒（ホールド時間やポーズ秒。意味は種目ごとに統一する）。使わなければ null */
  durationSec: number | null
  memo: string
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}
