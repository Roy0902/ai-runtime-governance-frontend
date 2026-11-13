import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { Box, Spinner, Stack, Text } from '@chakra-ui/react';
import { Route, Routes } from 'react-router-dom';
import { AuthenticationProvider, useAuthentication } from './AuthenticationContext';
import { RequireHuman } from './components/layout/RequireHuman';
import { PageLoading } from './components/ui/PageLoading';
import { ActivityEmptyState, ActivityLayout } from './features/activity-timeline/ActivityLayout';
import { t } from './i18n';

const ActivityTracePage = lazy(() => import('./features/activity-timeline/ActivityTracePage')
  .then((module) => ({ default: module.ActivityTracePage })));
const AuthenticationRoutes = lazy(() => import('./features/authentication/AuthenticationRoutes')
  .then((module) => ({ default: module.AuthenticationRoutes })));

function InitializingGate({ children }: { children: ReactNode }) {
  const { loading } = useAuthentication();
  const [initializing, setInitializing] = useState(loading);
  const firstLoad = useRef(true);

  useEffect(() => {
    if (!firstLoad.current || loading) {
      return;
    }
    firstLoad.current = false;
    setInitializing(false);
  }, [loading]);

  return (
    <>
      <div style={{ display: 'contents' }} inert={initializing ? true : undefined}>
        {children}
      </div>
      {initializing ? (
        <Box
          position="fixed"
          inset="0"
          zIndex={9999}
          display="flex"
          alignItems="center"
          justifyContent="center"
          bg="blackAlpha.600"
          backdropFilter="blur(2px)"
          cursor="progress"
          role="status"
          aria-busy="true"
          aria-label={t('loading.page')}
        >
          <Stack align="center" gap="3">
            <Spinner colorPalette="green" size="lg" />
            <Text color="white" fontSize="sm">{t('loading.page')}</Text>
          </Stack>
        </Box>
      ) : null}
    </>
  );
}

function AuthenticatedRoutes() {
  return (
    <AuthenticationProvider>
      <InitializingGate>
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
      </InitializingGate>
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
