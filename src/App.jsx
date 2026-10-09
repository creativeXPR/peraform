import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './lib/AppShell.jsx'
import RequireCreator from './features/auth/RequireCreator.jsx'
import SignInPage from './features/auth/SignInPage.jsx'
import DashboardPage from './features/dashboard/DashboardPage.jsx'
import BuilderPage from './features/builder/BuilderPage.jsx'
import FormLayout from './features/builder/FormLayout.jsx'
import SettingsPage from './features/builder/SettingsPage.jsx'
import ResponsesPage from './features/responses/ResponsesPage.jsx'
import RespondPage from './features/respond/RespondPage.jsx'

export default function App() {
  return (
    <BrowserRouter>
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
      </Routes>
    </BrowserRouter>
  )
}
