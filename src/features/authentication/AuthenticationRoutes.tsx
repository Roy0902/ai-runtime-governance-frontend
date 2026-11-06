import { lazy, Suspense, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Box, Button, Checkbox, Code, Container, Field, Grid, Heading, HStack, Image, Input, Link as ChakraLink, Stack, Text } from '@chakra-ui/react';
import { ApiError } from '../../ApplicationApiClient';
import type { AuthenticatorSecrets } from '../../api/AuthenticatorSecrets';
import type { AuthenticationContext } from '../../api/AuthenticationContext';
import type { Operation } from '../../api/Operation';
import { useAuthentication } from '../../AuthenticationContext';
import { ApplicationErrorPage } from '../../components/ApplicationErrorPage';
import { ApplicationHeader } from '../../components/layout/ApplicationHeader';
import { RequireHuman } from '../../components/layout/RequireHuman';
import { PageLoading } from '../../components/ui/PageLoading';
import { SettingsLayout, SettingsPanel } from '../account/SettingsLayout';
import { StepUpDialog } from './StepUpDialog';

const GatewayKeysPage = lazy(() => import('../gateway/GatewayKeysPage')
  .then((module) => ({ default: module.GatewayKeysPage })));

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
  return (
    <Text role="alert" mt="4" p="3" borderRadius="md" bg="red.50" color="red.800" fontSize="sm">
      {text}
    </Text>
  );
}

function Status({ text }: { text: string }) {
  return (
    <Text role="status" mt="4" p="3" borderRadius="md" bg="green.50" color="green.900" fontSize="sm">
      {text}
    </Text>
  );
}

function AuthenticationContextLoading() {
  const { loading, refreshError, refresh } = useAuthentication();
  if (loading) {
    return <PageLoading label="Loading account context" />;
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

function AuthPage({ children }: { children: ReactNode }) {
  return (
    <Container as="main" maxW="xl" flex="1" px="4" py={{ base: '8', md: '14' }}>
      <Box p={{ base: '5', md: '8' }} borderWidth="1px" borderColor="governance.line" borderRadius="xl" bg="white" boxShadow="0 18px 52px rgba(23,43,52,0.08)">
        <Stack gap="4">{children}</Stack>
      </Box>
    </Container>
  );
}

function AuthField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Field.Root>
      <Field.Label>{label}</Field.Label>
      {children}
    </Field.Root>
  );
}

function SavedCodesCheckbox({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <Checkbox.Root checked={checked} colorPalette="green" onCheckedChange={({ checked: next }) => onChange(next === true)}>
      <Checkbox.HiddenInput aria-label="I have saved my recovery codes" />
      <Checkbox.Control />
      <Checkbox.Label>I have saved my recovery codes</Checkbox.Label>
    </Checkbox.Root>
  );
}

function RequireSetup({ children }: { children: ReactNode }) {
  const { context } = useAuthentication();
  if (!context) {
    return <AuthenticationContextLoading />;
  }
  if (context.state === 'HUMAN') {
    return <Navigate to="/activity" replace />;
  }
  if (context.state !== 'SETUP') {
    return <Navigate to="/sign-in" replace />;
  }
  return <>{children}</>;
}

function AccountSettings({ children }: { children: ReactNode }) {
  return (
    <RequireHuman>
      <SettingsLayout>{children}</SettingsLayout>
    </RequireHuman>
  );
}

function Home() {
  const { context } = useAuthentication();
  if (!context) {
    return <AuthenticationContextLoading />;
  }
  if (context.state === 'HUMAN') {
    return <Navigate to="/activity" replace />;
  }
  if (context.state === 'SETUP') {
    return <Navigate to="/setup/enroll" replace />;
  }
  return <Navigate to="/sign-in" replace />;
}

function NotFoundPage() {
  return (
    <ApplicationErrorPage
      code="404"
      eyebrow="Page not found"
      title="We couldn’t find that page"
      description="The address may be outdated, or the page may have moved."
    >
      <Button asChild variant="outline">
        <Link to="/">Return to the start</Link>
      </Button>
    </ApplicationErrorPage>
  );
}

