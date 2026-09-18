import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'

// vitest の globals を無効にしているため Testing Library の自動 cleanup が登録されない。
// 画面テスト（jsdom）のときだけ、各テスト後に描画を片付ける。
if (typeof document !== 'undefined') {
  const { cleanup } = await import('@testing-library/react')
  afterEach(() => cleanup())
}
