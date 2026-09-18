import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'

export default function HomePage() {
  const exerciseCount = useLiveQuery(() => db.exercises.count(), [])

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-6">
      <h1 className="text-2xl font-bold">筋トレ記録</h1>

      <section className="rounded-2xl bg-slate-900 p-4">
        <p className="text-sm text-slate-400">Phase 1: 基盤</p>
        <p className="mt-1 text-lg">登録種目 {exerciseCount ?? '…'} 件</p>
      </section>

      <section className="rounded-2xl bg-slate-900 p-4 text-sm leading-relaxed text-slate-300">
        <h2 className="mb-2 font-semibold text-slate-100">iPhone へのインストール</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Safari でこのページを開く</li>
          <li>共有ボタン →「ホーム画面に追加」</li>
          <li>以後はホーム画面のアイコンから起動する（Safari 側とは保存領域が別）</li>
        </ol>
      </section>
    </main>
  )
}
