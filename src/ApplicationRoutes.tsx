import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AuthenticationProvider } from './AuthenticationContext';
import { ActivityTimelinePreviewShell } from './components/layout/ApplicationShell';
import { RequireHuman } from './components/layout/RequireHuman';
import { PageLoading } from './components/ui/PageLoading';

const ActivityTimelinePage = lazy(() => import('./features/activity-timeline/ActivityTimelinePage')
  .then((module) => ({ default: module.ActivityTimelinePage })));
const ActivityTracePage = lazy(() => import('./features/activity-timeline/ActivityTracePage')
  .then((module) => ({ default: module.ActivityTracePage })));
const ActivityTracesPage = lazy(() => import('./features/activity-timeline/ActivityTracesPage')
  .then((module) => ({ default: module.ActivityTracesPage })));
const AuthenticationRoutes = lazy(() => import('./features/authentication/AuthenticationRoutes')
  .then((module) => ({ default: module.AuthenticationRoutes })));

function AuthenticatedRoutes() {
  return (
    <AuthenticationProvider>
      <Routes>
        <Route
          path="/activity"
          element={
            <RequireHuman>
              <Suspense fallback={<PageLoading label="Loading activity" />}>
                <ActivityTracesPage />
              </Suspense>
            </RequireHuman>
          }
        />
        <Route
          path="/activity/:traceId"
          element={
            <RequireHuman>
              <Suspense fallback={<PageLoading label="Loading trace" />}>
                <ActivityTracePage />
              </Suspense>
            </RequireHuman>
          }
        />
        <Route path="/*" element={
          <Suspense fallback={<PageLoading label="Loading account" />}>
            <AuthenticationRoutes />
          </Suspense>
        } />
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
              <Suspense fallback={<PageLoading label="Loading preview" />}>
                <ActivityTimelinePage />
              </Suspense>
            </ActivityTimelinePreviewShell>
          }
        />
      ) : null}
      <Route path="/*" element={<AuthenticatedRoutes />} />
    </Routes>
  );
}
