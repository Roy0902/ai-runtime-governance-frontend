import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuthentication } from '../../AuthenticationContext';
import { ApiError } from '../../ApplicationApiClient';

function AppHeader({
  previewMode = false,
  email,
  onSignOut,
  pending = false,
}: {
  previewMode?: boolean;
  email?: string;
  onSignOut?: () => void;
  pending?: boolean;
}) {
  return (
    <header className="app-header">
      <div className="app-header-inner">
        <Link className="app-brand" to={previewMode ? '/activity-preview' : '/activity'}>
          <span className="app-brand-mark" aria-hidden="true">AR</span>
          <span>
            <strong>AI Runtime Governance</strong>
            <small>Runtime activity</small>
          </span>
        </Link>
        {previewMode ? (
          <nav className="app-nav app-preview-nav" aria-label="Preview navigation">
            <Link to="/sign-in">Sign in</Link>
          </nav>
        ) : (
          <>
            <nav className="app-nav" aria-label="Main navigation">
              <NavLink to="/activity">Activity</NavLink>
              <NavLink to="/account">Account</NavLink>
            </nav>
            <div className="app-user">
              <span title={email ?? ''}>{email}</span>
              <button type="button" onClick={onSignOut} disabled={pending}>
                {pending ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}

function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return 'Something went wrong. Try again.';
}

export function ActivityTimelinePreviewShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <AppHeader previewMode />
      <div id="main-content" tabIndex={-1}>{children}</div>
    </div>
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
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <AppHeader
        email={context?.account?.email}
        onSignOut={() => { void signOut(); }}
        pending={pending}
      />
      {error || refreshError ? (
        <p className="shell-error" role="alert">{error ?? refreshError}</p>
      ) : null}
      <div id="main-content" tabIndex={-1}>{children}</div>
    </div>
  );
}
