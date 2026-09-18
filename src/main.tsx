import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App'
import { ErrorBoundary, GlobalErrorBanner } from './components/ErrorBoundary'
import { ensureSeedExercises } from './db/seed'

// 保存領域の永続化を要求する（効果はブラウザ依存。最終的な担保はバックアップ機能）
if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
  void navigator.storage.persist()
}
void ensureSeedExercises()

// BASE_URL は '/' または '/workout-log/'。React Router の basename は末尾スラッシュ無しで渡す
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <GlobalErrorBanner />
      <BrowserRouter basename={basename}>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
