import { useEffect, useRef, useState } from 'react';
import { Box, Link, Text } from '@chakra-ui/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthentication } from '../../AuthenticationContext';
import { t } from '../../i18n';
import { ApplicationHeader } from './ApplicationHeader';

export function ApplicationShell({ children }: { children: React.ReactNode }) {
  const { context, send, refresh, refreshError } = useAuthentication();
  const navigate = useNavigate();
  const location = useLocation();
  const lastPath = useRef(location.pathname);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (lastPath.current === location.pathname) {
      return;
    }
    lastPath.current = location.pathname;
    refresh().catch(() => {
      // The shell displays the provider's refresh error.
    });
  }, [location.pathname, refresh]);

  async function signOut() {
    setPending(true);
    if (context?.provider === 'keycloak') {
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = '/api/v1/keycloak/logout';
      const token = document.createElement('input');
      token.type = 'hidden';
      token.name = '_csrf';
      token.value = context?.csrfToken ?? '';
      form.appendChild(token);
      document.body.appendChild(form);
      form.submit();
      return;
    }
    try {
      await send('/api/v1/auth/sign-out', 'POST');
    } catch {
      // The local session is cleared client-side even if the request fails.
    }
    await refresh().catch(() => {});
    navigate('/signed-out', { replace: true });
    setPending(false);
  }

  return (
    <Box minH="100vh">
      <Link position="fixed" zIndex="20" top="-16" left="4" _focus={{ top: '4' }} href="#main-content">
        {t('common.skipToMainContent')}
      </Link>
      <ApplicationHeader
        variant="authenticated"
        email={context?.account?.email}
        onSignOut={() => { void signOut(); }}
        pending={pending}
      />
      {refreshError ? (
        <Text role="alert" w="min(100% - 3rem, 1440px)" mx="auto" mt="4" p="3" borderRadius="md" bg="red.50" color="red.800">
          {refreshError}
        </Text>
      ) : null}
      <Box id="main-content" tabIndex={-1}>{children}</Box>
    </Box>
  );
}
