import { Link, useParams } from 'react-router-dom';
import { Badge, Box, Button, Container, Flex, Grid, Heading, HStack, Link as ChakraLink, Stack, Text } from '@chakra-ui/react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { ApiError } from '../../ApplicationApiClient';
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
      return { message: 'Sign in to view activity.', signIn: true };
    }
    if (error.status === 404) {
      return { message: 'Trace is unavailable.', signIn: false };
    }
  }
  return { message: 'Activity could not be loaded.', signIn: false };
}

function eventHeading(event: ActivityEvent): string {
  switch (event.kind) {
    case 'prompt':
      return 'Prompt metadata';
    case 'guard':
      return 'Guard decision';
    case 'approval':
      return `Approval ${event.metadata.state ?? 'state not reported'}`;
    default:
      return event.metadata.name ?? `${event.kind} activity`;
  }
}

function eventState(event: ActivityEvent): string {
  switch (event.kind) {
    case 'prompt':
      return outcomeLabel(event.metadata.guardOutcome);
    case 'guard':
      return outcomeLabel(event.metadata.outcome);
    case 'approval':
      return event.metadata.state ?? 'Not reported';
    default:
      return statusLabel(event.metadata.status);
  }
}

function eventMetadata(event: ActivityEvent): string[] {
  switch (event.kind) {
    case 'prompt':
      return event.metadata.ruleIds.length
        ? [`Rules: ${event.metadata.ruleIds.join(', ')}`]
        : [];
    case 'guard':
      return [
        ...(event.metadata.policyId ? [`Policy: ${event.metadata.policyId}`] : []),
        ...(event.metadata.policyVersion ? [`Version: ${event.metadata.policyVersion}`] : []),
        ...(event.metadata.ruleIds.length ? [`Rules: ${event.metadata.ruleIds.join(', ')}`] : []),
      ];
    case 'approval':
      return event.metadata.approvalId ? [`Approval ID: ${shortId(event.metadata.approvalId)}`] : [];
    default:
      return event.metadata.name ? [`Reported name: ${event.metadata.name}`] : [];
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

          {node.unresolved ? <Text mt="3" color="orange.800" fontSize="sm">Unlinked activity.</Text> : null}
          {node.parentNotLoaded ? (
            <Text mt="3" color="orange.800" fontSize="sm">Parent event is not loaded in this page.</Text>
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
            {open ? 'Hide details' : 'Event details'}
          </Button>

          {open ? (
            <Grid id={`event-details-${event.eventId}`} mt="3" templateColumns={{ base: '1fr', md: 'repeat(2, minmax(0, 1fr))' }} gap="3" p="3" borderRadius="md" bg="governance.canvas">
              {[
                ['Received (UTC)', formatTime(event.receivedAt)],
                ['Source time (UTC)', formatTime(event.sourceAt)],
                ['Duration', event.durationMs === null ? 'Not reported' : `${event.durationMs} ms`],
                ...(event.identity ? [['Reporter', event.identity]] : []),
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
  const failure = error ? failureCopy(error) : null;
  const approvals = events.filter(
    (event): event is Extract<ActivityEvent, { kind: 'approval' }> =>
      !('tombstone' in event) && event.kind === 'approval',
  );

  return (
    <Container as="main" maxW="1440px" py={{ base: '6', md: '10' }} px={{ base: '4', md: '8' }}>
      <Flex justify="space-between" align="flex-end" gap="6" wrap="wrap" mb="6">
        <div>
          <Text mb="2" color="governance.primary" fontSize="xs" fontWeight="bold" textTransform="uppercase">Observability</Text>
          <Heading fontFamily="heading" fontSize={{ base: '3xl', md: '4xl' }}>Activity</Heading>
          <Text mt="2" maxW="44rem" color="governance.muted">
            Inspect reported agent, model, tool, guard, and approval activity without exposing payloads.
          </Text>
        </div>
        <HStack gap="2">
          <Button asChild size="sm" variant="outline"><Link to="/activity">Back to traces</Link></Button>
          <Button size="sm" variant="outline" onClick={refresh} disabled={loading}>
            Refresh
          </Button>
        </HStack>
      </Flex>

      {loading && !trace ? <Text role="status" color="governance.muted">Loading activity…</Text> : null}

      {failure ? (
        <Flex role="alert" align="center" justify="space-between" gap="4" p="3" borderRadius="md" bg="red.50" color="red.800">
          {failure.message}{' '}
          {failure.signIn ? (
            <ChakraLink asChild><Link to="/sign-in">Sign in</Link></ChakraLink>
          ) : (
            <Button size="sm" variant="outline" onClick={refresh}>Try again</Button>
          )}
        </Flex>
      ) : null}

      {failure && trace ? (
        <Text role="note" mt="4" p="3" borderRadius="md" bg="orange.50" color="orange.900" fontSize="sm">
          Showing the last loaded activity; refresh failed.
        </Text>
      ) : null}

      {trace ? <TraceSummaryPanel trace={trace} /> : null}

      {trace && traceId ? <TraceUsagePanel traceId={traceId} /> : null}

      {trace && approvals.length ? (
        <Box as="section" aria-labelledby="approval-heading" mt="5" p={{ base: '4', md: '6' }} borderWidth="1px" borderColor="governance.line" borderRadius="xl" bg="white">
          <Text mb="1" color="governance.primary" fontSize="xs" fontWeight="bold" textTransform="uppercase">Reported resolutions</Text>
          <Heading id="approval-heading" fontFamily="heading" fontSize="xl" mb="4">Approval history</Heading>
          <Stack as="ul" listStyle="none" gap="2" p="0" m="0">
            {approvals.map((approval) => (
              <Flex as="li" key={approval.eventId} align="center" justify="space-between" gap="3" flexWrap="wrap" p="3" borderRadius="md" bg="governance.canvas">
                <Text fontFamily="mono" fontSize="sm">Approval {shortId(approval.eventId)}</Text>
                <Badge colorPalette="orange" variant="subtle">{approval.metadata.state ?? 'Not reported'}</Badge>
                <Text color="governance.muted" fontSize="sm">
                  {approval.metadata.approvalId
                    ? `ID ${shortId(approval.metadata.approvalId)}`
                    : 'ID not reported'}
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
              <Text mb="1" color="governance.primary" fontSize="xs" fontWeight="bold" textTransform="uppercase">Receipt order · sibling events</Text>
              <Heading id="timeline-heading" fontFamily="heading" fontSize="xl">Agent event timeline</Heading>
            </Box>
            <Badge colorPalette="gray" variant="subtle">
              {events.length} event{events.length === 1 ? '' : 's'}
            </Badge>
          </Flex>
          <Text mt="3" color="governance.muted" fontSize="sm">
            Events are ordered by server receipt time within each parent group. Producer-reported
            source time is shown separately.
          </Text>
          <Text role="status" minH="5" mt="2" color="governance.muted" fontSize="xs">
            {pending
              ? 'Loading more activity…'
              : lastLoaded !== null
                ? `Loaded ${lastLoaded} more event${lastLoaded === 1 ? '' : 's'}.`
                : ''}
          </Text>

          {tree.roots.length ? (
            <Stack as="ol" aria-label="Activity events" gap="4" listStyle="none" mt="4" p="0" m="0">
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
              <Heading fontFamily="heading" fontSize="md">No activity reported</Heading>
              <Text mt="1" color="governance.muted" fontSize="sm">No events are available for this trace yet.</Text>
            </Box>
          )}

          {tree.unavailable.length ? (
            <Box as="section" aria-label="Unavailable event details" mt="5" p="4" borderRadius="lg" bg="orange.50" color="orange.900">
              <Heading as="h3" fontFamily="heading" fontSize="md">Unavailable event details</Heading>
              <Text mt="1" fontSize="sm">The event was reported, but its metadata is no longer available.</Text>
              <Stack as="ul" gap="2" mt="3" listStyle="none" p="0" m="0">
                {tree.unavailable.map((item) => (
                  <Flex as="li" key={item.eventId} justify="space-between" gap="3" p="2" borderTopWidth="1px" borderColor="orange.200" fontSize="sm">
                    <Text>Event details unavailable</Text>
                    <Text as="code" fontFamily="mono">{shortId(item.eventId)}</Text>
                  </Flex>
                ))}
              </Stack>
            </Box>
          ) : null}

          {events.length > 0 ? (
            <Button mt="5" variant="outline" onClick={loadMore} disabled={pending || !nextCursor}>
              {pending
                ? 'Loading more activity…'
                : nextCursor ? 'Load more events' : 'All events loaded'}
            </Button>
          ) : null}
        </Box>
      ) : null}
    </Container>
  );
}
