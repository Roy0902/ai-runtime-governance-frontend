import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge, Box, Button, Container, Flex, Grid, Heading, HStack, Link as ChakraLink, Stack, Text } from '@chakra-ui/react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { ApiError } from '../../ApplicationApiClient';
import { useAuthentication } from '../../AuthenticationContext';
import type { ObservationContent } from '../../api/Usage';
import type { EventNode } from './ActivityTimelineModel';
import {
  formatTime,
  outcomeLabel,
  shortId,
  statusLabel,
  StatusBadge,
} from './ActivityTimelinePresentation';
import type { ActivityEvent, ActivityTimelineItem, ModelUsageSummary, TraceDetail } from './ActivityTimelineTypes';
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

function displayValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return value.length ? value.map(displayValue).join(', ') : '[]';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

function layerName(kind: ActivityEvent['kind']): string {
  switch (kind) {
    case 'prompt':
      return 'Prompt';
    case 'guard':
      return 'Guard decision';
    case 'approval':
      return 'Approval';
    case 'model':
      return 'Model call';
    case 'tool':
      return 'Tool call';
    default:
      return 'Agent activity';
  }
}

function promptPreview(event: ActivityEvent): string {
  const text = event.content?.text;
  if (typeof text === 'string' && text.trim().length) {
    return text;
  }
  return eventHeading(event);
}

function EventContent({ event }: { event: ActivityEvent }) {
  const content = event.content;
  if (!content) {
    return null;
  }
  const blocks: Array<[string, string]> = [];
  const push = (label: string, value: unknown) => {
    if (value === null || value === undefined) {
      return;
    }
    const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    if (text && text.trim().length) {
      blocks.push([label, text]);
    }
  };

  if (event.kind === 'prompt') {
    push('Prompt', content.text);
  } else if (event.kind === 'model') {
    push('Model output', content.output);
    push('Reasoning', content.reasoning);
    const calls = Array.isArray(content.toolCalls) ? content.toolCalls : [];
    calls.forEach((call, index) => {
      if (call && typeof call === 'object') {
        const value = call as Record<string, unknown>;
        push(`Tool call ${index + 1} · ${String(value.name ?? 'unknown')}`, value.arguments ?? value);
      }
    });
  } else if (event.kind === 'tool') {
    push('Tool', content.name);
    push('Arguments', content.arguments ?? content);
  }

  if (!blocks.length) {
    push('Content', content);
  }

  return (
    <Stack gap="2" mt="3">
      {blocks.map(([label, text]) => (
        <Box key={label}>
          <Text color="governance.muted" fontSize="xs" fontWeight="bold" textTransform="uppercase">{label}</Text>
          <Box
            as="pre"
            mt="1"
            m="0"
            p="3"
            bg="governance.canvas"
            borderWidth="1px"
            borderColor="governance.line"
            borderRadius="md"
            fontFamily="mono"
            fontSize="xs"
            whiteSpace="pre-wrap"
            wordBreak="break-word"
            maxH="72"
            overflowY="auto"
          >
            {text}
          </Box>
        </Box>
      ))}
    </Stack>
  );
}

function RawJson({ value }: { value: unknown }) {
  return (
    <Box
      as="pre"
      gridColumn={{ md: '1 / -1' }}
      m="0"
      p="3"
      bg="white"
      borderWidth="1px"
      borderColor="governance.line"
      borderRadius="md"
      fontFamily="mono"
      fontSize="xs"
      whiteSpace="pre-wrap"
      wordBreak="break-word"
      maxH="96"
      overflowY="auto"
    >
      {JSON.stringify(value, null, 2)}
    </Box>
  );
}

function tokens(value: number | null): string {
  return value === null ? 'Not reported' : value.toLocaleString();
}

function money(value: number | null, currency: string): string {
  if (value === null) {
    return 'Not priced';
  }
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  }).format(value);
}

