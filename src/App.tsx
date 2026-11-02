import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Navigate, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, type AuthenticatorSecrets, type AuthContext, type Operation } from './api';
import { AuthProvider, useAuth } from './auth';

const ACCEPTED = "If this request is eligible, we'll send an email with the next steps.";

function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.fieldErrors.length > 0) {
      return error.fieldErrors[0].message;
    }
    if (error.code === 'RATE_LIMITED' && error.retryAfterSeconds) {
      return `Too many attempts. Try again in ${error.retryAfterSeconds} seconds.`;
    }
    return error.message;
  }
  return 'Something went wrong. Try again.';
}

function Message({ text }: { text: string }) {
  return <p role="alert">{text}</p>;
}

function Status({ text }: { text: string }) {
  return <p role="status">{text}</p>;
}

function AccountNavigation() {
  const { send, refresh } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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
    <>
      <nav aria-label="Account navigation">
        <a href="/account">Account</a>
        <button type="button" onClick={signOut} disabled={pending}>Sign out</button>
      </nav>
      {error ? <Message text={error} /> : null}
    </>
  );
}

function RequireHuman({ children }: { children: ReactNode }) {
  const { context } = useAuth();
  if (!context) {
    return <p>Loading…</p>;
  }
  if (context.state === 'SETUP') {
    return <Navigate to="/setup/enroll" replace />;
  }
  if (context.state !== 'HUMAN') {
    return <Navigate to="/sign-in" replace />;
  }
  return <><AccountNavigation />{children}</>;
}

function RequireSetup({ children }: { children: ReactNode }) {
  const { context } = useAuth();
  if (!context) {
    return <p>Loading…</p>;
  }
  if (context.state === 'HUMAN') {
    return <Navigate to="/account" replace />;
  }
  if (context.state !== 'SETUP') {
    return <Navigate to="/sign-in" replace />;
  }
  return <>{children}</>;
}

function Home() {
  const { context } = useAuth();
  if (!context) {
    return <p>Loading…</p>;
  }
  if (context.state === 'HUMAN') {
    return <Navigate to="/account" replace />;
  }
  if (context.state === 'SETUP') {
    return <Navigate to="/setup/enroll" replace />;
  }
  return <Navigate to="/sign-in" replace />;
}

function SignInPage() {
  const { send } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [factor, setFactor] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const secondFactor = factor.trim()
        ? { kind: factor.replace(/-/g, '').length === 32 ? 'RECOVERY' : 'TOTP', code: factor }
        : undefined;
      await send<AuthContext>('/api/v1/auth/sign-in', 'POST', { email, password, secondFactor });
      navigate('/account');
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  return (
    <main>
      <h1>Sign in</h1>
      <form onSubmit={submit}>
        <label>
          Email
          <input aria-label="Email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label>
          Password
          <input aria-label="Password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        <label>
          Authenticator or recovery code
          <input aria-label="Authenticator or recovery code" value={factor} onChange={(event) => setFactor(event.target.value)} />
        </label>
        <button type="submit">Sign in</button>
      </form>
      {error ? <Message text={error} /> : null}
      <p>
        <a href="/register">Create account</a> · <a href="/forgot-password">Forgot password?</a>
      </p>
    </main>
  );
}

