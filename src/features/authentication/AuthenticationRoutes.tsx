import { lazy, Suspense, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Box, Button, Checkbox, Code, Container, Field, Grid, Heading, HStack, Input, Link as ChakraLink, Stack, Text } from '@chakra-ui/react';
import { Activity, Fingerprint, ShieldCheck } from 'lucide-react';
import QRCode from 'react-qr-code';
import { ApiError } from '../../ApplicationApiClient';
import type { AuthenticatorSecrets } from '../../api/AuthenticatorSecrets';
import type { AuthenticationContext } from '../../api/AuthenticationContext';
import type { Operation } from '../../api/Operation';
import { useAuthentication } from '../../AuthenticationContext';
import { ApplicationErrorPage } from '../../components/ApplicationErrorPage';
import { ApplicationHeader } from '../../components/layout/ApplicationHeader';
import { RequireHuman } from '../../components/layout/RequireHuman';
import { PageLoading } from '../../components/ui/PageLoading';
import { t } from '../../i18n';
import { SettingsLayout, SettingsPanel } from '../account/SettingsLayout';
import { StepUpDialog } from './StepUpDialog';

const GatewayKeysPage = lazy(() => import('../gateway/GatewayKeysPage')
  .then((module) => ({ default: module.GatewayKeysPage })));
const AgentSetupPage = lazy(() => import('../setup/AgentSetupPage')
  .then((module) => ({ default: module.AgentSetupPage })));
const GroupsPage = lazy(() => import('../groups/GroupsPage')
  .then((module) => ({ default: module.GroupsPage })));

const REGISTERED = t('auth.registered');
const RESEND_SENT = t('auth.resendSent');
const RESET_SENT = t('auth.resetSent');

function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.fieldErrors.length > 0) {
      return error.fieldErrors[0].message;
    }
    if (error.code === 'RATE_LIMITED' && error.retryAfterSeconds) {
      return t('common.tooManyAttempts', { seconds: error.retryAfterSeconds });
    }
    return error.message;
  }
  return t('common.somethingWentWrong');
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
    return <PageLoading label={t('loading.accountContext')} />;
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

function AuthPage({ children }: { children: ReactNode }) {
  return (
    <Container as="main" maxW="xl" flex="1" px="4" py={{ base: '8', md: '14' }}>
      <Box p={{ base: '5', md: '8' }} borderWidth="1px" borderColor="governance.line" borderRadius="xl" bg="white" boxShadow="0 18px 52px rgba(23,43,52,0.08)">
        <Stack gap="4">{children}</Stack>
      </Box>
    </Container>
  );
}

function AuthBrand() {
  return (
    <HStack justify="center" gap="1.5" mt="4" color="governance.muted" fontSize="xs">
      <ShieldCheck size={14} aria-hidden="true" />
      <Text>{t('auth.brand')}</Text>
    </HStack>
  );
}

function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <Container as="main" maxW="6xl" flex="1" px={{ base: '4', md: '8' }} py={{ base: '8', md: '14' }}>
      <Grid templateColumns={{ base: '1fr', lg: '1.05fr 1fr' }} gap={{ base: '8', lg: '16' }} alignItems="center">
        <Box display={{ base: 'none', lg: 'block' }} maxW="xl">
          <Text mb="3" color="governance.primary" fontSize="xs" fontWeight="bold" letterSpacing="0.12em" textTransform="uppercase">
            {t('auth.eyebrow')}
          </Text>
          <Heading fontFamily="heading" fontSize="4xl" lineHeight="1.08">
            {t('auth.heroTitle')}
          </Heading>
          <Text mt="4" color="governance.muted" fontSize="lg" lineHeight="1.7">
            {t('auth.heroDescription')}
          </Text>
          <Stack mt="8" gap="5">
            <SignInFeature
              icon={ShieldCheck}
              title={t('auth.featureGuardedTitle')}
              description={t('auth.featureGuardedDescription')}
            />
            <SignInFeature
              icon={Activity}
              title={t('auth.featureTimelineTitle')}
              description={t('auth.featureTimelineDescription')}
            />
            <SignInFeature
              icon={Fingerprint}
              title={t('auth.featureSecurityTitle')}
              description={t('auth.featureSecurityDescription')}
            />
          </Stack>
        </Box>

        <Box
          w="full"
          maxW={{ base: 'full', md: '28rem' }}
          justifySelf={{ base: 'center', lg: 'end' }}
          p={{ base: '6', md: '8' }}
          borderWidth="1px"
          borderColor="governance.line"
          borderRadius="2xl"
          bg="white"
          boxShadow="0 24px 64px rgba(23,43,52,0.10)"
        >
          <Stack gap="6">{children}</Stack>
        </Box>
      </Grid>
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
      <Checkbox.HiddenInput aria-label={t('auth.savedCodes')} />
      <Checkbox.Control />
      <Checkbox.Label>{t('auth.savedCodes')}</Checkbox.Label>
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

