import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './lib/AppShell.jsx'
import RequireCreator from './features/auth/RequireCreator.jsx'

// Each screen is its own chunk, so someone opening a form link downloads the
// respond page, not the dashboard and builder (dnd-kit and all).
const SignInPage = lazy(() => import('./features/auth/SignInPage.jsx'))
const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage.jsx'))
const FormLayout = lazy(() => import('./features/builder/FormLayout.jsx'))
const BuilderPage = lazy(() => import('./features/builder/BuilderPage.jsx'))
const SettingsPage = lazy(() => import('./features/builder/SettingsPage.jsx'))
const ResponsesPage = lazy(() => import('./features/responses/ResponsesPage.jsx'))
const RespondPage = lazy(() => import('./features/respond/RespondPage.jsx'))
const ResultPage = lazy(() => import('./features/respond/ResultPage.jsx'))

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={null}>
        <Routes>
          {/* Creator screens: signed-in (non-anonymous) only. */}
          <Route element={<RequireCreator />}>
            <Route element={<AppShell sidebar={false} search />}>
              <Route path="/" element={<DashboardPage />} />
            </Route>
            {/* One editing session per form; the tabs share it. */}
            <Route path="/forms/:formId" element={<FormLayout />}>
              <Route index element={<Navigate to="edit" replace />} />
              <Route path="edit" element={<BuilderPage />} />
              <Route path="responses" element={<ResponsesPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Route>
          <Route path="/signin" element={<SignInPage />} />
          {/* Public link respondents open — kept short for sharing. */}
          <Route path="/f/:formId" element={<RespondPage />} />
          {/* A respondent's released quiz score. */}
          <Route path="/f/:formId/r/:responseId" element={<ResultPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