function SignInPage() {
  const { send } = useAuthentication();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const verified = params.get('verified') === '1';
  const [step, setStep] = useState<'credentials' | 'mfa'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [factor, setFactor] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (step === 'mfa' && !factor.trim()) {
      setError('Enter your authenticator or recovery code.');
      return;
    }
    try {
      const secondFactor = step === 'mfa'
        ? { kind: factor.replace(/-/g, '').length === 32 ? 'RECOVERY' : 'TOTP', code: factor }
        : undefined;
      const next = await send<AuthenticationContext>('/api/v1/auth/sign-in', 'POST', { email, password, secondFactor });
      if (next.state === 'MFA_REQUIRED') {
        setStep('mfa');
        setFactor('');
        return;
      }
      navigate(next.state === 'SETUP' ? '/setup/enroll' : '/activity', { replace: true });
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  function useAnotherAccount() {
    setStep('credentials');
    setFactor('');
    setError(null);
  }

  return (
    <Container as="main" maxW="md" flex="1" py={{ base: '10', md: '20' }} px="4">
      <Box p={{ base: '6', md: '9' }} borderWidth="1px" borderColor="governance.line" borderRadius="xl" bg="white" boxShadow="0 18px 52px rgba(23,43,52,0.08)">
        <Stack gap="6">
          <Box>
            <Text mb="2" color="governance.primary" fontSize="xs" fontWeight="bold" textTransform="uppercase">
              Account access
            </Text>
            <Heading fontSize="3xl">{step === 'mfa' ? 'Enter your code' : 'Sign in'}</Heading>
            {step === 'mfa' ? (
              <Text mt="2" color="governance.muted">
                Password accepted for <strong>{email}</strong>. Enter the code from your authenticator app, or one of your recovery codes.
              </Text>
            ) : (
              <Text mt="2" color="governance.muted">Continue to your governance workspace.</Text>
            )}
            {verified && step === 'credentials' ? (
              <Status text="Email verified. Sign in with your password to set up your authenticator next." />
            ) : null}
          </Box>
          <Box as="form" display="grid" gap="4" onSubmit={submit}>
            {step === 'credentials' ? (
              <>
                <Field.Root>
                  <Field.Label>Email</Field.Label>
                  <Input aria-label="Email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} />
                </Field.Root>
                <Field.Root>
                  <Field.Label>Password</Field.Label>
                  <Input aria-label="Password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
                </Field.Root>
              </>
            ) : (
              <Field.Root>
                <Field.Label>Authenticator or recovery code</Field.Label>
                <Input aria-label="Authenticator or recovery code" autoComplete="one-time-code" value={factor} onChange={(event) => setFactor(event.target.value)} />
              </Field.Root>
            )}
            <Button type="submit" size="lg" colorPalette="green">
              {step === 'mfa' ? 'Verify code' : 'Sign in'}
            </Button>
          </Box>
          {step === 'mfa' ? (
            <Button type="button" variant="outline" onClick={useAnotherAccount}>Use a different account</Button>
          ) : null}
        </Stack>
      </Box>
      {error ? <Message text={error} /> : null}
      <Stack direction={{ base: 'column', sm: 'row' }} gap="4" mt="5" px="1" fontSize="sm">
        <Link to="/register">Create account</Link>
        <Link to="/forgot-password">Forgot password?</Link>
      </Stack>
    </Container>
  );
}

function RegisterPage() {
  const { send } = useAuthentication();
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
    <AuthPage>
      <Heading fontFamily="heading" fontSize="2xl">Create account</Heading>
      <Box as="form" display="grid" gap="4" onSubmit={submit}>
        <AuthField label="Email">
          <Input aria-label="Email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} />
        </AuthField>
        <AuthField label="New password">
          <Input aria-label="New password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </AuthField>
        <Text color="governance.muted" fontSize="sm">Use at least 12 characters.</Text>
        <Button type="submit" colorPalette="green">Create account</Button>
      </Box>
      {status ? <Status text={status} /> : null}
      {error ? <Message text={error} /> : null}
      <Text fontSize="sm"><Link to="/sign-in">Sign in</Link></Text>
    </AuthPage>
  );
}

