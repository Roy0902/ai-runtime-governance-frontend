import { Fragment, useEffect, useState } from 'react';
import { Badge, Box, Button, Flex, Heading, Stack, Table, Text } from '@chakra-ui/react';
import { useAuthentication } from '../../AuthenticationContext';
import type { ModelUsage, ObservationContent } from '../../api/Usage';
import { StatusBadge } from './ActivityTimelinePresentation';

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

function duration(value: number | null): string {
  return value === null ? 'Not reported' : `${value.toLocaleString()} ms`;
}

function modelLabel(row: ModelUsage): string {
  if (row.responseModel && row.responseModel !== row.requestedModel) {
    return `${row.requestedModel} → ${row.responseModel}`;
  }
  return row.requestedModel;
}

export function TraceUsagePanel({ traceId }: { traceId: string }) {
  const { send } = useAuthentication();
  const [usage, setUsage] = useState<ModelUsage[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openObservation, setOpenObservation] = useState<string | null>(null);
  const [contents, setContents] = useState<Record<string, ObservationContent>>({});
  const [loadingObservation, setLoadingObservation] = useState<string | null>(null);
  const [contentErrors, setContentErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    send<ModelUsage[]>(`/api/v1/usage/traces/${traceId}`, 'GET')
      .then((value) => {
        if (active) {
          setUsage(value);
        }
      })
      .catch(() => {
        if (active) {
          setError('Model usage could not be loaded.');
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [send, traceId]);

  function toggleOutput(row: ModelUsage) {
    const observationId = row.langfuseObservationId;
    if (!observationId) {
      return;
    }
    if (openObservation === observationId) {
      setOpenObservation(null);
      return;
    }
    setOpenObservation(observationId);
    if (contents[observationId] || loadingObservation === observationId) {
      return;
    }
    setLoadingObservation(observationId);
    setContentErrors((current) => {
      const next = { ...current };
      delete next[observationId];
      return next;
    });
    send<ObservationContent>(
      `/api/v1/usage/traces/${traceId}/observations/${observationId}`,
      'GET',
    )
      .then((value) => {
        setContents((current) => ({ ...current, [observationId]: value }));
      })
      .catch(() => {
        setContentErrors((current) => ({
          ...current,
          [observationId]: 'The model output could not be loaded from Langfuse.',
        }));
      })
      .finally(() => {
        setLoadingObservation((current) => (current === observationId ? null : current));
      });
  }

  return (
    <Box as="section" aria-labelledby="usage-heading" mt="5" p={{ base: '4', md: '6' }} borderWidth="1px" borderColor="governance.line" borderRadius="xl" bg="white">
      <Flex justify="space-between" align="center" gap="3" mb="4">
        <Box>
          <Text mb="1" color="governance.primary" fontSize="xs" fontWeight="bold" textTransform="uppercase">Provider accounting</Text>
          <Heading id="usage-heading" fontFamily="heading" fontSize="xl">Model usage</Heading>
        </Box>
        {usage ? <Badge colorPalette="gray" variant="subtle">{usage.length} calls</Badge> : null}
      </Flex>

      {loading ? <Text role="status" color="governance.muted">Loading model usage…</Text> : null}
      {error ? <Text role="alert" p="3" borderRadius="md" bg="red.50" color="red.800">{error}</Text> : null}
      {!loading && !error && usage && usage.length === 0 ? (
        <Text role="status" py="8" color="governance.muted" textAlign="center">No model usage is reported for this trace.</Text>
      ) : null}

      {usage && usage.length > 0 ? (
        <Table.ScrollArea>
          <Table.Root native size="sm" interactive>
            <Table.Caption>Model usage by call</Table.Caption>
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>Model</Table.ColumnHeader>
                <Table.ColumnHeader>Input</Table.ColumnHeader>
                <Table.ColumnHeader>Output</Table.ColumnHeader>
                <Table.ColumnHeader>Cached</Table.ColumnHeader>
                <Table.ColumnHeader>Reasoning</Table.ColumnHeader>
                <Table.ColumnHeader>Total</Table.ColumnHeader>
                <Table.ColumnHeader>Cost</Table.ColumnHeader>
                <Table.ColumnHeader>Latency</Table.ColumnHeader>
                <Table.ColumnHeader>First byte</Table.ColumnHeader>
                <Table.ColumnHeader>Outcome</Table.ColumnHeader>
                <Table.ColumnHeader>Content</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {usage.map((row) => {
                const observationId = row.langfuseObservationId;
                return (
                  <Fragment key={row.id}>
                    <Table.Row>
                      <Table.Cell fontWeight="semibold">
                        <Text>{modelLabel(row)}</Text>
                        <Text mt="1" color="governance.muted" fontSize="xs">
                          {row.stream ? 'stream' : 'non-stream'} · {row.provider ?? 'provider not reported'}
                        </Text>
                        {row.finishReasons.length ? (
                          <Text color="governance.muted" fontSize="xs">finish: {row.finishReasons.join(', ')}</Text>
                        ) : null}
                        {row.toolCallNames.length ? (
                          <Text color="governance.muted" fontSize="xs">tools: {row.toolCallNames.join(', ')}</Text>
                        ) : null}
                        {row.errorCode || row.errorType ? (
                          <Text color="red.700" fontSize="xs">
                            {[row.errorType, row.errorCode].filter(Boolean).join(': ')}
                          </Text>
                        ) : null}
                      </Table.Cell>
                      <Table.Cell>{tokens(row.inputTokens)}</Table.Cell>
                      <Table.Cell>{tokens(row.outputTokens)}</Table.Cell>
                      <Table.Cell>{tokens(row.cachedInputTokens)}</Table.Cell>
                      <Table.Cell>{tokens(row.reasoningOutputTokens)}</Table.Cell>
                      <Table.Cell>{tokens(row.totalTokens)}</Table.Cell>
                      <Table.Cell>
                        <span>{money(row.totalCostUsd, row.currency)}</span>
                        {row.providerReportedCostUsd !== null ? (
                          <Text color="governance.muted" fontSize="xs">
                            provider: {money(row.providerReportedCostUsd, row.currency)}
                          </Text>
                        ) : null}
                      </Table.Cell>
                      <Table.Cell>{duration(row.durationMs)}</Table.Cell>
                      <Table.Cell>{duration(row.timeToFirstByteMs)}</Table.Cell>
                      <Table.Cell><StatusBadge value={row.outcome} /></Table.Cell>
                      <Table.Cell>
                        {observationId ? (
                          <Button
                            size="xs"
                            variant="ghost"
                            aria-expanded={openObservation === observationId}
                            onClick={() => toggleOutput(row)}
                          >
                            {openObservation === observationId ? 'Hide output' : 'View output'}
                          </Button>
                        ) : (
                          <Text color="governance.muted" fontSize="xs">Not exported</Text>
                        )}
                      </Table.Cell>
                    </Table.Row>
                    {openObservation === observationId && observationId ? (
                      <Table.Row>
                        <Table.Cell colSpan={11} bg="governance.canvas">
                          {loadingObservation === observationId ? (
                            <Text role="status" color="governance.muted">Loading output…</Text>
                          ) : null}
                          {contentErrors[observationId] ? (
                            <Text role="alert" color="red.700">
                              {contentErrors[observationId]}
                            </Text>
                          ) : null}
                          {contents[observationId] ? (
                            <Stack gap="2">
                              <Text color="governance.primary" fontSize="xs" fontWeight="bold" textTransform="uppercase">
                                Generated output · Langfuse
                              </Text>
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
                                {contents[observationId].output ?? 'No output was captured.'}
                              </Box>
                            </Stack>
                          ) : null}
                        </Table.Cell>
                      </Table.Row>
                    ) : null}
                    <Table.Row>
                      <Table.Cell colSpan={11} bg="governance.canvas">
                        <Text mb="2" color="governance.muted" fontSize="xs" fontWeight="bold" textTransform="uppercase">
                          All usage fields
                        </Text>
                        <Box
                          as="pre"
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
                          {JSON.stringify(row, null, 2)}
                        </Box>
                      </Table.Cell>
                    </Table.Row>
                  </Fragment>
                );
              })}
            </Table.Body>
          </Table.Root>
        </Table.ScrollArea>
      ) : null}

      {usage?.some((row) => row.captureTruncated) ? (
        <Text role="note" mt="4" p="3" borderRadius="md" bg="orange.50" color="orange.900" fontSize="sm">
          At least one response exceeded the capture limit; token and cost values may be partial.
        </Text>
      ) : null}
    </Box>
  );
}