function ModelStepUsage({ traceId, usage }: { traceId: string; usage: ModelUsageSummary }) {
  const { send } = useAuthentication();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState<ObservationContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const observationId = usage.langfuseObservationId;

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (!observationId || content || loading) {
      return;
    }
    setLoading(true);
    setError(null);
    send<ObservationContent>(`/api/v1/usage/traces/${traceId}/observations/${observationId}`, 'GET')
      .then((value) => setContent(value))
      .catch(() => setError('The model output could not be loaded from Langfuse.'))
      .finally(() => setLoading(false));
  }

  return (
    <Stack gap="2" gridColumn={{ md: '1 / -1' }}>
      <Text color="governance.muted" fontSize="xs" fontWeight="bold" textTransform="uppercase">Model call</Text>
      <Grid templateColumns={{ base: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' }} gap="3">
        {[
          ['Usage ID', usage.usageId],
          ['Input tokens', tokens(usage.inputTokens)],
          ['Output tokens', tokens(usage.outputTokens)],
          ['Cached input tokens', tokens(usage.cachedInputTokens)],
          ['Reasoning output tokens', tokens(usage.reasoningOutputTokens)],
          ['Total tokens', tokens(usage.totalTokens)],
          ['Cost', money(usage.totalCostUsd, usage.currency)],
          ['Currency', usage.currency || 'null'],
          ['Duration', usage.durationMs === null ? 'null' : `${usage.durationMs} ms`],
          ['Finish reasons', displayValue(usage.finishReasons)],
          ['Tool calls', displayValue(usage.toolCallNames)],
          ['Langfuse observation ID', usage.langfuseObservationId ?? 'null'],
        ].map(([label, value]) => (
          <Box key={label}>
            <Text color="governance.muted" fontSize="xs">{label}</Text>
            <Text mt="1" fontSize="sm" fontWeight="medium" overflowWrap="anywhere">{value}</Text>
          </Box>
        ))}
      </Grid>
      <Text color="governance.muted" fontSize="xs" fontWeight="bold" textTransform="uppercase">Raw usage JSON</Text>
      <RawJson value={usage} />
      {observationId ? (
        <Button size="sm" variant="ghost" alignSelf="flex-start" aria-expanded={open} onClick={toggle}>
          {open ? 'Hide output' : 'View output'}
        </Button>
      ) : (
        <Text fontSize="sm" color="governance.muted">Output was not exported to Langfuse.</Text>
      )}
      {open && loading ? <Text role="status" color="governance.muted">Loading output…</Text> : null}
      {open && error ? <Text role="alert" color="red.700">{error}</Text> : null}
      {open && content ? (
        <Box
          as="pre"
          m="0"
          p="3"
          bg="white"
          borderWidth="1px"
          borderColor="governance.line"
          borderRadius="md"
          fontFamily="mono"
          fontSize="sm"
          whiteSpace="pre-wrap"
          wordBreak="break-word"
          maxH="80"
          overflowY="auto"
        >
          {content.output ?? 'No output was captured.'}
        </Box>
      ) : null}
    </Stack>
  );
}

function SessionLayer({ trace }: { trace: TraceDetail }) {
  return (
    <Box as="section" aria-label="Session" p={{ base: '5', md: '6' }} borderRadius="2xl" bg="governance.ink" color="white">
      <Flex justify="space-between" align="flex-start" gap="4" wrap="wrap">
        <Box>
          <Text color="whiteAlpha.700" fontSize="xs" fontWeight="bold" textTransform="uppercase">
            Layer 1 · Session
          </Text>
          <Heading mt="2" fontFamily="heading" fontSize="2xl">
            {trace.identity ?? 'Identity not reported'}
          </Heading>
          <Text as="code" display="block" mt="2" color="whiteAlpha.700" fontSize="xs" overflowWrap="anywhere">
            {trace.traceId}
          </Text>
        </Box>
        <StatusBadge value={trace.executionStatus} />
      </Flex>
      <Grid mt="5" templateColumns={{ base: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' }} gap="3">
        {[
          ['Execution', statusLabel(trace.executionStatus)],
          ['Telemetry', statusLabel(trace.telemetryStatus)],
          ['Prompt guard', outcomeLabel(trace.guardOutcome)],
          ['Received (UTC)', formatTime(trace.receivedAt)],
        ].map(([label, value]) => (
          <Box key={label} p="3" borderRadius="lg" bg="whiteAlpha.100">
            <Text color="whiteAlpha.700" fontSize="xs">{label}</Text>
            <Text mt="1" fontSize="sm" fontWeight="semibold">{value}</Text>
          </Box>
        ))}
      </Grid>
      <HStack mt="4" gap="2" flexWrap="wrap">
        {Object.entries(trace.coverage).map(([label, value]) => (
          <Badge key={label} variant="subtle" colorPalette={value === 'observed' ? 'green' : 'gray'}>
            {label}: {statusLabel(value)}
          </Badge>
        ))}
      </HStack>
    </Box>
  );
}

function EventCard({
  node,
  expanded,
  onToggle,
  variant = 'agent',
}: {
  node: EventNode;
  expanded: Set<string>;
  onToggle: (eventId: string) => void;
  variant?: 'prompt' | 'agent';
}) {
  const { event } = node;
  const open = expanded.has(event.eventId);
  const isPrompt = variant === 'prompt';
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
        <Box
          as="article"
          position="relative"
          p={isPrompt ? { base: '4', md: '5' } : '3'}
          bg={isPrompt ? 'blue.50' : 'white'}
          borderWidth="1px"
          borderColor={isPrompt ? 'blue.200' : 'governance.line'}
          borderLeftWidth={isPrompt ? '4px' : '3px'}
          borderLeftColor={isPrompt ? 'blue.400' : `${kindColor}.400`}
          borderRadius={isPrompt ? 'xl' : 'md'}
        >
          {isPrompt ? (
            <Box
              position="absolute"
              left={{ base: '-18px', md: '-26px' }}
              top="7"
              w="4"
              h="4"
              borderRadius="full"
              bg="blue.400"
              borderWidth="2px"
              borderColor="white"
            />
          ) : null}
          <Flex justify="space-between" align="flex-start" gap="3" wrap="wrap">
            <HStack align="flex-start" gap="3">
              <Badge colorPalette={kindColor} variant="subtle">{event.kind}</Badge>
              <Badge colorPalette={isPrompt ? 'blue' : 'gray'} variant={isPrompt ? 'solid' : 'outline'}>
                {isPrompt ? 'Layer 2 · Prompt' : `Layer 3 · ${layerName(event.kind)}`}
              </Badge>
              <Box>
                <Heading as="h3" fontFamily="heading" fontSize={isPrompt ? 'lg' : 'sm'}>{isPrompt ? 'Prompt' : eventHeading(event)}</Heading>
                <Text mt="1" color="governance.muted" fontSize="xs">{formatTime(event.receivedAt)}</Text>
                {event.kind === 'model' && event.usage ? (
                  <Text mt="1" color="governance.muted" fontSize="xs">
                    {tokens(event.usage.totalTokens)} tokens · {money(event.usage.totalCostUsd, event.usage.currency)}
                  </Text>
                ) : null}
              </Box>
            </HStack>
            <StatusBadge value={eventState(event)} />
          </Flex>

          {node.unresolved ? <Text mt="3" color="orange.800" fontSize="sm">Unlinked activity.</Text> : null}
          {node.parentNotLoaded ? (
            <Text mt="3" color="orange.800" fontSize="sm">Parent event is not loaded in this page.</Text>
          ) : null}

          <EventContent event={event} />

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
                ['Event ID', event.eventId],
                ['Trace ID', event.traceId],
                ['Parent event ID', event.parentEventId ?? 'null'],
                ['Relationship', event.relationship],
                ['Kind', event.kind],
                ['Received (UTC)', formatTime(event.receivedAt)],
                ['Received (raw)', event.receivedAt],
                ['Source time (UTC)', formatTime(event.sourceAt)],
                ['Source time (raw)', event.sourceAt ?? 'null'],
                ['Duration (ms)', event.durationMs === null ? 'null' : String(event.durationMs)],
                ['Reporter', event.identity ?? 'null'],
              ].map(([label, value]) => (
                <Box key={label}>
                  <Text color="governance.muted" fontSize="xs">{label}</Text>
                  <Text mt="1" fontSize="sm" fontWeight="medium" overflowWrap="anywhere">{value}</Text>
                </Box>
              ))}
              <Text gridColumn={{ md: '1 / -1' }} color="governance.muted" fontSize="xs" fontWeight="bold" textTransform="uppercase">
                All metadata fields
              </Text>
              {Object.entries(event.metadata as unknown as Record<string, unknown>).map(([key, value]) => (
                <Box key={key}>
                  <Text color="governance.muted" fontSize="xs">{key}</Text>
                  <Text mt="1" fontSize="sm" fontWeight="medium" overflowWrap="anywhere">{displayValue(value)}</Text>
                </Box>
              ))}
              {event.kind === 'model' && event.usage ? (
                <ModelStepUsage traceId={event.traceId} usage={event.usage} />
              ) : null}
              {event.kind === 'tool' && !event.content ? (
                <Text gridColumn={{ md: '1 / -1' }} fontSize="sm" color="governance.muted">
                  Tool arguments and results are not reported by the hook contract.
                </Text>
              ) : null}
              <Text gridColumn={{ md: '1 / -1' }} color="governance.muted" fontSize="xs" fontWeight="bold" textTransform="uppercase">
                Raw event JSON
              </Text>
              <RawJson value={event.raw ?? event} />
            </Grid>
          ) : null}
        </Box>

        {node.children.length ? (
          <Box mt="3">
            <Stack
              as="ol"
              gap="2"
              pl={{ base: '4', md: '6' }}
              ml={{ base: '1', md: '2' }}
              borderLeftWidth="2px"
              borderColor={isPrompt ? 'blue.200' : 'governance.line'}
            >
              {node.children.map((child) => (
                <EventCard
                  key={child.event.eventId}
                  node={child}
                  expanded={expanded}
                  onToggle={onToggle}
                  variant="agent"
                />
              ))}
            </Stack>
          </Box>
        ) : null}
      </Stack>
    </Box>
  );
}