function VerifyPage() {
  const { send } = useAuthentication();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function verify() {
    setError(null);
    try {
      await send<AuthenticationContext>('/api/v1/auth/email-verifications/consume', 'POST', { token });
      navigate('/sign-in?verified=1', { replace: true });
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
    <AuthPage>
      <Heading fontFamily="heading" fontSize="2xl">Verify email</Heading>
      <Stack gap="3">
      {token ? (
        <>
          <Text color="governance.muted">Confirm this email address to continue.</Text>
          <Button type="button" colorPalette="green" onClick={verify}>
            Verify email
          </Button>
        </>
      ) : (
        <Text color="governance.muted">Request a new verification email.</Text>
      )}
      <AuthField label="Email">
        <Input aria-label="Email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
      </AuthField>
      <Button type="button" variant="outline" onClick={resend}>Send a new verification email</Button>
      {status ? <Status text={status} /> : null}
      {error ? <Message text={error} /> : null}
      </Stack>
    </AuthPage>
  );
}

function ForgotPasswordPage() {
  const { send } = useAuthentication();
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
    <AuthPage>
      <Heading fontFamily="heading" fontSize="2xl">Reset password</Heading>
      <Box as="form" display="grid" gap="4" onSubmit={submit}>
        <AuthField label="Email">
          <Input aria-label="Email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </AuthField>
        <Button type="submit" colorPalette="green">Send reset email</Button>
      </Box>
      {status ? <Status text={status} /> : null}
      {error ? <Message text={error} /> : null}
    </AuthPage>
  );
}

function ResetPasswordPage() {
  const { send } = useAuthentication();
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
    <AuthPage>
      <Heading fontFamily="heading" fontSize="2xl">Choose a new password</Heading>
      <Box as="form" display="grid" gap="4" onSubmit={submit}>
        <AuthField label="New password">
          <Input aria-label="New password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </AuthField>
        <Button type="submit" colorPalette="green">Change password</Button>
      </Box>
      {status ? <Status text={status} /> : null}
      {error ? <Message text={error} /> : null}
    </AuthPage>
  );
}

function useEnrollmentSecrets(
  read: () => Promise<Operation>,
  start: () => Promise<AuthenticatorSecrets>,
  complete: (operationId: string, code: string, saved: boolean, password: string) => Promise<void>,
) {
  const [secrets, setSecrets] = useState<AuthenticatorSecrets | null>(null);
  const [operationId, setOperationId] = useState<string | null>(null);
  const [alreadyIssued, setAlreadyIssued] = useState(false);
  const [code, setCode] = useState('');
  const [saved, setSaved] = useState(false);
  const [password, setPassword] = useState('');
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
      await complete(operationId, code, saved, password);
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  return {
    secrets,
    setSecrets,
    setOperationId,
    alreadyIssued,
    code,
    setCode,
    saved,
    setSaved,
    password,
    setPassword,
    error,
    submit,
  };
}

function SecretDisplay({ secrets }: { secrets: AuthenticatorSecrets }) {
  const qr = `data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><rect width="180" height="180" fill="#fff"/><rect x="20" y="20" width="140" height="140" fill="none" stroke="#111" stroke-width="8"/></svg>',
  )}`;
  return (
    <Stack gap="4">
      <Image src={qr} alt="Authenticator QR code" width="180px" height="180px" borderWidth="1px" borderColor="governance.line" borderRadius="lg" />
      <Box>
        <Text mb="1" color="governance.muted" fontSize="xs">Manual key</Text>
        <Code display="block" p="3" borderRadius="md" fontSize="sm" overflowWrap="anywhere">{secrets.manualKey}</Code>
      </Box>
      <Grid as="ol" aria-label="Recovery codes" templateColumns={{ base: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))' }} gap="2" listStyle="none" p="0" m="0">
        {secrets.recoveryCodes.map((value) => (
          <Code as="li" key={value} p="2" borderRadius="md" textAlign="center">{value}</Code>
        ))}
      </Grid>
    </Stack>
  );
}

