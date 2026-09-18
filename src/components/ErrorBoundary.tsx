import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react'
import { btnPrimary, btnSecondary } from './ui'

interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
}

/** 描画中の例外を捕まえ、何も表示しない画面ではなくエラー内容を出す（iPhone での切り分け用） */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return <ErrorScreen error={this.state.error} onReset={() => this.setState({ error: null })} />
  }
}

function ErrorScreen({ error, onReset }: { error: Error; onReset: () => void }) {
  const text = `${error.name}: ${error.message}\n${error.stack ?? ''}`
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 py-8">
      <h1 className="text-xl font-bold text-rose-300">エラーが発生しました</h1>
      <p className="text-sm text-slate-300">画面の描画中に問題が起きました。下の内容を開発側に伝えてください。</p>
      <pre className="overflow-x-auto rounded-2xl bg-slate-900 p-3 text-xs break-all whitespace-pre-wrap text-slate-300">
        {text}
      </pre>
      <button type="button" className={`${btnPrimary} w-full`} onClick={() => window.location.reload()}>
        再読み込み
      </button>
      <button type="button" className={`${btnSecondary} w-full`} onClick={onReset}>
        閉じる
      </button>
    </main>
  )
}

/** 非同期処理で捕まえられなかったエラーを画面上部に表示する */
export function GlobalErrorBanner() {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const onError = (e: ErrorEvent) => setMessage(e.message || String(e.error))
    const onRejection = (e: PromiseRejectionEvent) => {
      const r: unknown = e.reason
      setMessage(r instanceof Error ? `${r.name}: ${r.message}` : String(r))
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  if (!message) return null
  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-0 z-40 mx-auto flex max-w-md items-start gap-2 bg-rose-600 px-4 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-2 text-sm text-white"
    >
      <span className="min-w-0 flex-1 break-all">エラー: {message}</span>
      <button type="button" aria-label="閉じる" onClick={() => setMessage(null)} className="shrink-0 px-2 text-lg leading-none">
        ✕
      </button>
    </div>
  )
}
