import type { ReactNode } from 'react';
import { Box, Button, Container, Grid, Heading, Stack, Text } from '@chakra-ui/react';
import { Cable, KeyRound, LockKeyhole, ShieldCheck, Terminal, UserRound, Users } from 'lucide-react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { useAuthentication } from '../../AuthenticationContext';
import { t } from '../../i18n';

export function SettingsLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { context } = useAuthentication();
  const keycloak = context?.provider === 'keycloak';
  const links = [
    { label: t('account.overview'), to: '/account', icon: UserRound, external: false },
    ...(keycloak ? [] : [
      { label: t('common.password'), to: '/account/password', icon: LockKeyhole, external: false },
      { label: t('account.authenticator'), to: '/account/authenticator', icon: ShieldCheck, external: false },
      { label: t('account.recoveryCodes'), to: '/account/recovery-codes', icon: KeyRound, external: false },
    ]),
    { label: t('gateway.title'), to: '/account/gateway-keys', icon: Cable, external: false },
    { label: t('setup.title'), to: '/account/agent-setup', icon: Terminal, external: false },
    { label: t('groups.title'), to: '/account/groups', icon: Users, external: false },
    ...(keycloak ? [{
      label: t('account.keycloakAccount'),
      to: 'http://127.0.0.1:8180/realms/arg/account',
      icon: ShieldCheck,
      external: true,
    }] : []),
  ];

  return (
    <Container maxW="1440px" py={{ base: '6', md: '10' }} px={{ base: '4', md: '8' }}>
      <Grid
        templateColumns={{ base: '1fr', lg: '15rem minmax(0, 1fr)' }}
        gap={{ base: '6', lg: '12' }}
        alignItems="start"
      >
        <Box as="nav" aria-label={t('account.settingsNavigation')} position={{ lg: 'sticky' }} top={{ lg: '6' }}>
          <Text
            px="3"
            mb="3"
            color="governance.muted"
            fontSize="xs"
            fontWeight="bold"
            letterSpacing="0.08em"
            textTransform="uppercase"
          >
            {t('account.settings')}
          </Text>
          <Stack gap="1" justify="center" minH={{ lg: 'calc(100vh - 13rem)' }}>
            {links.map(({ label, to, icon: Icon, external }) => {
              const active = !external && (to === '/account'
                ? pathname === to
                : pathname === to || pathname.startsWith(`${to}/`));
              return (
                <Button
                  key={to}
                  asChild
                  w="full"
                  size="sm"
                  justifyContent="flex-start"
                  variant={active ? 'subtle' : 'ghost'}
                  colorPalette="green"
                >
                  {external ? (
                    <a href={to} target="_blank" rel="noreferrer">
                      <Icon size={16} aria-hidden="true" />
                      {label}
                    </a>
                  ) : (
                    <RouterLink to={to} aria-current={active ? 'page' : undefined}>
                      <Icon size={16} aria-hidden="true" />
                      {label}
                    </RouterLink>
                  )}
                </Button>
              );
            })}
          </Stack>
        </Box>
        <Box as="section" minW="0">
          {children}
        </Box>
      </Grid>
    </Container>
  );
}

export function SettingsHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <Box mb="6">
      <Text mb="2" color="governance.primary" fontSize="xs" fontWeight="bold" textTransform="uppercase">
        {eyebrow}
      </Text>
      <Heading as="h1" fontFamily="heading" fontSize={{ base: '2xl', md: '3xl' }}>{title}</Heading>
      {description ? (
        <Text mt="2" maxW="52rem" color="governance.muted">{description}</Text>
      ) : null}
    </Box>
  );
}

export function SettingsPanel({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Box
      p={{ base: '5', md: '8' }}
      borderWidth="1px"
      borderColor="governance.line"
      borderRadius="xl"
      bg="white"
      boxShadow="0 18px 52px rgba(23,43,52,0.08)"
    >
      <SettingsHeading eyebrow={eyebrow} title={title} description={description} />
      <Stack gap="6">{children}</Stack>
    </Box>
  );
}
