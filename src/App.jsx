import { BrowserRouter, Route, Routes } from 'react-router-dom'
import AppShell from './lib/AppShell.jsx'
import RequireCreator from './features/auth/RequireCreator.jsx'
import SignInPage from './features/auth/SignInPage.jsx'
import DashboardPage from './features/dashboard/DashboardPage.jsx'
import BuilderPage from './features/builder/BuilderPage.jsx'
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
          <Route element={<AppShell />}>
            <Route path="/forms/:formId/edit" element={<BuilderPage />} />
            <Route path="/forms/:formId/responses" element={<ResponsesPage />} />
          </Route>
        </Route>
        <Route path="/signin" element={<SignInPage />} />
        {/* Public link respondents open — kept short for sharing. */}
        <Route path="/f/:formId" element={<RespondPage />} />
      </Routes>
    </BrowserRouter>
  )
}
