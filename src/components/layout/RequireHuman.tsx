import { Navigate } from 'react-router-dom';
import { Button, Text } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { useAuthentication } from '../../AuthenticationContext';
import { ApplicationErrorPage } from '../ApplicationErrorPage';
import { ApplicationShell } from './ApplicationShell';

export function RequireHuman({ children }: { children: ReactNode }) {
  const { context, loading, refreshError, refresh } = useAuthentication();
  if (!context) {
    if (loading) {
      return <Text p="8" color="governance.muted" textAlign="center">Loading account context…</Text>;
    }
    return (
      <ApplicationErrorPage
        code="SESSION"
        eyebrow="Session unavailable"
        title="Unable to load your session"
        description={refreshError ?? 'Your session could not be loaded. Try again.'}
      >
        <Button type="button" variant="outline" onClick={() => { void refresh().catch(() => {}); }}>
          Retry
        </Button>
      </ApplicationErrorPage>
    );
  }
  if (context.state === 'SETUP') {
    return <Navigate to="/setup/enroll" replace />;
  }
  if (context.state !== 'HUMAN') {
    return <Navigate to="/sign-in" replace />;
  }
  return <ApplicationShell>{children}</ApplicationShell>;
}