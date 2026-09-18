/** 初回起動時に投入する種目と部位。移行処理（legacy.ts）からも参照する */
export const INITIAL_EXERCISES: ReadonlyArray<{ name: string; muscles: string[] }> = [
  { name: 'Deadlift', muscles: ['脊柱起立筋', 'ハムストリング', '大臀筋'] },
  { name: 'Bench Press', muscles: ['大胸筋', '上腕三頭筋'] },
  { name: 'Squat', muscles: ['大腿四頭筋', '大臀筋'] },
  { name: 'Romanian Deadlift', muscles: ['ハムストリング', '大臀筋'] },
  { name: 'Lat Pulldown', muscles: ['広背筋'] },
  { name: 'Barbell Row', muscles: ['広背筋', '僧帽筋'] },
  { name: 'Overhead Press', muscles: ['三角筋', '上腕三頭筋'] },
]
