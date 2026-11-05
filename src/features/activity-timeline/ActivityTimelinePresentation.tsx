import type { GuardOutcome, TraceDetail } from './ActivityTimelineTypes';
import { Badge, Box, Flex, Grid, Heading, HStack, Text } from '@chakra-ui/react';

export function formatTime(value: string | null): string {
  return value
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'medium',
        timeZone: 'UTC',
      }).format(new Date(value)) + ' UTC'
    : 'Not reported';
}

export function statusLabel(value: string | null): string {
  return value ? value.replaceAll('_', ' ') : 'Not reported';
}

export function shortId(value: string): string {
  return value.slice(-8);
}

export function outcomeLabel(value: GuardOutcome | null): string {
  return value ? value.replaceAll('_', ' ') : 'No guard outcome reported';
}

export function StatusBadge({ value, label }: { value: string | null; label?: string }) {
  const normalized = value?.replaceAll('_', '-') ?? 'unknown';
  const palettes: Record<string, 'green' | 'red' | 'orange' | 'blue' | 'gray'> = {
    completed: 'green',
    allow: 'green',
    observed: 'green',
    failed: 'red',
    deny: 'red',
    canceled: 'orange',
    'require-approval': 'orange',
    running: 'blue',
    guarded: 'blue',
    unknown: 'gray',
  };
  return (
    <Badge colorPalette={palettes[normalized] ?? 'gray'} variant="subtle" textTransform="capitalize">
      {label ?? statusLabel(value)}
    </Badge>
  );
}

export function TraceSummaryPanel({ trace }: { trace: TraceDetail }) {
  return (
    <Box as="section" aria-label="Trace summary" mt="6" p={{ base: '4', md: '6' }} borderWidth="1px" borderColor="governance.line" borderRadius="xl" bg="white">
      <Flex justify="space-between" align="flex-start" gap="4" wrap="wrap">
        <Box>
          <Text mb="1" color="governance.primary" fontSize="xs" fontWeight="bold" textTransform="uppercase">Trace</Text>
          <Heading fontSize="xl" fontFamily="heading">{trace.identity ?? 'Identity not reported'}</Heading>
          <Text as="code" display="block" mt="2" color="governance.muted" fontSize="xs" overflowWrap="anywhere">
            Trace {trace.traceId}
          </Text>
        </Box>
        <StatusBadge value={trace.executionStatus} />
      </Flex>
      <Grid mt="6" templateColumns={{ base: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' }} gap="3">
        {[
          ['Execution', statusLabel(trace.executionStatus)],
          ['Telemetry', statusLabel(trace.telemetryStatus)],
          ['Prompt guard', outcomeLabel(trace.guardOutcome)],
          ['Received (UTC)', formatTime(trace.receivedAt)],
        ].map(([label, value]) => (
          <Box key={label} p="3" borderRadius="lg" bg="governance.canvas">
            <Text color="governance.muted" fontSize="xs">{label}</Text>
            <Text mt="1" color="governance.ink" fontSize="sm" fontWeight="semibold">{value}</Text>
          </Box>
        ))}
      </Grid>
      <Box mt="4" aria-label="Reported integration coverage">
        <Text mb="2" color="governance.muted" fontSize="xs" fontWeight="bold" textTransform="uppercase">Integration coverage</Text>
        <HStack gap="2" flexWrap="wrap">
          {Object.entries(trace.coverage).map(([label, value]) => (
            <Badge key={label} colorPalette={value === 'observed' ? 'green' : 'gray'} variant="outline">
              {label}: {statusLabel(value)}
            </Badge>
          ))}
        </HStack>
      </Box>
      {trace.loss ? (
        <Box as="section" aria-label="Loss extent" mt="4" p="4" borderRadius="lg" bg="orange.50" color="orange.900">
          <Text mb="2" fontWeight="bold">Telemetry loss</Text>
          <Grid templateColumns={{ base: '1fr', md: 'repeat(3, minmax(0, 1fr))' }} gap="3">
            <Text fontSize="sm"><Text as="span" fontWeight="bold">Cause: </Text>{trace.loss.causeCode ?? 'Unknown'}</Text>
            <Text fontSize="sm"><Text as="span" fontWeight="bold">Missing events: </Text>{trace.loss.missingCount === null ? 'Unknown' : trace.loss.missingCount}</Text>
            <Text fontSize="sm"><Text as="span" fontWeight="bold">Time range: </Text>{trace.loss.from || trace.loss.to ? `${formatTime(trace.loss.from)} to ${formatTime(trace.loss.to)}` : 'Unknown'}</Text>
          </Grid>
        </Box>
      ) : null}
    </Box>
  );
}
