import { Box, Button, Container, Flex, Grid, Heading, HStack, Link as ChakraLink, Stack, Text } from '@chakra-ui/react';
import { Link, Outlet, useLocation, useOutletContext } from 'react-router-dom';
import { ApiError } from '../../ApplicationApiClient';
import { t } from '../../i18n';
import { formatTime, outcomeLabel, StatusBadge } from './ActivityTimelinePresentation';
import { useTraceList } from './useActivityTimeline';

function activityErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 429 && error.retryAfterSeconds !== null) {
      return t('activity.tooManyViews', { seconds: error.retryAfterSeconds });
    }
    return error.message;
  }
  return t('activity.couldNotLoad');
}

export function ActivityEmptyState() {
  const { hasTraces } = useOutletContext<{ hasTraces: boolean }>() ?? { hasTraces: false };
  return (
    <Box
      as="section"
      aria-label={hasTraces ? t('activity.selectTraceAria') : t('activity.noTracesAria')}
      p={{ base: '8', md: '12' }}
      borderWidth="1px"
      borderColor="governance.line"
      borderRadius="xl"
      bg="white"
      textAlign="center"
    >
      <Text mb="2" color="governance.primary" fontSize="xs" fontWeight="bold" textTransform="uppercase">
        {t('activity.traceDetail')}
      </Text>
      <Heading fontFamily="heading" fontSize="xl">
        {hasTraces ? t('activity.selectTrace') : t('activity.noTracesRecorded')}
      </Heading>
      <Text mt="2" color="governance.muted" fontSize="sm">
        {hasTraces
          ? t('activity.selectTraceDescription')
          : t('activity.noTraceDescription')}
      </Text>
    </Box>
  );
}

export function ActivityLayout() {
  const { pathname } = useLocation();
  const { items, nextCursor, loading, pending, error, refresh, loadMore } = useTraceList();
  const apiError = error instanceof ApiError ? error : null;
  const signInRequired = apiError?.status === 401;
  const notFound = apiError?.status === 404;
  const showError = error !== null && !signInRequired && !notFound;

  return (
    <Container as="main" maxW="1440px" py={{ base: '6', md: '10' }} px={{ base: '4', md: '8' }}>
      <Flex justify="space-between" align="flex-end" gap="6" wrap="wrap" mb="6">
        <Box>
          <Text mb="2" color="governance.primary" fontSize="xs" fontWeight="bold" textTransform="uppercase">
            {t('activity.observabilityEyebrow')}
          </Text>
          <Heading as="h1" fontFamily="heading" fontSize={{ base: '3xl', md: '4xl' }}>{t('activity.title')}</Heading>
          <Text mt="2" maxW="44rem" color="governance.muted">
            {t('activity.description')}
          </Text>
        </Box>
        <Button type="button" variant="outline" onClick={refresh} disabled={loading}>
          {t('common.refresh')}
        </Button>
      </Flex>

      <Grid
        templateColumns={{ base: '1fr', lg: '22rem minmax(0, 1fr)' }}
        gap={{ base: '6', lg: '8' }}
        alignItems="start"
      >
        <Box as="nav" aria-label={t('activity.traceNavigation')} position={{ lg: 'sticky' }} top={{ lg: '6' }}>
          <Box
            p="4"
            borderWidth="1px"
            borderColor="governance.line"
            borderRadius="xl"
            bg="white"
            boxShadow="0 18px 52px rgba(23,43,52,0.06)"
          >
            <Flex justify="space-between" align="center" gap="3" mb="4">
              <Box>
                <Text mb="1" color="governance.primary" fontSize="xs" fontWeight="bold" textTransform="uppercase">
                  {t('activity.recentActivity')}
                </Text>
                <Heading fontFamily="heading" fontSize="lg">{t('activity.traces')}</Heading>
              </Box>
              <Text color="governance.muted" fontSize="xs">{t('activity.shown', { count: items.length })}</Text>
            </Flex>

            {loading ? <Text role="status" color="governance.muted" fontSize="sm">{t('activity.loadingActivity')}</Text> : null}

            {signInRequired ? (
              <Stack gap="3">
                <Text color="governance.muted" fontSize="sm">{t('activity.signInToView')}</Text>
                <ChakraLink asChild fontSize="sm"><Link to="/sign-in">{t('activity.signIn')}</Link></ChakraLink>
              </Stack>
            ) : null}

            {showError ? (
              <Stack gap="3">
                <Text role="alert" color="red.800" fontSize="sm">{activityErrorMessage(error)}</Text>
                <Button size="sm" variant="outline" onClick={refresh}>{t('activity.tryAgain')}</Button>
              </Stack>
            ) : null}

            {!loading && !showError && !signInRequired && items.length === 0 ? (
              <Box role="status" py="8" textAlign="center">
                <Text fontWeight="semibold" fontSize="sm">{t('activity.noTracesRecorded')}</Text>
                <Text mt="1" color="governance.muted" fontSize="xs">{t('activity.reportedActivityWillAppear')}</Text>
              </Box>
            ) : null}

            {!showError && !signInRequired && items.length > 0 ? (
              <Stack as="ul" aria-label={t('activity.tracesAria')} listStyle="none" gap="2" p="0" m="0" maxH={{ lg: 'calc(100vh - 20rem)' }} overflowY={{ lg: 'auto' }}>
                {items.map((trace) => {
                  if ('tombstone' in trace) {
                    return (
                      <Box as="li" key={trace.traceId} p="3" borderWidth="1px" borderStyle="dashed" borderColor="governance.line" borderRadius="lg" color="governance.muted" fontSize="sm">
                        {t('activity.traceUnavailable')}
                      </Box>
                    );
                  }
                  const active = pathname === `/activity/${trace.traceId}`;
                  return (
                    <Box as="li" key={trace.traceId}>
                      <ChakraLink asChild color="inherit" _hover={{ textDecoration: 'none' }}>
                        <Link to={`/activity/${trace.traceId}`} aria-current={active ? 'page' : undefined}>
                          <Box
                            p="3"
                            borderWidth="1px"
                            borderColor={active ? 'governance.primary' : 'governance.line'}
                            borderRadius="lg"
                            bg={active ? 'governance.canvas' : 'white'}
                            transition="border-color 120ms ease, box-shadow 120ms ease"
                            _hover={{ borderColor: 'governance.primary', boxShadow: 'sm' }}
                          >
                            <Flex justify="space-between" align="center" gap="2">
                              <Text fontFamily="mono" fontSize="sm" fontWeight="semibold">
                                {t('activity.traceLabel', { id: trace.traceId.slice(-8) })}
                              </Text>
                              <StatusBadge value={trace.executionStatus} />
                            </Flex>
                            <Text mt="1" color="governance.muted" fontSize="xs">{formatTime(trace.receivedAt)}</Text>
                            <HStack mt="2" gap="2" flexWrap="wrap">
                              <Text color="governance.muted" fontSize="xs">{outcomeLabel(trace.guardOutcome)}</Text>
                            </HStack>
                          </Box>
                        </Link>
                      </ChakraLink>
                    </Box>
                  );
                })}
              </Stack>
            ) : null}

            {nextCursor ? (
              <Button mt="4" size="sm" variant="outline" onClick={loadMore} disabled={pending}>
                {pending ? t('activity.loadingMore') : t('activity.loadMoreTraces')}
              </Button>
            ) : null}
          </Box>
        </Box>

        <Box as="section" minW="0">
          <Outlet context={{ hasTraces: items.length > 0 }} />
        </Box>
      </Grid>
    </Container>
  );
}
