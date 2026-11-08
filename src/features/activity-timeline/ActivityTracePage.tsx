import { Link, useParams } from 'react-router-dom';
import { Badge, Box, Button, Flex, Grid, Heading, HStack, Link as ChakraLink, Stack, Text } from '@chakra-ui/react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { ApiError } from '../../ApplicationApiClient';
import { t } from '../../i18n';
import type { EventNode } from './ActivityTimelineModel';
import {
  formatTime,
  outcomeLabel,
  shortId,
  statusLabel,
  StatusBadge,
  TraceSummaryPanel,
} from './ActivityTimelinePresentation';
import type { ActivityEvent } from './ActivityTimelineTypes';
import { TraceUsagePanel } from './TraceUsagePanel';
import { useTraceDetail } from './useActivityTimeline';

function failureCopy(error: unknown): { message: string; signIn: boolean } {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return { message: t('activity.signInToView'), signIn: true };
    }
    if (error.status === 404) {
      return { message: t('activity.traceUnavailable'), signIn: false };
    }
    if (error.status === 429 && error.retryAfterSeconds !== null) {
      return {
        message: t('activity.tooManyViews', { seconds: error.retryAfterSeconds }),
        signIn: false,
      };
    }
    return { message: error.message, signIn: false };
  }
  return { message: t('activity.couldNotLoad'), signIn: false };
}

function eventHeading(event: ActivityEvent): string {
  switch (event.kind) {
    case 'prompt':
      return t('activity.promptMetadata');
    case 'guard':
      return t('activity.guardDecision');
    case 'approval':
      return t('activity.approvalState', { state: event.metadata.state ?? t('activity.stateNotReported') });
    default:
      return event.metadata.name ?? t('activity.kindActivity', { kind: event.kind });
  }
}

function eventState(event: ActivityEvent): string {
  switch (event.kind) {
    case 'prompt':
      return outcomeLabel(event.metadata.guardOutcome);
    case 'guard':
      return outcomeLabel(event.metadata.outcome);
    case 'approval':
      return event.metadata.state ?? t('common.notReported');
    default:
      return statusLabel(event.metadata.status);
  }
}

function eventMetadata(event: ActivityEvent): string[] {
  switch (event.kind) {
    case 'prompt':
      return event.metadata.ruleIds.length
        ? [t('activity.rules', { values: event.metadata.ruleIds.join(', ') })]
        : [];
    case 'guard':
      return [
        ...(event.metadata.policyId ? [t('activity.policy', { value: event.metadata.policyId })] : []),
        ...(event.metadata.policyVersion ? [t('activity.version', { value: event.metadata.policyVersion })] : []),
        ...(event.metadata.ruleIds.length ? [t('activity.rules', { values: event.metadata.ruleIds.join(', ') })] : []),
      ];
    case 'approval':
      return event.metadata.approvalId ? [t('activity.approvalId', { value: shortId(event.metadata.approvalId) })] : [];
    default:
      return event.metadata.name ? [t('activity.reportedName', { value: event.metadata.name })] : [];
  }
}

