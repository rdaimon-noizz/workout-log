import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import AddExercisePage from './pages/AddExercisePage'
import DataPage from './pages/DataPage'
import ExerciseHistoryIndexPage from './pages/ExerciseHistoryIndexPage'
import ExercisesPage from './pages/ExercisesPage'
import HistoryPage from './pages/HistoryPage'
import HomePage from './pages/HomePage'
import NewWorkoutPage from './pages/NewWorkoutPage'
import SessionPage from './pages/SessionPage'
import WorkoutPage from './pages/WorkoutPage'

// グラフ（Recharts）は重いので、種目別履歴の画面だけ別チャンクにして必要なときに読む（Service Worker が事前キャッシュするのでオフラインでも開く）
const ExerciseHistoryPage = lazy(() => import('./pages/ExerciseHistoryPage'))
const WeeklyPage = lazy(() => import('./pages/WeeklyPage'))
const MusclesPage = lazy(() => import('./pages/MusclesPage'))
const loading = <p className="p-6 text-center text-slate-500">読み込み中…</p>

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/workouts/new" element={<NewWorkoutPage />} />
      <Route path="/workouts/:workoutId" element={<WorkoutPage />} />
      <Route path="/workouts/:workoutId/exercises" element={<AddExercisePage />} />
      <Route path="/workouts/:workoutId/sessions/:sessionId" element={<SessionPage />} />
      <Route path="/history" element={<HistoryPage />} />
      <Route path="/history/exercises" element={<ExerciseHistoryIndexPage />} />
      <Route
        path="/history/exercises/:exerciseId"
        element={
          <Suspense fallback={loading}>
            <ExerciseHistoryPage />
          </Suspense>
        }
      />
      <Route
        path="/history/weekly"
        element={
          <Suspense fallback={loading}>
            <WeeklyPage />
          </Suspense>
        }
      />
      <Route
        path="/history/muscles"
        element={
          <Suspense fallback={loading}>
            <MusclesPage />
          </Suspense>
        }
      />
      <Route path="/exercises" element={<ExercisesPage />} />
      <Route path="/data" element={<DataPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
