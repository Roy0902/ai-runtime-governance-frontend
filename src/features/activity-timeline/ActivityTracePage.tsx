import { useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { Badge, Box, Button, Flex, Grid, Heading, HStack, Link as ChakraLink, Stack, Text } from '@chakra-ui/react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { ApiError } from '../../ApplicationApiClient';
import { useAuthentication } from '../../AuthenticationContext';
import type { ObservationContent } from '../../api/Usage';
import { t } from '../../i18n';
import type { EventNode } from './ActivityTimelineModel';
import {
  coverageLabel,
  formatTime,
  outcomeLabel,
  shortId,
  statusLabel,
  StatusBadge,
} from './ActivityTimelinePresentation';
import type { ActivityEvent, ActivityTimelineItem, ModelUsageSummary, TraceDetail } from './ActivityTimelineTypes';
import { TraceUsagePanel } from './TraceUsagePanel';
import type { TraceDetailState } from './useActivityTimeline';

function failureCopy(error: unknown): { message: string; signIn: boolean } {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return { message: t('activity.signInToView'), signIn: true };
    }
    if (error.status === 404) {
      return { message: t('activity.traceUnavailable'), signIn: false };
    }
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
      return event.metadata.state
        ? t('activity.approvalState', { state: statusLabel(event.metadata.state) })
        : t('activity.approvalStateMissing');
    default:
      return event.metadata.name ?? t('activity.kindActivity', { kind: statusLabel(event.kind) });
  }
}

function eventState(event: ActivityEvent): string {
  switch (event.kind) {
    case 'prompt':
      return outcomeLabel(event.metadata.guardOutcome);
    case 'guard':
      return outcomeLabel(event.metadata.outcome);
    case 'approval':
      return statusLabel(event.metadata.state);
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
      return t('activity.prompt');
    case 'guard':
      return t('activity.guardDecision');
    case 'approval':
      return t('activity.approval');
    case 'model':
      return t('activity.modelCall');
    case 'tool':
      return t('activity.toolCall');
    default:
      return t('activity.agentActivity');
  }
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
    push(t('activity.prompt'), content.text);
  } else if (event.kind === 'model') {
    push(t('activity.modelOutput'), content.output);
    push(t('activity.reasoning'), content.reasoning);
    const calls = Array.isArray(content.toolCalls) ? content.toolCalls : [];
    calls.forEach((call, index) => {
      if (call && typeof call === 'object') {
        const value = call as Record<string, unknown>;
        push(
          t('activity.toolCallWithName', {
            number: index + 1,
            name: String(value.name ?? t('common.unknown')),
          }),
          value.arguments ?? value,
        );
      }
    });
  } else if (event.kind === 'tool') {
    push(t('activity.tool'), content.name);
    push(t('activity.arguments'), content.arguments ?? content);
  }

  if (!blocks.length) {
    push(t('activity.content'), content);
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
  return value === null ? t('common.notReported') : value.toLocaleString();
}

function money(value: number | null, currency: string): string {
  if (value === null) {
    return t('activity.notPriced');
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
      .catch(() => setError(t('activity.outputLoadFailed')))
      .finally(() => setLoading(false));
  }

  return (
    <Stack gap="2" gridColumn={{ md: '1 / -1' }}>
      <Text color="governance.muted" fontSize="xs" fontWeight="bold" textTransform="uppercase">{t('activity.modelCall')}</Text>
      <Grid templateColumns={{ base: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' }} gap="3">
        {[
          [t('activity.usageId'), usage.usageId],
          [t('activity.inputTokens'), tokens(usage.inputTokens)],
          [t('activity.outputTokens'), tokens(usage.outputTokens)],
          [t('activity.cachedInputTokens'), tokens(usage.cachedInputTokens)],
          [t('activity.reasoningOutputTokens'), tokens(usage.reasoningOutputTokens)],
          [t('activity.totalTokens'), tokens(usage.totalTokens)],
          [t('activity.cost'), money(usage.totalCostUsd, usage.currency)],
          [t('activity.currency'), usage.currency || 'null'],
          [
            t('activity.duration'),
            usage.durationMs === null ? 'null' : t('activity.durationValue', { value: usage.durationMs }),
          ],
          [t('activity.finishReasonsHeader'), displayValue(usage.finishReasons)],
          [t('activity.toolCalls'), displayValue(usage.toolCallNames)],
          [t('activity.langfuseObservationId'), usage.langfuseObservationId ?? 'null'],
        ].map(([label, value]) => (
          <Box key={label}>
            <Text color="governance.muted" fontSize="xs">{label}</Text>
            <Text mt="1" fontSize="sm" fontWeight="medium" overflowWrap="anywhere">{value}</Text>
          </Box>
        ))}
      </Grid>
      <Text color="governance.muted" fontSize="xs" fontWeight="bold" textTransform="uppercase">{t('activity.rawUsageJson')}</Text>
      <RawJson value={usage} />
      {observationId ? (
        <Button size="sm" variant="ghost" alignSelf="flex-start" aria-expanded={open} onClick={toggle}>
          {open ? t('activity.hideOutput') : t('activity.viewOutput')}
        </Button>
      ) : (
        <Text fontSize="sm" color="governance.muted">{t('activity.outputNotExported')}</Text>
      )}
      {open && loading ? <Text role="status" color="governance.muted">{t('activity.loadingOutput')}</Text> : null}
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
          {content.output ?? t('activity.noOutputCaptured')}
        </Box>
      ) : null}
    </Stack>
  );
}

