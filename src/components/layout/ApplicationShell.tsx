import { useEffect, useRef, useState } from 'react';
import { Box, Link, Text } from '@chakra-ui/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthentication } from '../../AuthenticationContext';
import { ApiError } from '../../ApplicationApiClient';
import { ApplicationHeader } from './ApplicationHeader';

function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return 'Something went wrong. Try again.';
}

export function ActivityTimelinePreviewShell({ children }: { children: React.ReactNode }) {
  return (
    <Box minH="100vh">
      <Link position="fixed" zIndex="20" top="-16" left="4" _focus={{ top: '4' }} href="#main-content">
        Skip to main content
      </Link>
      <ApplicationHeader variant="preview" />
      <Box id="main-content" tabIndex={-1}>{children}</Box>
    </Box>
  );
}

export function ApplicationShell({ children }: { children: React.ReactNode }) {
  const { context, send, refresh, refreshError } = useAuthentication();
  const navigate = useNavigate();
  const location = useLocation();
  const lastPath = useRef(location.pathname);
  const [error, setError] = useState<string | null>(null);
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
    setError(null);
    try {
      await send('/api/v1/auth/sign-out', 'POST');
      await refresh();
      navigate('/signed-out', { replace: true });
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <Box minH="100vh">
      <Link position="fixed" zIndex="20" top="-16" left="4" _focus={{ top: '4' }} href="#main-content">
        Skip to main content
      </Link>
      <ApplicationHeader
        variant="authenticated"
        email={context?.account?.email}
        onSignOut={() => { void signOut(); }}
        pending={pending}
      />
      {error || refreshError ? (
        <Text role="alert" w="min(100% - 3rem, 1440px)" mx="auto" mt="4" p="3" borderRadius="md" bg="red.50" color="red.800">
          {error ?? refreshError}
        </Text>
      ) : null}
      <Box id="main-content" tabIndex={-1}>{children}</Box>
    </Box>
  );
}