function RequireNativeSettings({ children }: { children: ReactNode }) {
  const { context } = useAuthentication();
  if (context?.provider === 'keycloak') {
    return <Navigate to="/account" replace />;
  }
  return <>{children}</>;
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
      eyebrow={t('errors.pageNotFoundEyebrow')}
      title={t('errors.pageNotFoundTitle')}
      description={t('errors.pageNotFoundDescription')}
    >
      <Button asChild variant="outline">
        <Link to="/">{t('errors.returnToStart')}</Link>
      </Button>
    </ApplicationErrorPage>
  );
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4c-7.7 0-14.4 4.4-17.7 10.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C40.9 35.6 44 30.4 44 24c0-1.3-.1-2.3-.4-3.5z" />
    </svg>
  );
}

function OrDivider() {
  return (
    <HStack gap="3" color="governance.muted" fontSize="xs" textTransform="uppercase" letterSpacing="0.08em">
      <Box flex="1" h="1px" bg="governance.line" />
      <Text whiteSpace="nowrap">{t('auth.orContinueWith')}</Text>
      <Box flex="1" h="1px" bg="governance.line" />
    </HStack>
  );
}

function SignInFeature({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof ShieldCheck;
  title: string;
  description: string;
}) {
  return (
    <HStack align="flex-start" gap="3">
      <Box p="2.5" borderRadius="lg" bg="green.50" color="governance.primary" flexShrink="0">
        <Icon size={18} aria-hidden="true" />
      </Box>
      <Box>
        <Text fontWeight="semibold">{title}</Text>
        <Text color="governance.muted" fontSize="sm">{description}</Text>
      </Box>
    </HStack>
  );
}

