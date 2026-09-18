import { Navigate, Route, Routes } from 'react-router'
import AddExercisePage from './pages/AddExercisePage'
import ExercisesPage from './pages/ExercisesPage'
import HomePage from './pages/HomePage'
import NewWorkoutPage from './pages/NewWorkoutPage'
import SessionPage from './pages/SessionPage'
import WorkoutPage from './pages/WorkoutPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/workouts/new" element={<NewWorkoutPage />} />
      <Route path="/workouts/:workoutId" element={<WorkoutPage />} />
      <Route path="/workouts/:workoutId/exercises" element={<AddExercisePage />} />
      <Route path="/workouts/:workoutId/sessions/:sessionId" element={<SessionPage />} />
      <Route path="/exercises" element={<ExercisesPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
