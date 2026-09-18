// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary, GlobalErrorBanner } from './ErrorBoundary'

function Boom(): never {
  throw new Error('描画で失敗した')
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ErrorBoundary', () => {
  it('子の描画エラーを捕まえて内容を表示する', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('heading', { name: 'エラーが発生しました' })).toBeInTheDocument()
    expect(screen.getByText(/Error: 描画で失敗した/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '再読み込み' })).toBeInTheDocument()
  })
})

describe('GlobalErrorBanner', () => {
  it('未処理の Promise 拒否をバナーに表示し、✕ で閉じられる', () => {
    render(<GlobalErrorBanner />)
    const event = new Event('unhandledrejection') as PromiseRejectionEvent
    Object.defineProperty(event, 'reason', { value: new Error('保存に失敗') })
    fireEvent(window, event)
    expect(screen.getByRole('alert')).toHaveTextContent('エラー: Error: 保存に失敗')
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