function TraceRawPanel({ trace, events }: { trace: TraceDetail; events: ActivityTimelineItem[] }) {
  return (
    <Box as="section" aria-labelledby="raw-timeline-heading" mt="5" p={{ base: '4', md: '6' }} borderWidth="1px" borderColor="governance.line" borderRadius="xl" bg="white">
      <Text mb="1" color="governance.primary" fontSize="xs" fontWeight="bold" textTransform="uppercase">Raw payload</Text>
      <Heading id="raw-timeline-heading" fontFamily="heading" fontSize="xl" mb="2">Everything returned by the timeline API</Heading>
      <Text mb="4" color="governance.muted" fontSize="sm">
        Trace detail plus all loaded events, before display-level filtering. Use this to decide what to keep.
      </Text>
      <RawJson value={{ trace, events }} />
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
    live,
    toggle,
    refresh,
    loadMore,
  } = useTraceDetail(traceId);
  const failure = error ? failureCopy(error) : null;
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const promptRoots = tree.roots.filter((node) => node.event.kind === 'prompt');
  const agentRoots = tree.roots.filter((node) => node.event.kind !== 'prompt');
  const selectedPrompt =
    promptRoots.find((node) => node.event.eventId === selectedPromptId) ?? promptRoots[0] ?? null;
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
          <Badge colorPalette={live ? 'green' : 'gray'} variant="subtle">
            {live ? 'Live' : 'Manual refresh'}
          </Badge>
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

      {trace ? (
        <Box as="section" aria-labelledby="timeline-heading" mt="5" p={{ base: '4', md: '6' }} borderWidth="1px" borderColor="governance.line" borderRadius="xl" bg="white">
          <Flex justify="space-between" align="flex-end" gap="4" wrap="wrap">
            <Box>
              <Text mb="1" color="governance.primary" fontSize="xs" fontWeight="bold" textTransform="uppercase">Session · Prompt · Agent activity</Text>
              <Heading id="timeline-heading" fontFamily="heading" fontSize="xl">Session timeline</Heading>
            </Box>
            <Badge colorPalette="gray" variant="subtle">
              {events.length} event{events.length === 1 ? '' : 's'}
            </Badge>
          </Flex>
          <Text mt="3" color="governance.muted" fontSize="sm">
            Select a prompt to inspect its guard, model and tool activity. The session stays selected
            in the left rail while you move between prompts.
          </Text>
          <Text role="status" minH="5" mt="2" color="governance.muted" fontSize="xs">
            {pending
              ? 'Loading more activity…'
              : lastLoaded !== null
                ? `Loaded ${lastLoaded} more event${lastLoaded === 1 ? '' : 's'}.`
                : ''}
          </Text>

          <SessionLayer trace={trace} />

          <Grid
            mt="5"
            templateColumns={{ base: '1fr', lg: '20rem minmax(0, 1fr)' }}
            gap={{ base: '5', lg: '6' }}
            alignItems="start"
          >
            <Box
              as="aside"
              aria-label="Prompt selection"
              p="4"
              borderWidth="1px"
              borderColor="governance.line"
              borderRadius="lg"
              bg="governance.canvas"
            >
              <Text mb="1" color="governance.primary" fontSize="xs" fontWeight="bold" textTransform="uppercase">
                Prompts
              </Text>
              <Heading fontFamily="heading" fontSize="lg">Select a prompt</Heading>
              <Stack mt="4" gap="2">
                {promptRoots.map((node, index) => {
                  const selected = selectedPrompt?.event.eventId === node.event.eventId;
                  return (
                    <Button
                      key={node.event.eventId}
                      type="button"
                      variant="ghost"
                      onClick={() => setSelectedPromptId(node.event.eventId)}
                      aria-pressed={selected}
                      h="auto"
                      p="3"
                      justifyContent="flex-start"
                      textAlign="left"
                      whiteSpace="normal"
                      borderWidth="1px"
                      borderColor={selected ? 'blue.400' : 'governance.line'}
                      bg={selected ? 'blue.50' : 'white'}
                    >
                      <Box w="full">
                        <Flex justify="space-between" align="center" gap="2">
                          <Text fontSize="sm" fontWeight="bold">Prompt {index + 1}</Text>
                          <Badge colorPalette="gray" variant="subtle">
                            {node.children.length} event{node.children.length === 1 ? '' : 's'}
                          </Badge>
                        </Flex>
                        <Text mt="1" color="governance.muted" fontSize="xs">
                          {formatTime(node.event.receivedAt)}
                        </Text>
                        <Text
                          mt="2"
                          fontSize="sm"
                          overflow="hidden"
                          css={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}
                        >
                          {promptPreview(node.event)}
                        </Text>
                        <HStack mt="2" gap="2" wrap="wrap">
                          <Badge colorPalette="blue" variant="outline">
                            {outcomeLabel(node.event.kind === 'prompt' ? node.event.metadata.guardOutcome : null)}
                          </Badge>
                        </HStack>
                      </Box>
                    </Button>
                  );
                })}
                {!promptRoots.length ? (
                  <Text color="governance.muted" fontSize="sm">
                    No prompts have been recorded for this session.
                  </Text>
                ) : null}
              </Stack>
            </Box>

            <Box>
              {selectedPrompt ? (
                <Box position="relative" pl={{ base: '7', md: '10' }}>
                  <Box
                    position="absolute"
                    left={{ base: '3', md: '5' }}
                    top="2"
                    bottom="2"
                    w="2px"
                    bg="governance.line"
                  />
                  <Stack as="ol" aria-label="Selected prompt activity" gap="5" listStyle="none" p="0" m="0">
                    <EventCard
                      node={selectedPrompt}
                      expanded={expanded}
                      onToggle={toggle}
                      variant="prompt"
                    />
                    {agentRoots.map((node) => (
                      <EventCard
                        key={node.event.eventId}
                        node={node}
                        expanded={expanded}
                        onToggle={toggle}
                        variant="agent"
                      />
                    ))}
                  </Stack>
                </Box>
              ) : null}
            </Box>
          </Grid>

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

      {trace ? <TraceRawPanel trace={trace} events={events} /> : null}
    </Container>
  );
}