function SessionLayer({ trace }: { trace: TraceDetail }) {
  return (
    <Box as="section" aria-label={t('activity.sessionAria')} p={{ base: '5', md: '6' }} borderRadius="2xl" bg="governance.ink" color="white">
      <Flex justify="space-between" align="flex-start" gap="4" wrap="wrap">
        <Box>
          <Text color="whiteAlpha.700" fontSize="xs" fontWeight="bold" textTransform="uppercase">
            {t('activity.layerOneSession')}
          </Text>
          <Heading mt="2" fontFamily="heading" fontSize="2xl">
            {trace.identity ?? t('activity.identityNotReported')}
          </Heading>
          <Text as="code" display="block" mt="2" color="whiteAlpha.700" fontSize="xs" overflowWrap="anywhere">
            {trace.traceId}
          </Text>
        </Box>
        <StatusBadge value={trace.executionStatus} />
      </Flex>
      <Grid mt="5" templateColumns={{ base: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' }} gap="3">
        {[
          [t('activity.execution'), statusLabel(trace.executionStatus)],
          [t('activity.telemetry'), statusLabel(trace.telemetryStatus)],
          [t('activity.promptGuard'), outcomeLabel(trace.guardOutcome)],
          [t('activity.receivedUtc'), formatTime(trace.receivedAt)],
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
            {coverageLabel(label)}: {statusLabel(value)}
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
              <Badge colorPalette={kindColor} variant="subtle">{statusLabel(event.kind)}</Badge>
              <Badge colorPalette={isPrompt ? 'blue' : 'gray'} variant={isPrompt ? 'solid' : 'outline'}>
                {isPrompt
                  ? t('activity.layerTwoPrompt')
                  : t('activity.layerThree', { layer: layerName(event.kind) })}
              </Badge>
              <Box>
                <Heading as="h3" fontFamily="heading" fontSize={isPrompt ? 'lg' : 'sm'}>
                  {isPrompt ? t('activity.prompt') : eventHeading(event)}
                </Heading>
                <Text mt="1" color="governance.muted" fontSize="xs">{formatTime(event.receivedAt)}</Text>
                {event.kind === 'model' && event.usage ? (
                  <Text mt="1" color="governance.muted" fontSize="xs">
                    {t('activity.tokenCount', { count: tokens(event.usage.totalTokens) })} ·{' '}
                    {money(event.usage.totalCostUsd, event.usage.currency)}
                  </Text>
                ) : null}
              </Box>
            </HStack>
            <StatusBadge value={eventState(event)} />
          </Flex>

          {node.unresolved ? <Text mt="3" color="orange.800" fontSize="sm">{t('activity.unlinkedActivity')}</Text> : null}
          {node.parentNotLoaded ? (
            <Text mt="3" color="orange.800" fontSize="sm">{t('activity.parentNotLoaded')}</Text>
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
            {open ? t('activity.hideDetails') : t('activity.eventDetails')}
          </Button>

          {open ? (
            <Grid id={`event-details-${event.eventId}`} mt="3" templateColumns={{ base: '1fr', md: 'repeat(2, minmax(0, 1fr))' }} gap="3" p="3" borderRadius="md" bg="governance.canvas">
              {[
                [t('activity.eventId'), event.eventId],
                [t('activity.traceId'), event.traceId],
                [t('activity.parentEventId'), event.parentEventId ?? 'null'],
                [t('activity.relationship'), statusLabel(event.relationship)],
                [t('activity.kind'), statusLabel(event.kind)],
                [t('activity.receivedUtc'), formatTime(event.receivedAt)],
                [t('activity.receivedRaw'), event.receivedAt],
                [t('activity.sourceTimeUtc'), formatTime(event.sourceAt)],
                [t('activity.sourceTimeRaw'), event.sourceAt ?? 'null'],
                [t('activity.durationMs'), event.durationMs === null ? 'null' : String(event.durationMs)],
                [t('activity.reporter'), event.identity ?? 'null'],
              ].map(([label, value]) => (
                <Box key={label}>
                  <Text color="governance.muted" fontSize="xs">{label}</Text>
                  <Text mt="1" fontSize="sm" fontWeight="medium" overflowWrap="anywhere">{value}</Text>
                </Box>
              ))}
              <Text gridColumn={{ md: '1 / -1' }} color="governance.muted" fontSize="xs" fontWeight="bold" textTransform="uppercase">
                {t('activity.allMetadataFields')}
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
                  {t('activity.toolContractNote')}
                </Text>
              ) : null}
              <Text gridColumn={{ md: '1 / -1' }} color="governance.muted" fontSize="xs" fontWeight="bold" textTransform="uppercase">
                {t('activity.rawEventJson')}
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
      <Text mb="1" color="governance.primary" fontSize="xs" fontWeight="bold" textTransform="uppercase">{t('activity.rawPayload')}</Text>
      <Heading id="raw-timeline-heading" fontFamily="heading" fontSize="xl" mb="2">{t('activity.rawPayloadTitle')}</Heading>
      <Text mb="4" color="governance.muted" fontSize="sm">
        {t('activity.rawPayloadDescription')}
      </Text>
      <RawJson value={{ trace, events }} />
    </Box>
  );
}

export function ActivityTracePage() {
  const { traceId } = useParams<{ traceId: string }>();
  const { detail, selectedPrompt } = useOutletContext<{
    detail: TraceDetailState;
    selectedPrompt: EventNode | null;
  }>();
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
  } = detail;
  const failure = error ? failureCopy(error) : null;
  const agentRoots = tree.roots.filter((node) => node.event.kind !== 'prompt');
  const approvals = events.filter(
    (event): event is Extract<ActivityEvent, { kind: 'approval' }> =>
      !('tombstone' in event) && event.kind === 'approval',
  );

  return (
    <Box>
      {loading && !trace ? <Text role="status" color="governance.muted">{t('activity.loadingActivity')}</Text> : null}

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

      {trace ? (
        <Box as="section" aria-labelledby="timeline-heading" p={{ base: '4', md: '6' }} borderWidth="1px" borderColor="governance.line" borderRadius="xl" bg="white">
          <Flex justify="space-between" align="flex-end" gap="4" wrap="wrap">
            <Box>
              <Text mb="1" color="governance.primary" fontSize="xs" fontWeight="bold" textTransform="uppercase">{t('activity.sessionPromptAgent')}</Text>
              <Heading id="timeline-heading" fontFamily="heading" fontSize="xl">{t('activity.sessionTimeline')}</Heading>
            </Box>
            <HStack gap="2" align="center">
              <Badge colorPalette={live ? 'green' : 'gray'} variant="subtle">
                {live ? t('activity.live') : t('activity.manualRefresh')}
              </Badge>
              <Badge colorPalette="gray" variant="subtle">
                {t(
                  events.length === 1 ? 'activity.eventCountOne' : 'activity.eventCountOther',
                  { count: events.length },
                )}
              </Badge>
              <Button size="sm" variant="outline" onClick={refresh} disabled={loading}>
                {t('common.refresh')}
              </Button>
            </HStack>
          </Flex>
          <Text mt="3" color="governance.muted" fontSize="sm">
            {t('activity.timelinePromptDescription')}
          </Text>
          <Text role="status" minH="5" mt="2" color="governance.muted" fontSize="xs">
            {pending
              ? t('activity.loadingMoreActivity')
              : lastLoaded !== null
                ? t(
                    lastLoaded === 1 ? 'activity.loadedMoreOne' : 'activity.loadedMoreOther',
                    { count: lastLoaded },
                  )
                : ''}
          </Text>

          <SessionLayer trace={trace} />

          <Box position="relative" mt="5" pl={{ base: '7', md: '10' }}>
            <Box
              position="absolute"
              left={{ base: '3', md: '5' }}
              top="2"
              bottom="2"
              w="2px"
              bg="governance.line"
            />
            {selectedPrompt ? (
              <Stack as="ol" aria-label={t('activity.selectedPromptActivityAria')} gap="5" listStyle="none" p="0" m="0">
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
            ) : (
              <Box role="status" py="8" textAlign="center">
                <Heading fontFamily="heading" fontSize="md">{t('activity.selectPrompt')}</Heading>
                <Text mt="1" color="governance.muted" fontSize="sm">
                  {t('activity.choosePrompt')}
                </Text>
              </Box>
            )}
          </Box>

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

      {trace && traceId ? <TraceUsagePanel traceId={traceId} /> : null}

      {trace && approvals.length ? (
        <Box as="section" aria-labelledby="approval-heading" mt="5" p={{ base: '4', md: '6' }} borderWidth="1px" borderColor="governance.line" borderRadius="xl" bg="white">
          <Text mb="1" color="governance.primary" fontSize="xs" fontWeight="bold" textTransform="uppercase">{t('activity.reportedResolutions')}</Text>
          <Heading id="approval-heading" fontFamily="heading" fontSize="xl" mb="4">{t('activity.approvalHistory')}</Heading>
          <Stack as="ul" listStyle="none" gap="2" p="0" m="0">
            {approvals.map((approval) => (
              <Flex as="li" key={approval.eventId} align="center" justify="space-between" gap="3" flexWrap="wrap" p="3" borderRadius="md" bg="governance.canvas">
                <Text fontFamily="mono" fontSize="sm">
                  {t('activity.approvalLabel', { id: shortId(approval.eventId) })}
                </Text>
                <Badge colorPalette="orange" variant="subtle">{statusLabel(approval.metadata.state)}</Badge>
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

      {trace ? <TraceRawPanel trace={trace} events={events} /> : null}
    </Box>
  );
}