function EventCard({
  node,
  expanded,
  onToggle,
}: {
  node: EventNode;
  expanded: Set<string>;
  onToggle: (eventId: string) => void;
}) {
  const { event } = node;
  const open = expanded.has(event.eventId);
  const kindPalette: Record<string, 'green' | 'orange' | 'red' | 'blue' | 'purple' | 'gray'> = {
    prompt: 'blue',
    guard: 'green',
    approval: 'orange',
    agent: 'purple',
    model: 'gray',
    tool: 'orange',
  };
  const kindColor = kindPalette[event.kind] ?? 'gray';

  return (
    <Box as="li" listStyle="none">
      <Stack gap="3">
        <Box as="article" p={{ base: '3', md: '4' }} borderLeftWidth="3px" borderColor={`${kindColor}.400`} borderTopWidth="1px" borderRightWidth="1px" borderBottomWidth="1px" borderTopColor="governance.line" borderRightColor="governance.line" borderBottomColor="governance.line" borderRadius="lg" bg="white">
          <Flex justify="space-between" align="flex-start" gap="3" wrap="wrap">
            <HStack align="flex-start" gap="3">
              <Badge colorPalette={kindColor} variant="subtle">{event.kind}</Badge>
              <Box>
                <Heading as="h3" fontFamily="heading" fontSize="md">{eventHeading(event)}</Heading>
                <Text mt="1" color="governance.muted" fontSize="xs">{formatTime(event.receivedAt)}</Text>
              </Box>
            </HStack>
            <StatusBadge value={eventState(event)} />
          </Flex>

          {node.unresolved ? <Text mt="3" color="orange.800" fontSize="sm">{t('activity.unlinkedActivity')}</Text> : null}
          {node.parentNotLoaded ? (
            <Text mt="3" color="orange.800" fontSize="sm">{t('activity.parentNotLoaded')}</Text>
          ) : null}

          <Button
            mt="3"
            size="sm"
            variant="ghost"
            aria-expanded={open}
            aria-controls={`event-details-${event.eventId}`}
            onClick={() => onToggle(event.eventId)}
          >
            {open ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
            {open ? t('activity.hideDetails') : t('activity.eventDetails')}
          </Button>

          {open ? (
            <Grid id={`event-details-${event.eventId}`} mt="3" templateColumns={{ base: '1fr', md: 'repeat(2, minmax(0, 1fr))' }} gap="3" p="3" borderRadius="md" bg="governance.canvas">
              {[
                [t('activity.receivedUtc'), formatTime(event.receivedAt)],
                [t('activity.sourceTimeUtc'), formatTime(event.sourceAt)],
                [t('activity.duration'), event.durationMs === null ? t('common.notReported') : t('activity.durationValue', { value: event.durationMs })],
                ...(event.identity ? [[t('activity.reporter'), event.identity]] : []),
              ].map(([label, value]) => (
                <Box key={label}>
                  <Text color="governance.muted" fontSize="xs">{label}</Text>
                  <Text mt="1" fontSize="sm" fontWeight="medium">{value}</Text>
                </Box>
              ))}
              {eventMetadata(event).map((value) => (
                <Text key={value} gridColumn={{ md: '1 / -1' }} fontSize="sm">{value}</Text>
              ))}
            </Grid>
          ) : null}
        </Box>

        {node.children.length ? (
          <Stack as="ol" gap="3" pl={{ base: '4', md: '7' }} ml={{ base: '2', md: '4' }} borderLeftWidth="2px" borderColor="governance.line">
            {node.children.map((child) => (
              <EventCard key={child.event.eventId} node={child} expanded={expanded} onToggle={onToggle} />
            ))}
          </Stack>
        ) : null}
      </Stack>
    </Box>
  );
}

export function ActivityTracePage() {
  const { traceId } = useParams<{ traceId: string }>();
  const {
    trace,
    events,
    tree,
    nextCursor,
    loading,
    pending,
    lastLoaded,
    error,
    expanded,
    toggle,
    refresh,
    loadMore,
  } = useTraceDetail(traceId);
  const apiError = error instanceof ApiError ? error : null;
  const signInRequired = apiError?.status === 401;
  const notFound = apiError?.status === 404;
  const failure = error && !signInRequired && !notFound ? failureCopy(error) : null;
  const showNoTrace = !loading && !trace && !failure && !signInRequired;
  const approvals = events.filter(
    (event): event is Extract<ActivityEvent, { kind: 'approval' }> =>
      !('tombstone' in event) && event.kind === 'approval',
  );

  return (
    <Box>
      <Flex justify="flex-end" mb="4">
        <Button size="sm" variant="outline" onClick={refresh} disabled={loading}>
          {t('activity.refreshTrace')}
        </Button>
      </Flex>

      {loading && !trace ? <Text role="status" color="governance.muted">{t('activity.loadingActivity')}</Text> : null}

      {notFound || showNoTrace ? (
        <Box
          as="section"
          aria-label={t('activity.noTraceAria')}
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
          <Heading fontFamily="heading" fontSize="xl">{t('activity.noTraceFound')}</Heading>
          <Text mt="2" color="governance.muted" fontSize="sm">
            {t('activity.traceNotFoundDescription')}
          </Text>
          <Button asChild mt="5" size="sm" variant="outline"><Link to="/activity">{t('activity.backToActivity')}</Link></Button>
        </Box>
      ) : null}

      {signInRequired ? (
        <Box
          as="section"
          p={{ base: '8', md: '12' }}
          borderWidth="1px"
          borderColor="governance.line"
          borderRadius="xl"
          bg="white"
          textAlign="center"
        >
          <Heading fontFamily="heading" fontSize="xl">{t('activity.signInTitle')}</Heading>
          <Text mt="2" color="governance.muted" fontSize="sm">
            {t('activity.sessionNotAvailable')}
          </Text>
          <Button asChild mt="5" size="sm" variant="outline"><Link to="/sign-in">{t('activity.signIn')}</Link></Button>
        </Box>
      ) : null}

      {failure ? (
        <Flex role="alert" align="center" justify="space-between" gap="4" p="3" borderRadius="md" bg="red.50" color="red.800">
          {failure.message}{' '}
          {failure.signIn ? (
            <ChakraLink asChild><Link to="/sign-in">{t('activity.signIn')}</Link></ChakraLink>
          ) : (
            <Button size="sm" variant="outline" onClick={refresh}>{t('activity.tryAgain')}</Button>
          )}
        </Flex>
      ) : null}

      {failure && trace ? (
        <Text role="note" mt="4" p="3" borderRadius="md" bg="orange.50" color="orange.900" fontSize="sm">
          {t('activity.showingLastLoaded')}
        </Text>
      ) : null}

      {trace ? <TraceSummaryPanel trace={trace} /> : null}

      {trace && traceId ? <TraceUsagePanel traceId={traceId} /> : null}

      {trace && approvals.length ? (
        <Box as="section" aria-labelledby="approval-heading" mt="5" p={{ base: '4', md: '6' }} borderWidth="1px" borderColor="governance.line" borderRadius="xl" bg="white">
          <Text mb="1" color="governance.primary" fontSize="xs" fontWeight="bold" textTransform="uppercase">{t('activity.reportedResolutions')}</Text>
          <Heading id="approval-heading" fontFamily="heading" fontSize="xl" mb="4">{t('activity.approvalHistory')}</Heading>
          <Stack as="ul" listStyle="none" gap="2" p="0" m="0">
            {approvals.map((approval) => (
              <Flex as="li" key={approval.eventId} align="center" justify="space-between" gap="3" flexWrap="wrap" p="3" borderRadius="md" bg="governance.canvas">
                <Text fontFamily="mono" fontSize="sm">{t('activity.approvalLabel', { id: shortId(approval.eventId) })}</Text>
                <Badge colorPalette="orange" variant="subtle">{approval.metadata.state ?? t('common.notReported')}</Badge>
                <Text color="governance.muted" fontSize="sm">
                  {approval.metadata.approvalId
                    ? t('activity.idLabel', { id: shortId(approval.metadata.approvalId) })
                    : t('activity.idNotReported')}
                </Text>
              </Flex>
            ))}
          </Stack>
        </Box>
      ) : null}

      {trace ? (
        <Box as="section" aria-labelledby="timeline-heading" mt="5" p={{ base: '4', md: '6' }} borderWidth="1px" borderColor="governance.line" borderRadius="xl" bg="white">
          <Flex justify="space-between" align="flex-end" gap="4" wrap="wrap">
            <Box>
              <Text mb="1" color="governance.primary" fontSize="xs" fontWeight="bold" textTransform="uppercase">{t('activity.receiptOrder')}</Text>
              <Heading id="timeline-heading" fontFamily="heading" fontSize="xl">{t('activity.agentEventTimeline')}</Heading>
            </Box>
            <Badge colorPalette="gray" variant="subtle">
              {events.length === 1 ? t('activity.eventCountOne', { count: events.length }) : t('activity.eventCountOther', { count: events.length })}
            </Badge>
          </Flex>
          <Text mt="3" color="governance.muted" fontSize="sm">
            {t('activity.timelineDescription')}
          </Text>
          <Text role="status" minH="5" mt="2" color="governance.muted" fontSize="xs">
            {pending
              ? t('activity.loadingMoreActivity')
              : lastLoaded !== null
                ? lastLoaded === 1
                  ? t('activity.loadedMoreOne', { count: lastLoaded })
                  : t('activity.loadedMoreOther', { count: lastLoaded })
                : ''}
          </Text>

          {tree.roots.length ? (
            <Stack as="ol" aria-label={t('activity.activityEventsAria')} gap="4" listStyle="none" mt="4" p="0" m="0">
              {tree.roots.map((node) => (
                <EventCard
                  key={node.event.eventId}
                  node={node}
                  expanded={expanded}
                  onToggle={toggle}
                />
              ))}
            </Stack>
          ) : (
            <Box role="status" py="10" textAlign="center">
              <Heading fontFamily="heading" fontSize="md">{t('activity.noActivityReported')}</Heading>
              <Text mt="1" color="governance.muted" fontSize="sm">{t('activity.noEventsAvailable')}</Text>
            </Box>
          )}

          {tree.unavailable.length ? (
            <Box as="section" aria-label={t('activity.unavailableDetailsAria')} mt="5" p="4" borderRadius="lg" bg="orange.50" color="orange.900">
              <Heading as="h3" fontFamily="heading" fontSize="md">{t('activity.unavailableDetails')}</Heading>
              <Text mt="1" fontSize="sm">{t('activity.unavailableDetailsDescription')}</Text>
              <Stack as="ul" gap="2" mt="3" listStyle="none" p="0" m="0">
                {tree.unavailable.map((item) => (
                  <Flex as="li" key={item.eventId} justify="space-between" gap="3" p="2" borderTopWidth="1px" borderColor="orange.200" fontSize="sm">
                    <Text>{t('activity.eventDetailsUnavailable')}</Text>
                    <Text as="code" fontFamily="mono">{shortId(item.eventId)}</Text>
                  </Flex>
                ))}
              </Stack>
            </Box>
          ) : null}

          {events.length > 0 ? (
            <Button mt="5" variant="outline" onClick={loadMore} disabled={pending || !nextCursor}>
              {pending
                ? t('activity.loadingMoreActivity')
                : nextCursor ? t('activity.loadMoreEvents') : t('activity.allEventsLoaded')}
            </Button>
          ) : null}
        </Box>
      ) : null}
    </Box>
  );
}
