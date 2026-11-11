import { useState } from 'react';
import { Badge, Box, Button, Flex, Grid, Heading, HStack, Link as ChakraLink, Stack, Text } from '@chakra-ui/react';
import { Link, Outlet, useLocation, useOutletContext, useParams } from 'react-router-dom';
import { ApiError } from '../../ApplicationApiClient';
import { t } from '../../i18n';
import { formatTime, outcomeLabel, promptPreview, StatusBadge } from './ActivityTimelinePresentation';
import type { EventNode } from './ActivityTimelineModel';
import { useTraceDetail, useTraceList } from './useActivityTimeline';

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
  const { traceId } = useParams<{ traceId?: string }>();
  const { items, nextCursor, loading, pending, error, refresh, loadMore } = useTraceList();
  const detail = useTraceDetail(traceId);
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const promptRoots = detail.tree.roots.filter((node) => node.event.kind === 'prompt');
  const selectedPrompt =
    promptRoots.find((node) => node.event.eventId === selectedPromptId) ?? promptRoots[0] ?? null;
  const apiError = error instanceof ApiError ? error : null;
  const signInRequired = apiError?.status === 401;
  const notFound = apiError?.status === 404;
  const showError = error !== null && !signInRequired && !notFound;

  return (
    <Flex direction={{ base: 'column', lg: 'row' }} align="stretch" minH={{ lg: 'calc(100vh - 4.75rem)' }}>
      <Box
        as="nav"
        aria-label={t('activity.traceNavigation')}
        w={{ base: '100%', lg: '21rem' }}
        flexShrink="0"
        alignSelf="flex-start"
        minH={{ lg: 'calc(100vh - 4.75rem)' }}
        position={{ lg: 'sticky' }}
        top="0"
        maxH={{ lg: 'calc(100vh - 4.75rem)' }}
        overflowY={{ lg: 'auto' }}
        borderRightWidth={{ lg: '1px' }}
        borderBottomWidth={{ base: '1px', lg: '0' }}
        borderColor="governance.line"
        bg="white"
        px={{ base: '4', lg: '5' }}
        py={{ base: '5', lg: '6' }}
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
          <Stack as="ul" aria-label={t('activity.tracesAria')} listStyle="none" gap="2" p="0" m="0">
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
                        borderLeftWidth={active ? '3px' : '1px'}
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

      <Box flex="1" minW="0" px={{ base: '4', md: '8' }} py={{ base: '6', md: '10' }}>
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
          templateColumns={{ base: '1fr', lg: traceId ? '19rem minmax(0, 1fr)' : '1fr' }}
          gap={{ base: '6', lg: '8' }}
          alignItems="start"
        >
          {traceId ? (
            <Box as="aside" aria-label="Prompt selection" position={{ lg: 'sticky' }} top={{ lg: '6' }}>
              <Box
                p="4"
                borderWidth="1px"
                borderColor="governance.line"
                borderRadius="xl"
                bg="white"
              >
                <Flex justify="space-between" align="center" gap="3" mb="4">
                  <Box>
                    <Text mb="1" color="governance.primary" fontSize="xs" fontWeight="bold" textTransform="uppercase">
                      Prompts
                    </Text>
                    <Heading fontFamily="heading" fontSize="lg">Select a prompt</Heading>
                  </Box>
                  <Text color="governance.muted" fontSize="xs">{promptRoots.length}</Text>
                </Flex>

                {detail.loading && !detail.trace ? (
                  <Text role="status" color="governance.muted" fontSize="sm">Loading prompts…</Text>
                ) : null}

                <Stack as="ul" aria-label="Prompts" listStyle="none" gap="2" p="0" m="0">
                  {promptRoots.map((node: EventNode, index: number) => {
                    const selected = selectedPrompt?.event.eventId === node.event.eventId;
                    return (
                      <Box as="li" key={node.event.eventId}>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setSelectedPromptId(node.event.eventId)}
                          aria-pressed={selected}
                          h="auto"
                          w="full"
                          p="3"
                          justifyContent="flex-start"
                          textAlign="left"
                          whiteSpace="normal"
                          borderWidth="1px"
                          borderColor={selected ? 'blue.400' : 'governance.line'}
                          bg={selected ? 'blue.50' : 'white'}
                          _hover={{ borderColor: 'governance.primary' }}
                        >
                          <Box w="full">
                            <Flex justify="space-between" align="center" gap="2">
                              <Text fontSize="sm" fontWeight="bold">Prompt {index + 1}</Text>
                              <Badge colorPalette="gray" variant="subtle">
                                {node.children.length} event{node.children.length === 1 ? '' : 's'}
                              </Badge>
                            </Flex>
                            <Text mt="1" color="governance.muted" fontSize="xs">{formatTime(node.event.receivedAt)}</Text>
                            <Text
                              mt="2"
                              fontSize="sm"
                              overflow="hidden"
                              css={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}
                            >
                              {promptPreview(node.event)}
                            </Text>
                            <HStack mt="2" gap="2" flexWrap="wrap">
                              <Badge colorPalette="blue" variant="outline">
                                {outcomeLabel(node.event.kind === 'prompt' ? node.event.metadata.guardOutcome : null)}
                              </Badge>
                            </HStack>
                          </Box>
                        </Button>
                      </Box>
                    );
                  })}
                </Stack>

                {!detail.loading && traceId && promptRoots.length === 0 ? (
                  <Box role="status" py="6" textAlign="center">
                    <Text fontWeight="semibold" fontSize="sm">No prompts recorded</Text>
                    <Text mt="1" color="governance.muted" fontSize="xs">Prompt activity will appear here.</Text>
                  </Box>
                ) : null}
              </Box>
            </Box>
          ) : null}

          <Box as="section" minW="0">
            <Outlet context={{ hasTraces: items.length > 0, detail, selectedPrompt, setSelectedPromptId }} />
          </Box>
        </Grid>
      </Box>
    </Flex>
  );
}