function EnrollPage() {
  const { send } = useAuthentication();
  const navigate = useNavigate();
  const state = useEnrollmentSecrets(
    () => send<Operation>('/api/v1/auth/enrollment', 'GET'),
    () => send<AuthenticatorSecrets>('/api/v1/auth/enrollment', 'POST', { operationId: crypto.randomUUID() }),
    async (operationId, code, saved, password) => {
      await send('/api/v1/auth/enrollment/complete', 'POST', {
        operationId,
        password,
        authenticatorCode: code,
        recoveryCodesSaved: saved,
      });
      navigate('/activity');
    },
  );

  return (
    <AuthPage>
      <Heading fontFamily="heading" fontSize="2xl">Set up your authenticator</Heading>
      <Text color="governance.muted">Scan the QR code or enter the manual key in your authenticator app, then enter the current six-digit code.</Text>
      <Text color="governance.muted" fontSize="sm">This key and your recovery codes are shown once. Save them before continuing.</Text>
      {state.alreadyIssued ? <Message text="These setup values were already shown. Start a new attempt." /> : null}
      {state.secrets ? <SecretDisplay secrets={state.secrets} /> : null}
      <Box as="form" display="grid" gap="4" onSubmit={state.submit}>
        <AuthField label="Password">
          <Input
            aria-label="Password"
            type="password"
            autoComplete="current-password"
            value={state.password}
            onChange={(event) => state.setPassword(event.target.value)}
          />
        </AuthField>
        <AuthField label="Six-digit code">
          <Input aria-label="Six-digit code" inputMode="numeric" value={state.code} onChange={(event) => state.setCode(event.target.value)} />
        </AuthField>
        <SavedCodesCheckbox checked={state.saved} onChange={state.setSaved} />
        <Button type="submit" colorPalette="green">Complete setup</Button>
      </Box>
      {state.error ? <Message text={state.error} /> : null}
      <Text fontSize="sm"><Link to="/setup/restart">Restart setup</Link></Text>
    </AuthPage>
  );
}

function RestartPage() {
  const { send } = useAuthentication();
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
        password,
        authenticatorCode: code,
        recoveryCodesSaved: saved,
      });
      navigate('/activity');
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  return (
    <AuthPage>
      <Heading fontFamily="heading" fontSize="2xl">Restart setup</Heading>
      {!secrets ? (
        <Box as="form" display="grid" gap="4" onSubmit={restart}>
          <AuthField label="Password">
            <Input aria-label="Password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </AuthField>
          <Button type="submit" colorPalette="green">Restart setup</Button>
        </Box>
      ) : (
        <>
          <SecretDisplay secrets={secrets} />
          <Box as="form" display="grid" gap="4" onSubmit={complete}>
            <AuthField label="Six-digit code">
              <Input aria-label="Six-digit code" inputMode="numeric" value={code} onChange={(event) => setCode(event.target.value)} />
            </AuthField>
            <SavedCodesCheckbox checked={saved} onChange={setSaved} />
            <Button type="submit" colorPalette="green">Complete setup</Button>
          </Box>
        </>
      )}
      {error ? <Message text={error} /> : null}
    </AuthPage>
  );
}

function AccountPage() {
  const { context } = useAuthentication();
  const account = context?.account;

  return (
    <SettingsPanel
      eyebrow="Settings"
      title="Account"
      description="Review your account standing and choose a security setting from the menu."
    >
      <Grid as="dl" templateColumns={{ base: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }} gap="3">
        {[
          ['Email', account?.email ?? 'Unknown'],
          ['Email verified', 'Verified'],
          ['Two-factor authentication', 'On'],
          ['Gateway access', account?.gatewayEntitlement === 'GRANTED' ? 'Granted' : account?.gatewayEntitlement === 'REVOKED' ? 'Revoked' : 'Not granted'],
        ].map(([label, value]) => (
          <Box key={label} p="3" borderRadius="md" bg="governance.canvas">
            <Text as="dt" color="governance.muted" fontSize="xs">{label}</Text>
            <Text as="dd" mt="1" fontSize="sm" fontWeight="semibold">{value}</Text>
          </Box>
        ))}
      </Grid>
    </SettingsPanel>
  );
}

