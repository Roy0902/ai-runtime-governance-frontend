import { Route, Routes } from 'react-router-dom';
import { AuthenticationProvider } from './AuthenticationContext';
import { ActivityTimelinePreviewShell } from './components/layout/ApplicationShell';
import { ActivityTimelinePage } from './features/activity-timeline/ActivityTimelinePage';
import { ActivityTracePage } from './features/activity-timeline/ActivityTracePage';
import { ActivityTracesPage } from './features/activity-timeline/ActivityTracesPage';
import { AuthenticationRoutes, RequireHuman } from './features/authentication/AuthenticationRoutes';

function AuthenticatedRoutes() {
  return (
    <AuthenticationProvider>
      <Routes>
        <Route
          path="/activity"
          element={
            <RequireHuman>
              <ActivityTracesPage />
            </RequireHuman>
          }
        />
        <Route
          path="/activity/:traceId"
          element={
            <RequireHuman>
              <ActivityTracePage />
            </RequireHuman>
          }
        />
        <Route path="/*" element={<AuthenticationRoutes />} />
      </Routes>
    </AuthenticationProvider>
  );
}

export function ApplicationRoutes() {
  return (
    <Routes>
      {import.meta.env.DEV ? (
        <Route
          path="/activity-preview"
          element={
            <ActivityTimelinePreviewShell>
              <ActivityTimelinePage />
            </ActivityTimelinePreviewShell>
          }
        />
      ) : null}
      <Route path="/*" element={<AuthenticatedRoutes />} />
    </Routes>
  );
}