function SignInPage() {
  const { context, send } = useAuthentication();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const verified = params.get('verified') === '1';
  const [step, setStep] = useState<'credentials' | 'mfa'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [factor, setFactor] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (step === 'mfa' && !factor.trim()) {
      setError(t('auth.enterAuthenticatorCode'));
      return;
    }
    setPending(true);
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
    } finally {
      setPending(false);
    }
  }

  function useAnotherAccount() {
    setStep('credentials');
    setFactor('');
    setError(null);
  }

  return (
    <AuthFrame>
      <Box>
        <Text mb="2" color="governance.primary" fontSize="xs" fontWeight="bold" letterSpacing="0.08em" textTransform="uppercase">
          {t('auth.accountAccess')}
        </Text>
        <Heading fontFamily="heading" fontSize="2xl">
          {step === 'mfa' ? t('auth.twoFactorTitle') : t('auth.signInTitle')}
        </Heading>
        <Text mt="2" color="governance.muted" fontSize="sm">
          {step === 'mfa'
            ? t('auth.mfaPrompt', { email })
            : t('auth.signInDescription')}
        </Text>
        {verified && step === 'credentials' ? <Status text={t('auth.emailVerified')} /> : null}
      </Box>

      <Stack as="form" gap="4" onSubmit={submit}>
        {step === 'credentials' ? (
          <>
            <AuthField label={t('common.email')}>
              <Input aria-label={t('common.email')} type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} />
            </AuthField>
            <Field.Root>
              <HStack justify="space-between" align="baseline">
                <Field.Label>{t('common.password')}</Field.Label>
                <ChakraLink asChild fontSize="xs" color="governance.muted">
                  <Link to="/forgot-password">{t('auth.forgotPassword')}</Link>
                </ChakraLink>
              </HStack>
              <Input aria-label={t('common.password')} type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </Field.Root>
          </>
        ) : (
          <AuthField label={t('common.authenticatorOrRecoveryCode')}>
            <Input aria-label={t('common.authenticatorOrRecoveryCode')} autoComplete="one-time-code" value={factor} onChange={(event) => setFactor(event.target.value)} />
          </AuthField>
        )}
        <Button type="submit" size="lg" h="11" colorPalette="green" disabled={pending}>
          {step === 'mfa' ? t('auth.verifyCode') : t('common.signIn')}
        </Button>
        {step === 'mfa' ? (
          <Button type="button" variant="ghost" size="sm" onClick={useAnotherAccount}>
            {t('auth.useDifferentAccount')}
          </Button>
        ) : null}
      </Stack>

      {step === 'credentials' ? (
        <>
          <OrDivider />
          <Grid
            templateColumns={context?.googleLoginEnabled ? { base: '1fr', sm: 'repeat(2, minmax(0, 1fr))' } : '1fr'}
            gap="3"
          >
            <Button asChild variant="outline" h="11" borderColor="governance.line" gap="2">
              <a href="/api/v1/keycloak/login">
                <ShieldCheck size={16} aria-hidden="true" />
                {t('auth.keycloakSso')}
              </a>
            </Button>
            {context?.googleLoginEnabled ? (
              <Button asChild variant="outline" h="11" borderColor="governance.line" gap="2">
                <a href="/api/v1/keycloak/login/google">
                  <GoogleMark />
                  {t('auth.google')}
                </a>
              </Button>
            ) : null}
          </Grid>
        </>
      ) : null}

      {error ? <Message text={error} /> : null}

      <Box pt="5" borderTopWidth="1px" borderColor="governance.line">
        <Text fontSize="sm" color="governance.muted" textAlign="center">{t('auth.newHere')}</Text>
        <HStack justify="center" gap="2" mt="1" fontSize="sm" flexWrap="wrap">
          <Link to="/register">{t('auth.createAccount')}</Link>
          <Text color="governance.line" aria-hidden="true">·</Text>
          <Link to="/register/keycloak">{t('auth.createKeycloakAccount')}</Link>
        </HStack>
        <AuthBrand />
      </Box>
    </AuthFrame>
  );
}

function RegisterPage() {
  const { send } = useAuthentication();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setStatus('');
    if (!email.includes('@')) {
      setError(t('common.enterValidEmail'));
      return;
    }
    if (password.length < 12) {
      setError(t('common.useAtLeast12Chars'));
      return;
    }
    setPending(true);
    try {
      await send('/api/v1/auth/registrations', 'POST', { email, password });
      setStatus(REGISTERED);
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthFrame>
      {status ? (
        <>
          <Box>
            <Text mb="2" color="governance.primary" fontSize="xs" fontWeight="bold" letterSpacing="0.08em" textTransform="uppercase">
              {t('auth.accountAccess')}
            </Text>
            <Heading fontFamily="heading" fontSize="2xl">{t('auth.checkYourEmail')}</Heading>
            <Text mt="2" color="governance.muted" fontSize="sm">
              {t('auth.sentVerificationTo', { email })}
            </Text>
          </Box>
          <Status text={status} />
          <Text color="governance.muted" fontSize="sm">
            {t('auth.openLinkToActivate')}
          </Text>
          <Button asChild variant="outline">
            <Link to="/sign-in">{t('common.backToSignIn')}</Link>
          </Button>
          <Text fontSize="sm" color="governance.muted" textAlign="center">
            {t('auth.didntGetEmail')} <Link to="/verify">{t('auth.resendVerificationEmail')}</Link>.
          </Text>
        </>
      ) : (
        <>
          <Box>
            <Text mb="2" color="governance.primary" fontSize="xs" fontWeight="bold" letterSpacing="0.08em" textTransform="uppercase">
              {t('auth.accountAccess')}
            </Text>
            <Heading fontFamily="heading" fontSize="2xl">{t('auth.createAccountTitle')}</Heading>
            <Text mt="2" color="governance.muted" fontSize="sm">
              {t('auth.createAccountDescription')}
            </Text>
          </Box>
          <Box as="form" display="grid" gap="4" onSubmit={submit}>
            <AuthField label={t('common.email')}>
              <Input aria-label={t('common.email')} type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} />
            </AuthField>
            <AuthField label={t('common.newPassword')}>
              <Input aria-label={t('common.newPassword')} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </AuthField>
            <Text color="governance.muted" fontSize="sm">{t('common.useAtLeast12Chars')}</Text>
            <Button type="submit" colorPalette="green" disabled={pending}>
              {pending ? t('auth.creatingAccount') : t('auth.createAccountTitle')}
            </Button>
          </Box>
          {error ? <Message text={error} /> : null}
        </>
      )}
      <Box pt="5" borderTopWidth="1px" borderColor="governance.line">
        <Text fontSize="sm" color="governance.muted" textAlign="center">
          {t('auth.alreadyHaveAccount')} <Link to="/sign-in">{t('common.signIn')}</Link>
        </Text>
        <Text mt="2" fontSize="sm" color="governance.muted" textAlign="center">
          {t('auth.preferKeycloak')} <Link to="/register/keycloak">{t('auth.createKeycloakAccount')}</Link>
        </Text>
        <AuthBrand />
      </Box>
    </AuthFrame>
  );
}