function PasswordPage() {
  const { send } = useAuthentication();
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
    <SettingsPanel eyebrow="Security" title="Change password">
      <Box as="form" display="grid" gap="4"
        onSubmit={(event) => {
          event.preventDefault();
          void change();
        }}
      >
        <AuthField label="New password">
          <Input aria-label="New password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </AuthField>
        <Button type="submit" colorPalette="green">Change password</Button>
      </Box>
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
    </SettingsPanel>
  );
}

function AuthenticatorPage() {
  const { send } = useAuthentication();
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
      navigate('/activity');
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
    <SettingsPanel eyebrow="Security" title="Replace authenticator">
      {!secrets ? <Button colorPalette="green" onClick={start}>Start replacement</Button> : null}
      {secrets ? (
        <>
          <SecretDisplay secrets={secrets} />
          <Text color="governance.muted">Your current authenticator keeps working until you finish this replacement.</Text>
          <Box as="form" display="grid" gap="4" onSubmit={complete}>
            <AuthField label="Six-digit code">
              <Input aria-label="Six-digit code" inputMode="numeric" value={code} onChange={(event) => setCode(event.target.value)} />
            </AuthField>
            <SavedCodesCheckbox checked={saved} onChange={setSaved} />
            <Button type="submit" colorPalette="green">Complete replacement</Button>
          </Box>
          <Button variant="outline" onClick={cancel}>Cancel replacement</Button>
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
    </SettingsPanel>
  );
}

function RecoveryGenerationPage() {
  const { context, send } = useAuthentication();
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
    <SettingsPanel eyebrow="Security" title="Generate new recovery codes">
      {!codes ? <Button colorPalette="green" onClick={start}>Generate new recovery codes</Button> : null}
      {codes ? (
        <>
          <Text color="governance.muted">Generating new codes revokes the previous set after you confirm you saved the new one.</Text>
          <Grid as="ol" aria-label="Recovery codes" templateColumns={{ base: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))' }} gap="2" listStyle="none" p="0" m="0">
            {codes.map((value) => (
              <Code as="li" key={value} p="2" borderRadius="md" textAlign="center">{value}</Code>
            ))}
          </Grid>
          <SavedCodesCheckbox checked={saved} onChange={setSaved} />
          <HStack gap="2">
            <Button colorPalette="green" onClick={complete}>Continue</Button>
            <Button variant="outline" onClick={cancel}>Cancel</Button>
          </HStack>
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
    </SettingsPanel>
  );
}

function SignedOutPage() {
  return (
    <AuthPage>
      <Heading fontFamily="heading" fontSize="2xl">Signed out</Heading>
      <Text color="governance.muted">Your session has ended.</Text>
      <ChakraLink asChild><Link to="/sign-in">Sign in</Link></ChakraLink>
    </AuthPage>
  );
}

export function AuthenticationRoutes() {
  const { pathname } = useLocation();
  const showAuthenticationHeader = [
    '/sign-in',
    '/register',
    '/verify',
    '/forgot-password',
    '/reset-password',
    '/signed-out',
  ].includes(pathname);

  return (
    <Box
      minH="100vh"
      bg={showAuthenticationHeader ? 'governance.canvas' : undefined}
      bgImage={showAuthenticationHeader
        ? 'linear-gradient(rgba(20,107,89,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(20,107,89,0.045) 1px, transparent 1px)'
        : undefined}
      bgSize="36px 36px"
    >
      {showAuthenticationHeader ? <ApplicationHeader variant="public" /> : null}
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
            <AccountSettings>
              <AccountPage />
            </AccountSettings>
          }
        />
        <Route
          path="/account/password"
          element={
            <AccountSettings>
              <PasswordPage />
            </AccountSettings>
          }
        />
        <Route
          path="/account/authenticator"
          element={
            <AccountSettings>
              <AuthenticatorPage />
            </AccountSettings>
          }
        />
        <Route
          path="/account/recovery-codes"
          element={
            <AccountSettings>
              <RecoveryGenerationPage />
            </AccountSettings>
          }
        />
        <Route
          path="/account/gateway-keys"
          element={
            <AccountSettings>
              <Suspense fallback={<PageLoading label="Loading gateway keys" />}>
                <GatewayKeysPage />
              </Suspense>
            </AccountSettings>
          }
        />
        <Route path="/signed-out" element={<SignedOutPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Box>
  );
}
