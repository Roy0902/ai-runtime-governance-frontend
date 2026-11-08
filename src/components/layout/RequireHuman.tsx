import { Navigate } from 'react-router-dom';
import { Button, Text } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { useAuthentication } from '../../AuthenticationContext';
import { t } from '../../i18n';
import { ApplicationErrorPage } from '../ApplicationErrorPage';
import { ApplicationShell } from './ApplicationShell';

export function RequireHuman({ children }: { children: ReactNode }) {
  const { context, loading, refreshError, refresh } = useAuthentication();
  if (!context) {
    if (loading) {
      return <Text p="8" color="governance.muted" textAlign="center">{t('loading.accountContextLower')}</Text>;
    }
    return (
      <ApplicationErrorPage
        code="SESSION"
        eyebrow={t('errors.sessionUnavailableEyebrow')}
        title={t('errors.sessionUnavailableTitle')}
        description={refreshError ?? t('errors.sessionUnavailableDescription')}
      >
        <Button type="button" variant="outline" onClick={() => { void refresh().catch(() => {}); }}>
          {t('errors.retry')}
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