function RegisterPage() {
  const { send } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setStatus('');
    try {
      await send('/api/v1/auth/registrations', 'POST', { email, password });
      setStatus(ACCEPTED);
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  return (
    <main>
      <h1>Create account</h1>
      <form onSubmit={submit}>
        <label>
          Email
          <input aria-label="Email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label>
          New password
          <input aria-label="New password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        <p>Use at least 12 characters.</p>
        <button type="submit">Create account</button>
      </form>
      {status ? <Status text={status} /> : null}
      {error ? <Message text={error} /> : null}
      <p>
        <a href="/sign-in">Sign in</a>
      </p>
    </main>
  );
}

function VerifyPage() {
  const { send } = useAuth();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);

  async function verify() {
    setError(null);
    try {
      await send<AuthContext>('/api/v1/auth/email-verifications/consume', 'POST', { token });
      setVerified(true);
      setStatus('Email verified. Continue to set up your authenticator.');
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  async function resend() {
    setError(null);
    try {
      await send('/api/v1/auth/email-verifications/resend', 'POST', { email });
      setStatus(ACCEPTED);
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  return (
    <main>
      <h1>Verify email</h1>
      {token ? (
        <>
          <p>Confirm this email address to continue.</p>
          <button type="button" onClick={verify}>
            Verify email
          </button>
        </>
      ) : (
        <p>Request a new verification email.</p>
      )}
      <label>
        Email
        <input aria-label="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>
      <button type="button" onClick={resend}>
        Send a new verification email
      </button>
      {status ? <Status text={status} /> : null}
      {verified ? <a href="/setup/enroll">Continue to setup</a> : null}
      {error ? <Message text={error} /> : null}
    </main>
  );
}

function ForgotPasswordPage() {
  const { send } = useAuth();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await send('/api/v1/auth/password-resets', 'POST', { email });
      setStatus(ACCEPTED);
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  return (
    <main>
      <h1>Reset password</h1>
      <form onSubmit={submit}>
        <label>
          Email
          <input aria-label="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <button type="submit">Send reset email</button>
      </form>
      {status ? <Status text={status} /> : null}
      {error ? <Message text={error} /> : null}
    </main>
  );
}

function ResetPasswordPage() {
  const { send } = useAuth();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await send('/api/v1/auth/password-resets/consume', 'POST', { token, newPassword: password });
      setStatus('Password changed. Sign in with your new password.');
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  return (
    <main>
      <h1>Choose a new password</h1>
      <form onSubmit={submit}>
        <label>
          New password
          <input aria-label="New password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        <button type="submit">Change password</button>
      </form>
      {status ? <Status text={status} /> : null}
      {error ? <Message text={error} /> : null}
    </main>
  );
}

function useEnrollmentSecrets(
  read: () => Promise<Operation>,
  start: () => Promise<AuthenticatorSecrets>,
  complete: (operationId: string, code: string, saved: boolean) => Promise<void>,
) {
  const [secrets, setSecrets] = useState<AuthenticatorSecrets | null>(null);
  const [operationId, setOperationId] = useState<string | null>(null);
  const [alreadyIssued, setAlreadyIssued] = useState(false);
  const [code, setCode] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) {
      return;
    }
    started.current = true;
    async function initialize() {
      try {
        await read();
        setAlreadyIssued(true);
      } catch (caught) {
        if (caught instanceof ApiError && caught.code === 'NOT_FOUND') {
          try {
            const value = await start();
            setSecrets(value);
            setOperationId(value.operation.operationId);
          } catch (startError) {
            setError(errorText(startError));
          }
        } else {
          setError(errorText(caught));
        }
      }
    }
    void initialize();
  }, [read, start]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!operationId) {
      return;
    }
    try {
      await complete(operationId, code, saved);
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  return { secrets, setSecrets, setOperationId, alreadyIssued, code, setCode, saved, setSaved, error, submit };
}

function SecretDisplay({ secrets }: { secrets: AuthenticatorSecrets }) {
  const qr = `data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><rect width="180" height="180" fill="#fff"/><rect x="20" y="20" width="140" height="140" fill="none" stroke="#111" stroke-width="8"/></svg>',
  )}`;
  return (
    <>
      <img src={qr} alt="Authenticator QR code" width={180} height={180} />
      <p>
        <output aria-label="Manual key">{secrets.manualKey}</output>
      </p>
      <ol aria-label="Recovery codes">
        {secrets.recoveryCodes.map((value) => (
          <li key={value}>{value}</li>
        ))}
      </ol>
    </>
  );
}

function EnrollPage() {
  const { send } = useAuth();
  const navigate = useNavigate();
  const state = useEnrollmentSecrets(
    () => send<Operation>('/api/v1/auth/enrollment', 'GET'),
    () => send<AuthenticatorSecrets>('/api/v1/auth/enrollment', 'POST', { operationId: crypto.randomUUID() }),
    async (operationId, code, saved) => {
      await send('/api/v1/auth/enrollment/complete', 'POST', {
        operationId,
        authenticatorCode: code,
        recoveryCodesSaved: saved,
      });
      navigate('/account');
    },
  );

  return (
    <main>
      <h1>Set up your authenticator</h1>
      <p>Scan the QR code or enter the manual key in your authenticator app, then enter the current six-digit code.</p>
      <p>This key and your recovery codes are shown once. Save them before continuing.</p>
      {state.alreadyIssued ? <Message text="These setup values were already shown. Start a new attempt." /> : null}
      {state.secrets ? <SecretDisplay secrets={state.secrets} /> : null}
      <form onSubmit={state.submit}>
        <label>
          Six-digit code
          <input aria-label="Six-digit code" value={state.code} onChange={(event) => state.setCode(event.target.value)} />
        </label>
        <label>
          <input type="checkbox" aria-label="I have saved my recovery codes" checked={state.saved} onChange={(event) => state.setSaved(event.target.checked)} />
          I have saved my recovery codes
        </label>
        <button type="submit">Complete setup</button>
      </form>
      {state.error ? <Message text={state.error} /> : null}
      <p>
        <a href="/setup/restart">Restart setup</a>
      </p>
    </main>
  );
}

function RestartPage() {
  const { send } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [secrets, setSecrets] = useState<AuthenticatorSecrets | null>(null);
  const [operationId, setOperationId] = useState('');
  const [code, setCode] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function restart(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const value = await send<AuthenticatorSecrets>('/api/v1/auth/enrollment/restart', 'POST', {
        operationId: crypto.randomUUID(),
        password,
      });
      setSecrets(value);
      setOperationId(value.operation.operationId);
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  async function complete(event: FormEvent) {
    event.preventDefault();
    try {
      await send('/api/v1/auth/enrollment/complete', 'POST', {
        operationId,
        authenticatorCode: code,
        recoveryCodesSaved: saved,
      });
      navigate('/account');
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  return (
    <main>
      <h1>Restart setup</h1>
      {!secrets ? (
        <form onSubmit={restart}>
          <label>
            Password
            <input aria-label="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <button type="submit">Restart setup</button>
        </form>
      ) : (
        <>
          <SecretDisplay secrets={secrets} />
          <form onSubmit={complete}>
            <label>
              Six-digit code
              <input aria-label="Six-digit code" value={code} onChange={(event) => setCode(event.target.value)} />
            </label>
            <label>
              <input type="checkbox" aria-label="I have saved my recovery codes" checked={saved} onChange={(event) => setSaved(event.target.checked)} />
              I have saved my recovery codes
            </label>
            <button type="submit">Complete setup</button>
          </form>
        </>
      )}
      {error ? <Message text={error} /> : null}
    </main>
  );
}

function StepUpDialog({ open, onConfirmed, onCancel }: { open: boolean; onConfirmed: () => void; onCancel: () => void }) {
  const { send } = useAuth();
  const [password, setPassword] = useState('');
  const [factor, setFactor] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return null;
  }

  async function confirm() {
    setError(null);
    try {
      await send('/api/v1/auth/reauthentication', 'POST', {
        password,
        secondFactor: { kind: factor.replace(/-/g, '').length === 32 ? 'RECOVERY' : 'TOTP', code: factor },
      });
      onConfirmed();
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  return (
    <dialog open aria-label="Confirm your identity">
      <h1>Confirm your identity</h1>
      <p>Enter your password and current authenticator code to continue.</p>
      <label>
        Password
        <input aria-label="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
      </label>
      <label>
        Authenticator or recovery code
        <input aria-label="Authenticator or recovery code" value={factor} onChange={(event) => setFactor(event.target.value)} />
      </label>
      <button type="button" onClick={confirm}>Confirm</button>
      <button type="button" onClick={onCancel}>Cancel</button>
      {error ? <Message text={error} /> : null}
    </dialog>
  );
}

function AccountPage() {
  const { context } = useAuth();
  const account = context?.account;

  return (
    <main>
      <h1>Account</h1>
      <dl>
        <dt aria-label="Email">Email</dt>
        <dd>{account?.email}</dd>
        <dt aria-label="Email verified">Email verified</dt>
        <dd>Verified</dd>
        <dt aria-label="Two-factor authentication">Two-factor authentication</dt>
        <dd>On</dd>
        <dt aria-label="Gateway access">Gateway access</dt>
        <dd>{account?.gatewayEntitlement === 'GRANTED' ? 'Granted' : account?.gatewayEntitlement === 'REVOKED' ? 'Revoked' : 'Not granted'}</dd>
        <dt aria-label="Session expires">Session expires</dt>
        <dd>{account?.session.absoluteExpiresAt ?? 'Unknown'}</dd>
      </dl>
      <p>
        <a href="/account/password">Change password</a> · <a href="/account/authenticator">Replace authenticator</a> ·{' '}
        <a href="/account/recovery-codes">Generate new recovery codes</a>
      </p>
    </main>
  );
}

function PasswordPage() {
  const { send } = useAuth();
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [stepUp, setStepUp] = useState(false);

  async function change() {
    setError(null);
    try {
      await send('/api/v1/account/password', 'POST', { newPassword: password });
      setStatus('Password changed. Other sessions were signed out.');
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'RECENT_AUTH_REQUIRED') {
        setStepUp(true);
      } else {
        setError(errorText(caught));
      }
    }
  }

  return (
    <main>
      <h1>Change password</h1>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void change();
        }}
      >
        <label>
          New password
          <input aria-label="New password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        <button type="submit">Change password</button>
      </form>
      {status ? <Status text={status} /> : null}
      {error ? <Message text={error} /> : null}
      <StepUpDialog
        open={stepUp}
        onCancel={() => setStepUp(false)}
        onConfirmed={() => {
          setStepUp(false);
          void change();
        }}
      />
    </main>
  );
}

function AuthenticatorPage() {
  const { send } = useAuth();
  const navigate = useNavigate();
  const [secrets, setSecrets] = useState<AuthenticatorSecrets | null>(null);
  const [operationId, setOperationId] = useState('');
  const [code, setCode] = useState('');
  const [saved, setSaved] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [stepUp, setStepUp] = useState<null | 'start' | 'complete'>(null);

  async function start() {
    setError(null);
    try {
      const value = await send<AuthenticatorSecrets>('/api/v1/account/authenticator-replacements', 'POST', {
        operationId: crypto.randomUUID(),
      });
      setSecrets(value);
      setOperationId(value.operation.operationId);
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'RECENT_AUTH_REQUIRED') {
        setStepUp('start');
      } else {
        setError(errorText(caught));
      }
    }
  }

  async function complete(event: FormEvent) {
    event.preventDefault();
    try {
      await send(`/api/v1/account/authenticator-replacements/${operationId}/complete`, 'POST', {
        authenticatorCode: code,
        recoveryCodesSaved: saved,
      });
      navigate('/account');
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'RECENT_AUTH_REQUIRED') {
        setStepUp('complete');
      } else {
        setError(errorText(caught));
      }
    }
  }

  async function cancel() {
    await send(`/api/v1/account/security/operations/${operationId}`, 'DELETE');
    setStatus('Pending replacement cancelled. Your current authenticator still works.');
    setSecrets(null);
  }

  return (
    <main>
      <h1>Replace authenticator</h1>
      {!secrets ? <button type="button" onClick={start}>Start replacement</button> : null}
      {secrets ? (
        <>
          <SecretDisplay secrets={secrets} />
          <p>Your current authenticator keeps working until you finish this replacement.</p>
          <form onSubmit={complete}>
            <label>
              Six-digit code
              <input aria-label="Six-digit code" value={code} onChange={(event) => setCode(event.target.value)} />
            </label>
            <label>
              <input type="checkbox" aria-label="I have saved my recovery codes" checked={saved} onChange={(event) => setSaved(event.target.checked)} />
              I have saved my recovery codes
            </label>
            <button type="submit">Complete replacement</button>
          </form>
          <button type="button" onClick={cancel}>Cancel replacement</button>
        </>
      ) : null}
      {status ? <Status text={status} /> : null}
      {error ? <Message text={error} /> : null}
      <StepUpDialog
        open={stepUp !== null}
        onCancel={() => setStepUp(null)}
        onConfirmed={() => {
          const action = stepUp;
          setStepUp(null);
          if (action === 'start') {
            void start();
          }
        }}
      />
    </main>
  );
}

function RecoveryGenerationPage() {
  const { context, send } = useAuth();
  const operationStorageKey = context?.account
    ? `arg-recovery-operation:${context.account.accountId}`
    : null;
  const [codes, setCodes] = useState<string[] | null>(null);
  const [operationId, setOperationId] = useState('');
  const [saved, setSaved] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [stepUp, setStepUp] = useState(false);

  useEffect(() => {
    if (!operationStorageKey) {
      return;
    }
    const storedId = sessionStorage.getItem(operationStorageKey);
    if (!storedId) {
      return;
    }
    let active = true;
    void send<Operation>(`/api/v1/account/security/operations/${storedId}`, 'GET')
      .then((operation) => {
        if (!active) {
          return;
        }
        setOperationId(operation.operationId);
        if (operation.state === 'COMPLETED') {
          setStatus('New recovery codes are active. Other sessions were signed out.');
        } else if (operation.state === 'PENDING') {
          setError('These setup values were already shown. Start a new attempt.');
        } else {
          sessionStorage.removeItem(operationStorageKey);
        }
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(errorText(caught));
        }
      });
    return () => { active = false; };
  }, [operationStorageKey, send]);

  async function start() {
    setError(null);
    setStatus('');
    setSaved(false);
    const nextId = crypto.randomUUID();
    try {
      if (operationStorageKey) {
        sessionStorage.setItem(operationStorageKey, nextId);
      }
      const value = await send<{ operation: Operation; recoveryCodes: string[] }>(
        '/api/v1/account/recovery-code-generations',
        'POST',
        { operationId: nextId },
      );
      setCodes(value.recoveryCodes);
      setOperationId(value.operation.operationId);
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'RECENT_AUTH_REQUIRED') {
        setStepUp(true);
      } else {
        setError(errorText(caught));
      }
    }
  }

  async function complete() {
    setError(null);
    try {
      await send(`/api/v1/account/recovery-code-generations/${operationId}/complete`, 'POST', {
        recoveryCodesSaved: saved,
      });
      setStatus('New recovery codes are active. Other sessions were signed out.');
      setCodes(null);
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  async function cancel() {
    setError(null);
    try {
      await send(`/api/v1/account/security/operations/${operationId}`, 'DELETE');
      if (operationStorageKey) {
        sessionStorage.removeItem(operationStorageKey);
      }
      setStatus('Pending codes cancelled. Your previous codes still work.');
      setCodes(null);
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  return (
    <main>
      <h1>Generate new recovery codes</h1>
      {!codes ? <button type="button" onClick={start}>Generate new recovery codes</button> : null}
      {codes ? (
        <>
          <p>Generating new codes revokes the previous set after you confirm you saved the new one.</p>
          <ol aria-label="Recovery codes">
            {codes.map((value) => (
              <li key={value}>{value}</li>
            ))}
          </ol>
          <label>
            <input type="checkbox" aria-label="I have saved my recovery codes" checked={saved} onChange={(event) => setSaved(event.target.checked)} />
            I have saved my recovery codes
          </label>
          <button type="button" onClick={complete}>Continue</button>
          <button type="button" onClick={cancel}>Cancel</button>
        </>
      ) : null}
      {status ? <Status text={status} /> : null}
      {error ? <Message text={error} /> : null}
      <StepUpDialog
        open={stepUp}
        onCancel={() => setStepUp(false)}
        onConfirmed={() => {
          setStepUp(false);
          void start();
        }}
      />
    </main>
  );
}

function SignedOutPage() {
  return (
    <main>
      <h1>Signed out</h1>
      <p>Your session has ended.</p>
      <a href="/sign-in">Sign in</a>
    </main>
  );
}

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify" element={<VerifyPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/setup" element={<Navigate to="/setup/enroll" replace />} />
        <Route
          path="/setup/enroll"
          element={
            <RequireSetup>
              <EnrollPage />
            </RequireSetup>
          }
        />
        <Route
          path="/setup/restart"
          element={
            <RequireSetup>
              <RestartPage />
            </RequireSetup>
          }
        />
        <Route
          path="/setup/recovery-codes"
          element={
            <RequireSetup>
              <EnrollPage />
            </RequireSetup>
          }
        />
        <Route
          path="/account"
          element={
            <RequireHuman>
              <AccountPage />
            </RequireHuman>
          }
        />
        <Route
          path="/account/password"
          element={
            <RequireHuman>
              <PasswordPage />
            </RequireHuman>
          }
        />
        <Route
          path="/account/authenticator"
          element={
            <RequireHuman>
              <AuthenticatorPage />
            </RequireHuman>
          }
        />
        <Route
          path="/account/recovery-codes"
          element={
            <RequireHuman>
              <RecoveryGenerationPage />
            </RequireHuman>
          }
        />
        <Route path="/signed-out" element={<SignedOutPage />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </AuthProvider>
  );
}
