import { Fragment, useEffect, useState } from 'react';
import { Badge, Box, Button, Flex, Heading, Stack, Table, Text } from '@chakra-ui/react';
import { useAuthentication } from '../../AuthenticationContext';
import type { ModelUsage, ObservationContent } from '../../api/Usage';
import { t } from '../../i18n';
import { JsonBlock, StatusBadge } from './ActivityTimelinePresentation';

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

function duration(value: number | null): string {
  return value === null
    ? t('common.notReported')
    : t('activity.durationValue', { value: value.toLocaleString() });
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
          setError(t('activity.usageCouldNotLoad'));
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
          [observationId]: t('activity.outputLoadFailed'),
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
          <Text mb="1" color="governance.primary" fontSize="xs" fontWeight="bold" textTransform="uppercase">{t('activity.providerAccounting')}</Text>
          <Heading id="usage-heading" fontFamily="heading" fontSize="xl">{t('activity.modelUsage')}</Heading>
        </Box>
        {usage ? (
          <Badge colorPalette="gray" variant="subtle">
            {t(usage.length === 1 ? 'activity.callCountOne' : 'activity.callCountOther', { count: usage.length })}
          </Badge>
        ) : null}
      </Flex>

      {loading ? <Text role="status" color="governance.muted">{t('activity.loadingModelUsage')}</Text> : null}
      {error ? <Text role="alert" p="3" borderRadius="md" bg="red.50" color="red.800">{error}</Text> : null}
      {!loading && !error && usage && usage.length === 0 ? (
        <Text role="status" py="8" color="governance.muted" textAlign="center">{t('activity.noModelUsage')}</Text>
      ) : null}

      {usage && usage.length > 0 ? (
        <Table.ScrollArea>
          <Table.Root native size="sm" interactive>
            <Table.Caption>{t('activity.usageByCall')}</Table.Caption>
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>{t('activity.model')}</Table.ColumnHeader>
                <Table.ColumnHeader>{t('activity.input')}</Table.ColumnHeader>
                <Table.ColumnHeader>{t('activity.output')}</Table.ColumnHeader>
                <Table.ColumnHeader>{t('activity.cached')}</Table.ColumnHeader>
                <Table.ColumnHeader>{t('activity.reasoning')}</Table.ColumnHeader>
                <Table.ColumnHeader>{t('activity.total')}</Table.ColumnHeader>
                <Table.ColumnHeader>{t('activity.cost')}</Table.ColumnHeader>
                <Table.ColumnHeader>{t('activity.latency')}</Table.ColumnHeader>
                <Table.ColumnHeader>{t('activity.firstByte')}</Table.ColumnHeader>
                <Table.ColumnHeader>{t('activity.outcome')}</Table.ColumnHeader>
                <Table.ColumnHeader>{t('activity.content')}</Table.ColumnHeader>
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
                          {row.stream ? t('activity.stream') : t('activity.nonStream')} ·{' '}
                          {row.provider ?? t('activity.providerNotReported')}
                        </Text>
                        {row.finishReasons.length ? (
                          <Text color="governance.muted" fontSize="xs">
                            {t('activity.finishReasons', { values: row.finishReasons.join(', ') })}
                          </Text>
                        ) : null}
                        {row.toolCallNames.length ? (
                          <Text color="governance.muted" fontSize="xs">
                            {t('activity.tools', { values: row.toolCallNames.join(', ') })}
                          </Text>
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
                            {t('activity.providerCost', {
                              value: money(row.providerReportedCostUsd, row.currency),
                            })}
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
                            {openObservation === observationId
                              ? t('activity.hideOutput')
                              : t('activity.viewOutput')}
                          </Button>
                        ) : (
                          <Text color="governance.muted" fontSize="xs">{t('activity.notExported')}</Text>
                        )}
                      </Table.Cell>
                    </Table.Row>
                    {openObservation === observationId && observationId ? (
                      <Table.Row>
                        <Table.Cell colSpan={11} bg="governance.canvas">
                          {loadingObservation === observationId ? (
                            <Text role="status" color="governance.muted">{t('activity.loadingOutput')}</Text>
                          ) : null}
                          {contentErrors[observationId] ? (
                            <Text role="alert" color="red.700">
                              {contentErrors[observationId]}
                            </Text>
                          ) : null}
                          {contents[observationId] ? (
                            <Stack gap="2">
                              <Text color="governance.primary" fontSize="xs" fontWeight="bold" textTransform="uppercase">
                                {t('activity.generatedOutput')}
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
                                {contents[observationId].output ?? t('activity.noOutputCaptured')}
                              </Box>
                            </Stack>
                          ) : null}
                        </Table.Cell>
                      </Table.Row>
                    ) : null}
                    <Table.Row>
                      <Table.Cell colSpan={11} bg="governance.canvas">
                        <JsonBlock label={t('activity.allUsageFields')} value={row} />
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
          {t('activity.captureTruncated')}
        </Text>
      ) : null}
    </Box>
  );
}
