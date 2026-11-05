import { Box, Button, Flex, HStack, Link, Text } from '@chakra-ui/react';
import { Activity, CircleUserRound, LogIn, LogOut, UserRound } from 'lucide-react';
import { Link as RouterLink, useLocation } from 'react-router-dom';

type HeaderVariant = 'authenticated' | 'public' | 'preview' | 'error';

export function ApplicationHeader({
  variant,
  email,
  onSignOut,
  pending = false,
}: {
  variant: HeaderVariant;
  email?: string;
  onSignOut?: () => void;
  pending?: boolean;
}) {
  const { pathname } = useLocation();
  const links = variant === 'authenticated' || variant === 'error'
    ? [
        { label: 'Activity', to: '/activity', icon: Activity },
        { label: 'Account', to: '/account', icon: UserRound },
      ]
    : variant === 'preview'
      ? [{ label: 'Sign in', to: '/sign-in', icon: LogIn }]
      : [
          { label: 'Sign in', to: '/sign-in', icon: LogIn },
          { label: 'Create account', to: '/register', icon: CircleUserRound },
        ];

  return (
    <Box as="header" borderBottomWidth="1px" borderColor="governance.line" bg="white/92" backdropFilter="blur(14px)">
      <Flex
        w="full"
        maxW="1440px"
        minH={{ base: 'auto', md: '76px' }}
        mx="auto"
        px={{ base: '4', md: '8' }}
        py={{ base: '3', md: '0' }}
        align="center"
        justify="space-between"
        gap="4"
        wrap="wrap"
      >
        <Link asChild color="governance.ink" _hover={{ textDecoration: 'none' }}>
          <RouterLink to={variant === 'preview' ? '/activity-preview' : '/'}>
            <HStack gap="3">
              <Flex
                w="10"
                h="10"
                align="center"
                justify="center"
                borderRadius="lg"
                bg="governance.ink"
                color="white"
                fontSize="xs"
                fontWeight="800"
                letterSpacing="0.06em"
                aria-hidden="true"
              >
                AR
              </Flex>
              <Box>
                <Text fontFamily="heading" fontSize="sm" fontWeight="700" lineHeight="short">
                  AI Runtime Governance
                </Text>
                <Text display={{ base: 'none', sm: 'block' }} mt="1" color="governance.muted" fontSize="xs">
                  Runtime activity
                </Text>
              </Box>
            </HStack>
          </RouterLink>
        </Link>

        <HStack as="nav" aria-label="Main navigation" gap="2" flexWrap="wrap">
          {links.map(({ label, to, icon: Icon }) => {
            const active = pathname === to || (to !== '/' && pathname.startsWith(`${to}/`));
            return (
              <Button
                key={to}
                asChild
                size="sm"
                variant={active ? 'subtle' : 'ghost'}
                colorPalette="green"
              >
                <RouterLink to={to} aria-current={active ? 'page' : undefined}>
                  <Icon size={16} aria-hidden="true" />
                  {label}
                </RouterLink>
              </Button>
            );
          })}
          {variant === 'authenticated' ? (
            <>
              {email ? (
                <Text display={{ base: 'none', md: 'block' }} maxW="15rem" overflow="hidden" color="governance.muted" fontSize="sm" textOverflow="ellipsis" whiteSpace="nowrap" title={email}>
                  {email}
                </Text>
              ) : null}
              <Button size="sm" variant="outline" onClick={onSignOut} disabled={pending}>
                <LogOut size={16} aria-hidden="true" />
                {pending ? 'Signing out…' : 'Sign out'}
              </Button>
            </>
          ) : null}
        </HStack>
      </Flex>
    </Box>
  );
}