function KeycloakRegisterPage() {
  const { send } = useAuthentication();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setStatus('');
    if (!email.includes('@')) {
      setError(t('common.enterValidEmail'));
      return;
    }
    if (password.length < 12) {
      setError(t('common.useAtLeast12Chars'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('common.passwordsDoNotMatch'));
      return;
    }
    setPending(true);
    try {
      await send('/api/v1/keycloak/register', 'POST', {
        firstName,
        lastName,
        email,
        password,
      });
      setStatus(t('auth.registered'));
      setPassword('');
      setConfirmPassword('');
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthFrame>
      {status ? (
        <>
          <Box>
            <Text mb="2" color="governance.primary" fontSize="xs" fontWeight="bold" letterSpacing="0.08em" textTransform="uppercase">
              {t('auth.accountAccess')}
            </Text>
            <Heading fontFamily="heading" fontSize="2xl">{t('auth.checkYourEmail')}</Heading>
            <Text mt="2" color="governance.muted" fontSize="sm">
              {t('auth.sentVerificationTo', { email })}
            </Text>
          </Box>
          <Status text={status} />
          <Text color="governance.muted" fontSize="sm">
            {t('auth.openLinkToActivate')}
          </Text>
          <Button asChild variant="outline">
            <Link to="/sign-in">{t('common.backToSignIn')}</Link>
          </Button>
        </>
      ) : (
        <>
          <Box>
            <Text mb="2" color="governance.primary" fontSize="xs" fontWeight="bold" letterSpacing="0.08em" textTransform="uppercase">
              {t('auth.accountAccess')}
            </Text>
            <Heading fontFamily="heading" fontSize="2xl">{t('auth.keycloakCreateTitle')}</Heading>
            <Text mt="2" color="governance.muted" fontSize="sm">
              {t('auth.keycloakCreateDescription')}
            </Text>
          </Box>
          <Box as="form" display="grid" gap="4" onSubmit={submit}>
            <AuthField label={t('common.firstName')}>
              <Input aria-label={t('common.firstName')} autoComplete="given-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} />
            </AuthField>
            <AuthField label={t('common.lastName')}>
              <Input aria-label={t('common.lastName')} autoComplete="family-name" value={lastName} onChange={(event) => setLastName(event.target.value)} />
            </AuthField>
            <AuthField label={t('common.email')}>
              <Input aria-label={t('common.email')} type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} />
            </AuthField>
            <AuthField label={t('common.newPassword')}>
              <Input aria-label={t('common.newPassword')} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </AuthField>
            <AuthField label={t('common.confirmPassword')}>
              <Input aria-label={t('common.confirmPassword')} type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
            </AuthField>
            <Text color="governance.muted" fontSize="sm">{t('auth.keycloakPasswordHint')}</Text>
            <Button type="submit" colorPalette="green" disabled={pending}>
              {pending ? t('auth.creatingAccount') : t('auth.createAccountTitle')}
            </Button>
          </Box>
          {error ? <Message text={error} /> : null}
        </>
      )}
      <Box pt="5" borderTopWidth="1px" borderColor="governance.line">
        <Text fontSize="sm" color="governance.muted" textAlign="center">
          {t('auth.alreadyHaveAccount')} <Link to="/sign-in">{t('common.signIn')}</Link>
        </Text>
        <Text mt="2" fontSize="sm" color="governance.muted" textAlign="center">
          {t('auth.preferStandardAccount')} <Link to="/register">{t('auth.createAccount')}</Link>
        </Text>
        <AuthBrand />
      </Box>
    </AuthFrame>
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
      setStatus(RESEND_SENT);
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  return (
    <AuthPage>
      <Heading fontFamily="heading" fontSize="2xl">{t('auth.verifyEmailTitle')}</Heading>
      <Stack gap="3">
      {token ? (
        <>
          <Text color="governance.muted">{t('auth.verifyConfirm')}</Text>
          <Button type="button" colorPalette="green" onClick={verify}>
            {t('auth.verifyEmailTitle')}
          </Button>
        </>
      ) : (
        <Text color="governance.muted">{t('auth.verifyRequestNew')}</Text>
      )}
      <AuthField label={t('common.email')}>
        <Input aria-label={t('common.email')} type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
      </AuthField>
      <Button type="button" variant="outline" onClick={resend}>{t('auth.sendNewVerification')}</Button>
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
      setStatus(RESET_SENT);
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  return (
    <AuthPage>
      <Heading fontFamily="heading" fontSize="2xl">{t('auth.resetPasswordTitle')}</Heading>
      <Box as="form" display="grid" gap="4" onSubmit={submit}>
        <AuthField label={t('common.email')}>
          <Input aria-label={t('common.email')} type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </AuthField>
        <Button type="submit" colorPalette="green">{t('auth.sendResetEmail')}</Button>
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
      setStatus(t('auth.passwordChangedSignIn'));
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  return (
    <AuthPage>
      <Heading fontFamily="heading" fontSize="2xl">{t('auth.chooseNewPassword')}</Heading>
      <Box as="form" display="grid" gap="4" onSubmit={submit}>
        <AuthField label={t('common.newPassword')}>
          <Input aria-label={t('common.newPassword')} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </AuthField>
        <Button type="submit" colorPalette="green">{t('auth.changePassword')}</Button>
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
  return (
    <Stack gap="4">
      <Box
        role="img"
        aria-label={t('auth.authenticatorQrCode')}
        width="fit-content"
        p="3"
        borderWidth="1px"
        borderColor="governance.line"
        borderRadius="lg"
        bg="white"
      >
        <QRCode
          value={secrets.provisioningUri}
          size={180}
          level="M"
          bgColor="#ffffff"
          fgColor="#111111"
        />
      </Box>
      <Box>
        <Text mb="1" color="governance.muted" fontSize="xs">{t('auth.manualKey')}</Text>
        <Code aria-label={t('auth.manualKey')} display="block" p="3" borderRadius="md" fontSize="sm" overflowWrap="anywhere">{secrets.manualKey}</Code>
      </Box>
      <Grid as="ol" aria-label={t('auth.recoveryCodes')} templateColumns={{ base: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))' }} gap="2" listStyle="none" p="0" m="0">
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
      <Heading fontFamily="heading" fontSize="2xl">{t('auth.setUpAuthenticator')}</Heading>
      <Text color="governance.muted">{t('auth.scanQr')}</Text>
      <Text color="governance.muted" fontSize="sm">{t('auth.keyShownOnce')}</Text>
      {state.alreadyIssued ? <Message text={t('auth.setupValuesAlreadyShown')} /> : null}
      {state.secrets ? <SecretDisplay secrets={state.secrets} /> : null}
      <Box as="form" display="grid" gap="4" onSubmit={state.submit}>
        <AuthField label={t('common.password')}>
          <Input
            aria-label={t('common.password')}
            type="password"
            autoComplete="current-password"
            value={state.password}
            onChange={(event) => state.setPassword(event.target.value)}
          />
        </AuthField>
        <AuthField label={t('common.sixDigitCode')}>
          <Input aria-label={t('common.sixDigitCode')} inputMode="numeric" value={state.code} onChange={(event) => state.setCode(event.target.value)} />
        </AuthField>
        <SavedCodesCheckbox checked={state.saved} onChange={state.setSaved} />
        <Button type="submit" colorPalette="green">{t('auth.completeSetup')}</Button>
      </Box>
      {state.error ? <Message text={state.error} /> : null}
      <Text fontSize="sm"><Link to="/setup/restart">{t('auth.restartSetup')}</Link></Text>
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
      <Heading fontFamily="heading" fontSize="2xl">{t('auth.restartSetup')}</Heading>
      {!secrets ? (
        <Box as="form" display="grid" gap="4" onSubmit={restart}>
          <AuthField label={t('common.password')}>
            <Input aria-label={t('common.password')} type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </AuthField>
          <Button type="submit" colorPalette="green">{t('auth.restartSetup')}</Button>
        </Box>
      ) : (
        <>
          <SecretDisplay secrets={secrets} />
          <Box as="form" display="grid" gap="4" onSubmit={complete}>
            <AuthField label={t('common.sixDigitCode')}>
              <Input aria-label={t('common.sixDigitCode')} inputMode="numeric" value={code} onChange={(event) => setCode(event.target.value)} />
            </AuthField>
            <SavedCodesCheckbox checked={saved} onChange={setSaved} />
            <Button type="submit" colorPalette="green">{t('auth.completeSetup')}</Button>
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
      eyebrow={t('account.settingsEyebrow')}
      title={t('account.title')}
      description={t('account.description')}
    >
      <Grid as="dl" templateColumns={{ base: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }} gap="3">
        {[
          [t('common.email'), account?.email ?? t('account.unknown')],
          [t('account.emailVerified'), t('account.verified')],
          [t('account.twoFactor'), t('account.on')],
          [t('account.gatewayAccess'), account?.gatewayEntitlement === 'GRANTED' ? t('account.granted') : account?.gatewayEntitlement === 'REVOKED' ? t('account.revoked') : t('account.notGranted')],
        ].map(([label, value]) => (
          <Box key={label} p="3" borderRadius="md" bg="governance.canvas">
            <Text as="dt" color="governance.muted" fontSize="xs">{label}</Text>
            <Text as="dd" mt="1" fontSize="sm" fontWeight="semibold">{value}</Text>
          </Box>
        ))}
      </Grid>
      {context?.provider === 'keycloak' ? (
        <ChakraLink href="http://127.0.0.1:8180/realms/arg/account" target="_blank" rel="noreferrer" fontSize="sm">
          {t('account.manageKeycloak')}
        </ChakraLink>
      ) : (
        <Text fontSize="sm" color="governance.muted">
          {t('account.manageNative')}
        </Text>
      )}
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
      setStatus(t('account.passwordChangedSessions'));
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'RECENT_AUTH_REQUIRED') {
        setStepUp(true);
      } else {
        setError(errorText(caught));
      }
    }
  }

  return (
    <SettingsPanel eyebrow={t('account.securityEyebrow')} title={t('account.changePasswordTitle')}>
      <Box as="form" display="grid" gap="4"
        onSubmit={(event) => {
          event.preventDefault();
          void change();
        }}
      >
        <AuthField label={t('common.newPassword')}>
          <Input aria-label={t('common.newPassword')} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </AuthField>
        <Button type="submit" colorPalette="green">{t('auth.changePassword')}</Button>
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
    setStatus(t('account.pendingReplacementCancelled'));
    setSecrets(null);
  }

  return (
    <SettingsPanel eyebrow={t('account.securityEyebrow')} title={t('account.replaceAuthenticatorTitle')}>
      {!secrets ? <Button colorPalette="green" onClick={start}>{t('account.startReplacement')}</Button> : null}
      {secrets ? (
        <>
          <SecretDisplay secrets={secrets} />
          <Text color="governance.muted">{t('account.currentAuthenticatorKeepsWorking')}</Text>
          <Box as="form" display="grid" gap="4" onSubmit={complete}>
            <AuthField label={t('common.sixDigitCode')}>
              <Input aria-label={t('common.sixDigitCode')} inputMode="numeric" value={code} onChange={(event) => setCode(event.target.value)} />
            </AuthField>
            <SavedCodesCheckbox checked={saved} onChange={setSaved} />
            <Button type="submit" colorPalette="green">{t('account.completeReplacement')}</Button>
          </Box>
          <Button variant="outline" onClick={cancel}>{t('account.cancelReplacement')}</Button>
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
          setStatus(t('account.newRecoveryActive'));
        } else if (operation.state === 'PENDING') {
          setError(t('auth.setupValuesAlreadyShown'));
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
      setStatus(t('account.newRecoveryActive'));
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
      setStatus(t('account.pendingCodesCancelled'));
      setCodes(null);
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  return (
    <SettingsPanel eyebrow={t('account.securityEyebrow')} title={t('account.generateRecoveryTitle')}>
      {!codes ? <Button colorPalette="green" onClick={start}>{t('account.generateRecovery')}</Button> : null}
      {codes ? (
        <>
          <Text color="governance.muted">{t('account.generateRecoveryDescription')}</Text>
          <Grid as="ol" aria-label={t('auth.recoveryCodes')} templateColumns={{ base: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))' }} gap="2" listStyle="none" p="0" m="0">
            {codes.map((value) => (
              <Code as="li" key={value} p="2" borderRadius="md" textAlign="center">{value}</Code>
            ))}
          </Grid>
          <SavedCodesCheckbox checked={saved} onChange={setSaved} />
          <HStack gap="2">
            <Button colorPalette="green" onClick={complete}>{t('account.continue')}</Button>
            <Button variant="outline" onClick={cancel}>{t('common.cancel')}</Button>
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
      <Heading fontFamily="heading" fontSize="2xl">{t('account.signedOutTitle')}</Heading>
      <Text color="governance.muted">{t('account.sessionEnded')}</Text>
      <ChakraLink asChild><Link to="/sign-in">{t('common.signIn')}</Link></ChakraLink>
    </AuthPage>
  );
}

export function AuthenticationRoutes() {
  const { pathname } = useLocation();
  const showAuthenticationHeader = [
    '/sign-in',
    '/register',
    '/register/keycloak',
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
        <Route path="/register/keycloak" element={<KeycloakRegisterPage />} />
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
            <RequireNativeSettings>
              <AccountSettings>
                <PasswordPage />
              </AccountSettings>
            </RequireNativeSettings>
          }
        />
        <Route
          path="/account/authenticator"
          element={
            <RequireNativeSettings>
              <AccountSettings>
                <AuthenticatorPage />
              </AccountSettings>
            </RequireNativeSettings>
          }
        />
        <Route
          path="/account/recovery-codes"
          element={
            <RequireNativeSettings>
              <AccountSettings>
                <RecoveryGenerationPage />
              </AccountSettings>
            </RequireNativeSettings>
          }
        />
        <Route
          path="/account/gateway-keys"
          element={
            <AccountSettings>
              <Suspense fallback={<PageLoading label={t('loading.gatewayKeys')} />}>
                <GatewayKeysPage />
              </Suspense>
            </AccountSettings>
          }
        />
        <Route
          path="/account/agent-setup"
          element={
            <AccountSettings>
              <Suspense fallback={<PageLoading label={t('loading.account')} />}>
                <AgentSetupPage />
              </Suspense>
            </AccountSettings>
          }
        />
        <Route
          path="/account/groups"
          element={
            <AccountSettings>
              <Suspense fallback={<PageLoading label={t('loading.account')} />}>
                <GroupsPage />
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
