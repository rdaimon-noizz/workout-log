import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState, type ChangeEvent } from 'react'
import { AppShell } from '../components/AppShell'
import { btnPrimary, btnSecondary, card, label } from '../components/ui'
import { buildBackup, countRecords, countsOf, exportCsv, parseBackup, restoreBackup } from '../db/export'
import { formatDateJa } from '../lib/format'
import { saveOrShareFile, type SaveOutcome } from '../lib/share'
import { fileStamp } from '../lib/time'

const OUTCOME_TEXT: Record<SaveOutcome, string> = {
  shared: '共有シートに渡しました。「ファイルに保存」などを選んでください',
  downloaded: 'ダウンロードしました',
  cancelled: 'キャンセルしました',
}

function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('ファイルを読めませんでした'))
    reader.readAsText(file)
  })
}

/** データの書き出し（CSV・JSON）と復元、保存状態の表示 */
export default function DataPage() {
  const counts = useLiveQuery(() => countRecords(), [])
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [persisted, setPersisted] = useState<boolean | null>(null)

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted, () => setPersisted(null))
  }, [])

  async function run(job: () => Promise<string>) {
    setBusy(true)
    setError(null)
    setStatus(null)
    try {
      setStatus(await job())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const handleCsv = () =>
    run(async () => {
      const csv = await exportCsv()
      return OUTCOME_TEXT[await saveOrShareFile(csv, `workout-log_${fileStamp()}.csv`, 'text/csv;charset=utf-8')]
    })

  const handleBackup = () =>
    run(async () => {
      const backup = await buildBackup(__BUILD_ID__)
      const json = JSON.stringify(backup, null, 2)
      return OUTCOME_TEXT[await saveOrShareFile(json, `workout-log_backup_${fileStamp()}.json`, 'application/json')]
    })

  function handleRestoreFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    void run(async () => {
      const backup = parseBackup(await readFileText(file))
      const c = countsOf(backup)
      const ok = window.confirm(
        `${formatDateJa(backup.exportedAt.slice(0, 10))} に書き出したバックアップから復元しますか？\n` +
          `復元後: トレーニング ${c.workouts} 件・セット ${c.workoutSets} 件・種目 ${c.exercises} 件\n` +
          '現在のデータはすべて置き換わります。',
      )
      if (!ok) return 'キャンセルしました'
      const result = await restoreBackup(backup)
      return `復元しました（トレーニング ${result.workouts} 件・セット ${result.workoutSets} 件・種目 ${result.exercises} 件）`
    })
  }

  return (
    <AppShell title="データ" nav>
      <div className="flex flex-col gap-4">
        <section className={`${card} flex flex-col gap-3`}>
          <h2 className={label}>書き出し</h2>
          <p className="text-sm text-slate-300">
            CSV は分析用（1 行 = 1 セット、Excel / Google Sheets / pandas で開けます）。JSON は復元用のバックアップです。
          </p>
          <button type="button" onClick={handleCsv} disabled={busy} className={`${btnPrimary} w-full`}>
            CSV を書き出す
          </button>
          <button type="button" onClick={handleBackup} disabled={busy} className={`${btnSecondary} w-full`}>
            JSON バックアップを書き出す
          </button>
        </section>

        <section className={`${card} flex flex-col gap-3`}>
          <h2 className={label}>復元</h2>
          <p className="text-sm text-slate-300">JSON バックアップから復元します。現在のデータはすべて置き換わります。</p>
          <label className={`${btnSecondary} w-full cursor-pointer ${busy ? 'pointer-events-none opacity-40' : ''}`}>
            JSON バックアップから復元…
            <input type="file" accept=".json,application/json" onChange={handleRestoreFile} className="hidden" aria-label="復元するバックアップファイル" />
          </label>
        </section>

        {status && (
          <p role="status" className="rounded-2xl bg-emerald-500/10 p-3 text-sm text-emerald-300">
            {status}
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-2xl bg-rose-500/10 p-3 text-sm text-rose-300">
            {error}
          </p>
        )}

        <section className={`${card} text-sm text-slate-300`}>
          <h2 className={`mb-2 ${label}`}>データの状態</h2>
          {counts && (
            <dl className="grid grid-cols-2 gap-y-1">
              <dt className="text-slate-400">トレーニング</dt>
              <dd className="text-right tabular-nums">{counts.workouts} 件</dd>
              <dt className="text-slate-400">セット</dt>
              <dd className="text-right tabular-nums">{counts.workoutSets} 件</dd>
              <dt className="text-slate-400">種目</dt>
              <dd className="text-right tabular-nums">{counts.exercises} 件</dd>
              <dt className="text-slate-400">保存領域の永続化</dt>
              <dd className="text-right">{persisted === null ? '不明' : persisted ? '有効' : '未設定'}</dd>
              <dt className="text-slate-400">アプリの版</dt>
              <dd className="text-right">{__BUILD_ID__}</dd>
            </dl>
          )}
          <p className="mt-3 text-xs text-slate-500">
            データはこの iPhone の中にだけあります。アプリの削除や Safari のデータ消去で消えるため、定期的に JSON バックアップを取ってください。
          </p>
        </section>
      </div>
    </AppShell>
  )
}
