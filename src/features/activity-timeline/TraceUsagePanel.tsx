import { useEffect, useState } from 'react';
import { Badge, Box, Flex, Heading, Table, Text } from '@chakra-ui/react';
import { useAuthentication } from '../../AuthenticationContext';
import type { ModelUsage } from '../../api/Usage';
import { t } from '../../i18n';
import { StatusBadge } from './ActivityTimelinePresentation';

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
  return value === null ? t('common.notReported') : t('activity.durationValue', { value: value.toLocaleString() });
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

  return (
    <Box as="section" aria-labelledby="usage-heading" mt="5" p={{ base: '4', md: '6' }} borderWidth="1px" borderColor="governance.line" borderRadius="xl" bg="white">
      <Flex justify="space-between" align="center" gap="3" mb="4">
        <Box>
          <Text mb="1" color="governance.primary" fontSize="xs" fontWeight="bold" textTransform="uppercase">{t('activity.providerAccounting')}</Text>
          <Heading id="usage-heading" fontFamily="heading" fontSize="xl">{t('activity.modelUsage')}</Heading>
        </Box>
        {usage ? <Badge colorPalette="gray" variant="subtle">{usage.length === 1 ? t('activity.callCountOne', { count: usage.length }) : t('activity.callCountOther', { count: usage.length })}</Badge> : null}
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
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {usage.map((row) => (
                <Table.Row key={row.id}>
                  <Table.Cell fontWeight="semibold">
                    <Text>{modelLabel(row)}</Text>
                    <Text mt="1" color="governance.muted" fontSize="xs">
                      {row.stream ? t('activity.stream') : t('activity.nonStream')} · {row.provider ?? t('activity.providerNotReported')}
                    </Text>
                    {row.finishReasons.length ? (
                      <Text color="governance.muted" fontSize="xs">{t('activity.finishReasons', { values: row.finishReasons.join(', ') })}</Text>
                    ) : null}
                    {row.toolCallNames.length ? (
                      <Text color="governance.muted" fontSize="xs">{t('activity.tools', { values: row.toolCallNames.join(', ') })}</Text>
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
                        {t('activity.providerCost', { value: money(row.providerReportedCostUsd, row.currency) })}
                      </Text>
                    ) : null}
                  </Table.Cell>
                  <Table.Cell>{duration(row.durationMs)}</Table.Cell>
                  <Table.Cell>{duration(row.timeToFirstByteMs)}</Table.Cell>
                  <Table.Cell><StatusBadge value={row.outcome} /></Table.Cell>
                </Table.Row>
              ))}
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
