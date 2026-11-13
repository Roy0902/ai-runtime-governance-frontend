import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AuthenticationProvider } from './AuthenticationContext';
import { RequireHuman } from './components/layout/RequireHuman';
import { PageLoading } from './components/ui/PageLoading';
import { ActivityEmptyState, ActivityLayout } from './features/activity-timeline/ActivityLayout';
import { t } from './i18n';

const ActivityTracePage = lazy(() => import('./features/activity-timeline/ActivityTracePage')
  .then((module) => ({ default: module.ActivityTracePage })));
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
              <Suspense fallback={<PageLoading label={t('loading.activity')} />}>
                <ActivityLayout />
              </Suspense>
            </RequireHuman>
          }
        >
          <Route index element={<ActivityEmptyState />} />
          <Route
            path=":traceId"
            element={
              <Suspense fallback={<PageLoading label={t('loading.trace')} />}>
                <ActivityTracePage />
              </Suspense>
            }
          />
        </Route>
        <Route path="/*" element={
          <Suspense fallback={<PageLoading label={t('loading.account')} />}>
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
      <Route path="/*" element={<AuthenticatedRoutes />} />
    </Routes>
  );
}
