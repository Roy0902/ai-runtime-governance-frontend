import { useMemo, useState } from 'react';
import { Badge, Box, Button, Container, Flex, Grid, Heading, HStack, Stack, Text } from '@chakra-ui/react';
import { buildEventTree, type EventNode } from './ActivityTimelineModel';
import { fixtureEvents, fixtureTraceDetails, fixtureTraces } from './ActivityTimelineFixtures';
import type {
  ActivityEvent,
  GuardOutcome,
  EventTombstone,
  TraceDetail,
  TraceSummary,
} from './ActivityTimelineTypes';

const INITIAL_TRACE_COUNT = 2;
const INITIAL_EVENT_COUNT = 4;

function formatTime(value: string | null): string {
  return value
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'medium',
        timeZone: 'UTC',
      }).format(new Date(value)) + ' UTC'
    : 'Not reported';
}

function statusLabel(value: string | null): string {
  return value ? value.replaceAll('_', ' ') : 'Not reported';
}

function shortId(value: string): string {
  return value.slice(-8);
}

function outcomeLabel(value: GuardOutcome | null): string {
  return value ? value.replaceAll('_', ' ') : 'No guard outcome reported';
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

function StatusBadge({ value, label }: { value: string | null; label?: string }) {
  const normalized = value?.replaceAll('_', '-') ?? 'unknown';
  const palette = normalized === 'completed' || normalized === 'allow' || normalized === 'observed'
    ? 'green'
    : normalized === 'failed' || normalized === 'deny'
      ? 'red'
      : normalized === 'running'
        ? 'blue'
        : normalized === 'require-approval'
          ? 'orange'
          : 'gray';
  return <Badge colorPalette={palette} variant="subtle">{label ?? statusLabel(value)}</Badge>;
}

function TraceRow({
  trace,
  selected,
  onSelect,
}: {
  trace: TraceSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Button
      width="full"
      height="auto"
      p="4"
      borderWidth="1px"
      borderColor={selected ? 'governance.primary' : 'governance.line'}
      borderRadius="lg"
      bg={selected ? 'green.50' : 'white'}
      color="governance.ink"
      variant="plain"
      display="block"
      textAlign="left"
      aria-pressed={selected}
      onClick={onSelect}
    >
      <Flex justify="space-between" gap="2" align="center">
        <Text fontFamily="mono" fontSize="sm">Trace {shortId(trace.traceId)}</Text>
        <StatusBadge value={trace.executionStatus} />
      </Flex>
      <Text mt="2" color="governance.muted" fontSize="xs">{formatTime(trace.receivedAt)}</Text>
      <HStack mt="2" gap="2" flexWrap="wrap">
        <Badge variant="outline">{outcomeLabel(trace.guardOutcome)}</Badge>
        <Badge variant="outline">{statusLabel(trace.telemetryStatus)} telemetry</Badge>
      </HStack>
    </Button>
  );
}

function EventCard({ node }: { node: EventNode }) {
  const { event } = node;
  return (
    <Box as="li" listStyle="none">
      <Stack gap="3">
      <Box as="article" p="4" borderLeftWidth="3px" borderLeftColor="governance.primary" borderTopWidth="1px" borderRightWidth="1px" borderBottomWidth="1px" borderColor="governance.line" borderRadius="lg" bg="white">
        <Flex justify="space-between" gap="3" align="flex-start" wrap="wrap">
          <HStack gap="3" align="flex-start">
            <Badge colorPalette="green" variant="subtle">{event.kind}</Badge>
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
        <Grid mt="3" templateColumns={{ base: '1fr', md: 'repeat(2, minmax(0, 1fr))' }} gap="3" p="3" borderRadius="md" bg="governance.canvas">
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
        </Grid>
        {eventMetadata(event).length ? (
          <Stack as="ul" mt="3" gap="1" listStyle="none" p="0" m="0">
            {eventMetadata(event).map((value) => <Text as="li" key={value} color="governance.muted" fontSize="sm">{value}</Text>)}
          </Stack>
        ) : null}
      </Box>
      {node.children.length ? (
        <Stack as="ol" gap="3" pl="6" ml="4" borderLeftWidth="2px" borderColor="governance.line">
          {node.children.map((child) => <EventCard key={child.event.eventId} node={child} />)}
        </Stack>
      ) : null}
      </Stack>
    </Box>
  );
}

function UnavailableEvent({ event }: { event: EventTombstone }) {
  return (
    <Flex as="li" justify="space-between" gap="3" p="2" borderTopWidth="1px" borderColor="orange.200" fontSize="sm">
      <Text>Event details unavailable</Text>
      <Text as="code" fontFamily="mono">{shortId(event.eventId)}</Text>
    </Flex>
  );
}

function TraceDetails({ trace }: { trace: TraceDetail }) {
  return (
    <Box as="section" aria-label="Trace summary" p="5" borderWidth="1px" borderColor="governance.line" borderRadius="xl" bg="white">
      <Flex justify="space-between" align="flex-start" gap="4" wrap="wrap">
        <Box>
          <Text mb="1" color="governance.primary" fontSize="xs" fontWeight="bold" textTransform="uppercase">Selected trace</Text>
          <Heading fontFamily="heading" fontSize="lg">{trace.identity ?? 'Identity not reported'}</Heading>
          <Text as="code" display="block" mt="2" color="governance.muted" fontSize="xs" overflowWrap="anywhere">Trace {trace.traceId}</Text>
        </Box>
        <StatusBadge value={trace.executionStatus} />
      </Flex>
      <Grid mt="4" templateColumns={{ base: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' }} gap="2">
        {[
          ['Execution', statusLabel(trace.executionStatus)],
          ['Telemetry', statusLabel(trace.telemetryStatus)],
          ['Prompt guard', outcomeLabel(trace.guardOutcome)],
          ['Received (UTC)', formatTime(trace.receivedAt)],
        ].map(([label, value]) => (
          <Box key={label} p="3" borderRadius="md" bg="governance.canvas">
            <Text color="governance.muted" fontSize="xs">{label}</Text>
            <Text mt="1" fontSize="sm" fontWeight="semibold">{value}</Text>
          </Box>
        ))}
      </Grid>
      <HStack mt="3" aria-label="Reported integration coverage" gap="2" flexWrap="wrap">
        {Object.entries(trace.coverage).map(([label, value]) => <Badge key={label} variant="outline">{label}: {statusLabel(value)}</Badge>)}
      </HStack>
      {trace.loss ? (
        <Text role="note" mt="4" p="3" borderRadius="md" bg="orange.50" color="orange.900" fontSize="sm">
          Telemetry loss reported: {trace.loss.causeCode ?? 'cause unknown'}
          {trace.loss.missingCount === null ? '' : ` · ${trace.loss.missingCount} event(s) reported missing`}
          {trace.loss.from ? ` · from ${formatTime(trace.loss.from)}` : ''}
          {trace.loss.to ? ` · to ${formatTime(trace.loss.to)}` : ''}
        </Text>
      ) : null}
    </Box>
  );
}

export function ActivityTimelinePage() {
  const [selectedTraceId, setSelectedTraceId] = useState(fixtureTraces[0].traceId);
  const [visibleTraceCount, setVisibleTraceCount] = useState(INITIAL_TRACE_COUNT);
  const [visibleEventCount, setVisibleEventCount] = useState(INITIAL_EVENT_COUNT);
  const [notice, setNotice] = useState('');
  const selectedTrace = fixtureTraceDetails[selectedTraceId] ?? fixtureTraceDetails[fixtureTraces[0].traceId];
  const traceItems = fixtureEvents[selectedTraceId] ?? [];
  const visibleItems = traceItems.slice(0, visibleEventCount);
  const eventTree = useMemo(() => buildEventTree(visibleItems), [visibleItems]);

  function selectTrace(traceId: string) {
    setSelectedTraceId(traceId);
    setVisibleEventCount(INITIAL_EVENT_COUNT);
  }

  function resetPreview() {
    setSelectedTraceId(fixtureTraces[0].traceId);
    setVisibleTraceCount(INITIAL_TRACE_COUNT);
    setVisibleEventCount(INITIAL_EVENT_COUNT);
    setNotice('Preview reset. No live service request was made.');
  }

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
        <Button variant="outline" type="button" onClick={resetPreview}>
          Reset preview
        </Button>
      </Flex>

      <Flex role="note" align="flex-start" gap="3" mb="5" p="4" borderWidth="1px" borderColor="orange.200" borderRadius="lg" bg="orange.50" color="orange.900">
        <Badge mt="0.5" colorPalette="orange" variant="solid">Preview</Badge>
        <Box>
          <Text fontWeight="bold">Synthetic fixture preview</Text>
          <Text mt="1" fontSize="sm">This data is illustrative only. It is not connected to the service or a real account trace.</Text>
        </Box>
      </Flex>
      {notice ? <Text role="status" mb="4" color="green.800">{notice}</Text> : null}

      <Grid templateColumns={{ base: '1fr', xl: 'minmax(18rem, 22rem) minmax(0, 1fr)' }} gap="5">
        <Box as="aside" aria-label="Trace list" p="4" borderWidth="1px" borderColor="governance.line" borderRadius="xl" bg="white">
          <Flex justify="space-between" align="center" gap="3" mb="4">
            <Box>
              <Text mb="1" color="governance.primary" fontSize="xs" fontWeight="bold" textTransform="uppercase">Recent activity</Text>
              <Heading fontFamily="heading" fontSize="lg">Traces</Heading>
            </Box>
            <Badge variant="subtle">{fixtureTraces.length} fixtures</Badge>
          </Flex>
          <Stack gap="2">
            {fixtureTraces.slice(0, visibleTraceCount).map((trace) => (
              <TraceRow
                key={trace.traceId}
                trace={trace}
                selected={trace.traceId === selectedTraceId}
                onSelect={() => selectTrace(trace.traceId)}
              />
            ))}
          </Stack>
          {visibleTraceCount < fixtureTraces.length ? (
            <Button mt="4" variant="outline" onClick={() => setVisibleTraceCount(fixtureTraces.length)}>
              Load more traces
            </Button>
          ) : null}
        </Box>

        <Stack gap="5" minW="0">
          <TraceDetails trace={selectedTrace} />
          <Box as="section" aria-labelledby="timeline-heading" p={{ base: '4', md: '6' }} borderWidth="1px" borderColor="governance.line" borderRadius="xl" bg="white">
            <Flex justify="space-between" align="flex-end" gap="4" wrap="wrap">
              <Box>
                <Text mb="1" color="governance.primary" fontSize="xs" fontWeight="bold" textTransform="uppercase">Receipt order · sibling events</Text>
                <Heading id="timeline-heading" fontFamily="heading" fontSize="xl">Agent event timeline</Heading>
              </Box>
              <Badge variant="subtle">
                {visibleItems.length} of {traceItems.length} items
              </Badge>
            </Flex>
            <Text mt="3" color="governance.muted" fontSize="sm">
              Events are ordered by server receipt time within each parent group. Producer-reported source time is shown separately.
            </Text>
            {eventTree.roots.length ? (
              <Stack as="ol" gap="4" mt="4" listStyle="none" p="0" m="0">
                {eventTree.roots.map((node) => <EventCard key={node.event.eventId} node={node} />)}
              </Stack>
            ) : null}
            {eventTree.unavailable.length ? (
              <Box as="section" aria-label="Unavailable event details" mt="4" p="4" borderRadius="lg" bg="orange.50" color="orange.900">
                <Heading as="h3" fontFamily="heading" fontSize="md">Unavailable event details</Heading>
                <Text mt="1" fontSize="sm">The event was reported, but its metadata is not available in this page.</Text>
                <Stack as="ul" mt="3" listStyle="none" p="0" m="0">
                  {eventTree.unavailable.map((event) => (
                    <UnavailableEvent key={event.eventId} event={event} />
                  ))}
                </Stack>
              </Box>
            ) : null}
            {!eventTree.roots.length && !eventTree.unavailable.length ? (
              <Text role="status" py="8" color="governance.muted" textAlign="center">No activity is included in this fixture.</Text>
            ) : null}
            {visibleEventCount < traceItems.length ? (
              <Button mt="4" variant="outline" onClick={() => setVisibleEventCount(traceItems.length)}>
                Load more activity
              </Button>
            ) : null}
          </Box>
        </Stack>
      </Grid>
    </Container>
  );
}
