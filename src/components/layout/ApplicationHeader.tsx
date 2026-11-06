import { Box, Button, Drawer, Flex, HStack, IconButton, Link, Portal, Stack, Text } from '@chakra-ui/react';
import { Activity, CircleUserRound, LogIn, LogOut, Menu, UserRound, X } from 'lucide-react';
import { Link as RouterLink, useLocation } from 'react-router-dom';

type HeaderVariant = 'authenticated' | 'public' | 'error';

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
        ...(variant === 'error' ? [{ label: 'Sign in', to: '/sign-in', icon: LogIn }] : []),
      ]
    : [
        { label: 'Sign in', to: '/sign-in', icon: LogIn },
        { label: 'Create account', to: '/register', icon: CircleUserRound },
      ];

  return (
    <Drawer.Root key={pathname} placement="start" lazyMount unmountOnExit>
      <Box as="header" borderBottomWidth="1px" borderColor="governance.line" bg="white/92" backdropFilter="blur(14px)">
        <Flex
          w="full"
          maxW="1440px"
          minH={{ base: 'auto', md: '76px' }}
          mx="auto"
          px={{ base: '4', md: '8' }}
          py={{ base: '3', md: '0' }}
          align="center"
          gap="3"
        >
          <Drawer.Trigger asChild>
            <IconButton aria-label="Open sidebar" size="sm" variant="ghost" colorPalette="green" flexShrink="0">
              <Menu size={20} aria-hidden="true" />
            </IconButton>
          </Drawer.Trigger>
          <Link asChild color="governance.ink" _hover={{ textDecoration: 'none' }}>
            <RouterLink to="/">
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
        </Flex>
      </Box>
      <Portal>
        <Drawer.Backdrop bg="blackAlpha.600" />
        <Drawer.Positioner>
          <Drawer.Content maxW="min(20rem, 100vw)" bg="governance.surface" color="governance.ink">
            <Drawer.Header borderBottomWidth="1px" borderColor="governance.line" pr="14">
              <Drawer.Title fontFamily="heading" fontSize="lg">Navigation</Drawer.Title>
              <Drawer.CloseTrigger asChild>
                <IconButton position="absolute" top="3" right="3" aria-label="Close sidebar" size="sm" variant="ghost">
                  <X size={20} aria-hidden="true" />
                </IconButton>
              </Drawer.CloseTrigger>
            </Drawer.Header>
            <Drawer.Body py="5">
              <Drawer.Context>
                {(drawer) => (
                  <Stack as="nav" aria-label="Main navigation" gap="2">
                    {links.map(({ label, to, icon: Icon }) => {
                      const active = pathname === to || (to !== '/' && pathname.startsWith(`${to}/`));
                      return (
                        <Button
                          key={to}
                          asChild
                          size="sm"
                          variant={active ? 'subtle' : 'ghost'}
                          colorPalette="green"
                          justifyContent="flex-start"
                        >
                          <RouterLink to={to} aria-current={active ? 'page' : undefined} onClick={() => drawer.setOpen(false)}>
                            <Icon size={16} aria-hidden="true" />
                            {label}
                          </RouterLink>
                        </Button>
                      );
                    })}
                  </Stack>
                )}
              </Drawer.Context>
            </Drawer.Body>
            {variant === 'authenticated' ? (
              <Drawer.Footer borderTopWidth="1px" borderColor="governance.line">
                <Stack w="full" gap="3">
                  {email ? (
                    <Text overflow="hidden" color="governance.muted" fontSize="sm" textOverflow="ellipsis" whiteSpace="nowrap" title={email}>
                      {email}
                    </Text>
                  ) : null}
                  <Button size="sm" variant="outline" onClick={onSignOut} disabled={pending}>
                    <LogOut size={16} aria-hidden="true" />
                    {pending ? 'Signing out…' : 'Sign out'}
                  </Button>
                </Stack>
              </Drawer.Footer>
            ) : null}
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  );
}