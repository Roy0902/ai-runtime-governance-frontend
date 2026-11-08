import { useCallback, useEffect, useState } from 'react';
import { Badge, Box, Button, Code, Field, Flex, Grid, Heading, HStack, Input, Stack, Table, Text } from '@chakra-ui/react';
import { Copy, RefreshCw, X } from 'lucide-react';
import { ApiError } from '../../ApplicationApiClient';
import { useAuthentication } from '../../AuthenticationContext';
import type { GatewayKeySummary, GatewaySetup } from '../../api/GatewayKeys';
import type { UsageSummary } from '../../api/Usage';
import { formatDateTime } from '../../format/date';
import { t } from '../../i18n';
import { StepUpDialog } from '../authentication/StepUpDialog';

type PendingAction =
  | { kind: 'create'; name: string }
  | { kind: 'revoke'; id: string; name: string };

function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.fieldErrors.length > 0) {
      return error.fieldErrors[0].message;
    }
    if (error.code === 'RATE_LIMITED' && error.retryAfterSeconds) {
      return t('common.tooManyAttempts', { seconds: error.retryAfterSeconds });
    }
    return error.message;
  }
  return t('common.somethingWentWrong');
}

function formatTokens(value: number): string {
  return value.toLocaleString();
}

function formatCost(value: number | null, currency: string): string {
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

function formatDate(value: string | null): string {
  return formatDateTime(value, t('gateway.never'), 'local', false);
}

export function GatewayKeysPage() {
  const { context, send } = useAuthentication();
  const entitled = context?.account?.gatewayEntitlement === 'GRANTED';

  const [keys, setKeys] = useState<GatewayKeySummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [name, setName] = useState('default');
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<GatewaySetup | null>(null);
  const [pendingRevoke, setPendingRevoke] = useState<{ id: string; name: string } | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState('');
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [stepUp, setStepUp] = useState(false);
  const [usageSummary, setUsageSummary] = useState<UsageSummary | null>(null);
  const [usageError, setUsageError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const value = await send<GatewayKeySummary[]>('/api/v1/account/gateway-keys', 'GET');
      setKeys(value);
    } catch (caught) {
      setListError(errorText(caught));
    } finally {
      setLoading(false);
    }
  }, [send]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let active = true;
    send<UsageSummary>('/api/v1/usage/summary', 'GET')
      .then((value) => {
        if (active) {
          setUsageSummary(value);
        }
      })
      .catch(() => {
        if (active) {
          setUsageError(true);
        }
      });
    return () => {
      active = false;
    };
  }, [send]);

  async function create(keyName: string) {
    setCreating(true);
    setError(null);
    setStatus('');
    setCopyStatus('');
    try {
      const value = await send<GatewaySetup>('/api/v1/account/gateway-keys', 'POST', {
        name: keyName,
      });
      setCreated(value);
      setStatus(t('gateway.created'));
      await load();
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'RECENT_AUTH_REQUIRED') {
        setPending({ kind: 'create', name: keyName });
        setStepUp(true);
      } else if (caught instanceof ApiError && caught.code === 'GATEWAY_NOT_ENTITLED') {
        setError(t('gateway.notEntitledError'));
      } else {
        setError(errorText(caught));
      }
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: string, keyName: string) {
    setError(null);
    setStatus('');
    try {
      await send(`/api/v1/account/gateway-keys/${id}`, 'DELETE');
      setPendingRevoke(null);
      setStatus(t('gateway.revokedStatus', { name: keyName }));
      await load();
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'RECENT_AUTH_REQUIRED') {
        setPending({ kind: 'revoke', id, name: keyName });
        setStepUp(true);
      } else {
        setError(errorText(caught));
      }
    }
  }

  async function copy(value: string, label: string) {
    setCopyStatus('');
    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus(t('gateway.copied', { label }));
    } catch {
      setCopyStatus(t('gateway.copyFailed'));
    }
  }

  return (
    <Stack gap="6">
      <Flex justify="space-between" align="flex-end" gap="6" wrap="wrap">
        <div>
          <Text mb="2" color="governance.primary" fontSize="xs" fontWeight="bold" textTransform="uppercase">{t('gateway.accessEyebrow')}</Text>
          <Heading as="h1" fontFamily="heading" fontSize={{ base: '3xl', md: '4xl' }}>{t('gateway.title')}</Heading>
          <Text mt="2" maxW="52rem" color="governance.muted">
            {t('gateway.description')}
          </Text>
        </div>
        <Button variant="outline" type="button" onClick={() => { void load(); }} disabled={loading}>
          <RefreshCw size={16} aria-hidden="true" /> {t('gateway.refresh')}
        </Button>
      </Flex>

      {!entitled ? (
        <Text role="status" mb="5" p="4" borderRadius="lg" bg="orange.50" color="orange.900" fontSize="sm">
          {t('gateway.notEntitled')}
        </Text>
      ) : null}

      <Box as="section" aria-labelledby="usage-summary-heading" mb="5" p={{ base: '4', md: '6' }} borderWidth="1px" borderColor="governance.line" borderRadius="xl" bg="white">
        <Text mb="1" color="governance.primary" fontSize="xs" fontWeight="bold" textTransform="uppercase">{t('gateway.last30Days')}</Text>
        <Heading id="usage-summary-heading" mb="4" fontFamily="heading" fontSize="xl">{t('gateway.usage')}</Heading>
        {usageError ? (
          <Text role="status" color="governance.muted" fontSize="sm">{t('gateway.usageUnavailable')}</Text>
        ) : null}
        {usageSummary ? (
          <>
            <Grid templateColumns={{ base: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(5, minmax(0, 1fr))' }} gap="3">
              {[
                [t('gateway.calls'), formatTokens(usageSummary.calls)],
                [t('gateway.inputTokens'), formatTokens(usageSummary.inputTokens)],
                [t('gateway.outputTokens'), formatTokens(usageSummary.outputTokens)],
                [t('gateway.totalTokens'), formatTokens(usageSummary.totalTokens)],
                [t('gateway.estimatedCost'), formatCost(usageSummary.totalCostUsd, usageSummary.currency)],
              ].map(([label, value]) => (
                <Box key={label} p="3" borderRadius="lg" bg="governance.canvas">
                  <Text color="governance.muted" fontSize="xs">{label}</Text>
                  <Text mt="1" color="governance.ink" fontSize="lg" fontWeight="bold">{value}</Text>
                </Box>
              ))}
            </Grid>
            <Text mt="3" color="governance.muted" fontSize="xs">
              {t('gateway.costNote')}
            </Text>
          </>
        ) : null}
      </Box>

      <Box as="section" aria-labelledby="create-key-heading" mb="5" p={{ base: '4', md: '6' }} borderWidth="1px" borderColor="governance.line" borderRadius="xl" bg="white">
        <Text mb="1" color="governance.primary" fontSize="xs" fontWeight="bold" textTransform="uppercase">{t('gateway.newKeyEyebrow')}</Text>
        <Heading id="create-key-heading" mb="4" fontFamily="heading" fontSize="xl">{t('gateway.createTitle')}</Heading>
        <Box
          as="form"
          display="flex"
          alignItems="flex-end"
          flexWrap="wrap"
          gap="3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!entitled || creating) {
              return;
            }
            void create(name.trim() || 'default');
          }}
        >
          <Field.Root flex="1 1 16rem">
            <Field.Label>{t('gateway.keyName')}</Field.Label>
            <Input
              aria-label={t('gateway.keyName')}
              value={name}
              maxLength={64}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('gateway.keyNamePlaceholder')}
            />
          </Field.Root>
          <Button type="submit" disabled={!entitled || creating} colorPalette="green">
            {creating ? t('gateway.creating') : t('gateway.createKey')}
          </Button>
        </Box>
        <Text mt="3" color="governance.muted" fontSize="xs">
          {t('gateway.keyNameHint')}
        </Text>
      </Box>

      {status ? <Text role="status" mb="4" p="3" borderRadius="md" bg="green.50" color="green.900">{status}</Text> : null}
      {error ? <Text role="alert" mb="4" p="3" borderRadius="md" bg="red.50" color="red.800">{error}</Text> : null}
      {copyStatus ? <Text role="status" mb="4" color="governance.muted" fontSize="sm">{copyStatus}</Text> : null}

      {created ? (
        <Box as="section" aria-labelledby="new-key-heading" mb="5" p={{ base: '4', md: '6' }} borderWidth="1px" borderColor="green.300" borderRadius="xl" bg="white">
          <Flex justify="space-between" align="center" gap="4" wrap="wrap">
            <Box>
              <Text mb="1" color="governance.primary" fontSize="xs" fontWeight="bold" textTransform="uppercase">{t('gateway.shownOnce')}</Text>
              <Heading id="new-key-heading" fontFamily="heading" fontSize="xl">{t('gateway.newKeyTitle', { name: created.name })}</Heading>
            </Box>
            <Button size="sm" variant="outline" onClick={() => setCreated(null)}><X size={16} aria-hidden="true" /> {t('gateway.hide')}</Button>
          </Flex>
          <Text role="alert" mt="4" p="3" borderRadius="md" bg="orange.50" color="orange.900" fontSize="sm">
            {t('gateway.tokenWarning')}
          </Text>

          <HStack mt="4" align="stretch" gap="2" flexWrap="wrap">
            <Code aria-label={t('gateway.gatewayKeyAria')} flex="1 1 20rem" p="3" borderRadius="md" fontSize="sm" overflowWrap="anywhere">{created.token}</Code>
            <Button onClick={() => { void copy(created.token, t('gateway.gatewayKeyAria')); }}><Copy size={16} aria-hidden="true" /> {t('gateway.copyKey')}</Button>
          </HStack>

          <Grid mt="5" templateColumns={{ base: '1fr', md: 'repeat(3, minmax(0, 1fr))' }} gap="3">
            {[
              [t('gateway.baseUrl'), created.baseUrl],
              [t('gateway.chatEndpoint'), `${created.baseUrl}${created.chatCompletionsPath}`],
              [t('gateway.models'), created.models.length > 0 ? created.models.join(', ') : t('gateway.noModels')],
            ].map(([label, value]) => (
              <Box key={label} minW="0" p="3" borderRadius="md" bg="governance.canvas">
                <Text color="governance.muted" fontSize="xs">{label}</Text>
                <Text mt="1" overflowWrap="anywhere" fontSize="sm">{value}</Text>
              </Box>
            ))}
          </Grid>

          <Heading as="h3" mt="6" mb="2" fontFamily="heading" fontSize="md">{t('gateway.openCode')}</Heading>
          <Box as="pre" maxH="20rem" overflow="auto" p="4" borderRadius="lg" bg="governance.ink" color="white" fontFamily="mono" fontSize="xs" whiteSpace="pre-wrap" overflowWrap="anywhere">{created.openCodeConfig}</Box>
          <Button mt="2" variant="outline" onClick={() => { void copy(created.openCodeConfig, t('gateway.copyOpenCode')); }}><Copy size={16} aria-hidden="true" /> {t('gateway.copyOpenCode')}</Button>

          <Heading as="h3" mt="6" mb="2" fontFamily="heading" fontSize="md">{t('gateway.vsCode')}</Heading>
          <Box as="pre" maxH="20rem" overflow="auto" p="4" borderRadius="lg" bg="governance.ink" color="white" fontFamily="mono" fontSize="xs" whiteSpace="pre-wrap" overflowWrap="anywhere">{created.vsCodeConfig}</Box>
          <Button mt="2" variant="outline" onClick={() => { void copy(created.vsCodeConfig, t('gateway.copyVsCode')); }}><Copy size={16} aria-hidden="true" /> {t('gateway.copyVsCode')}</Button>
        </Box>
      ) : null}

      <Box as="section" aria-labelledby="keys-heading" p={{ base: '4', md: '6' }} borderWidth="1px" borderColor="governance.line" borderRadius="xl" bg="white">
        <Flex justify="space-between" align="center" gap="4" mb="4">
          <Box>
            <Text mb="1" color="governance.primary" fontSize="xs" fontWeight="bold" textTransform="uppercase">{t('gateway.existingKeys')}</Text>
            <Heading id="keys-heading" fontFamily="heading" fontSize="xl">{t('gateway.keys')}</Heading>
          </Box>
          <Badge colorPalette="gray" variant="subtle">{(keys?.length ?? 0) === 1 ? t('gateway.keyCountOne', { count: keys?.length ?? 0 }) : t('gateway.keyCountOther', { count: keys?.length ?? 0 })}</Badge>
        </Flex>

        {loading ? <Text role="status" color="governance.muted">{t('gateway.loadingKeys')}</Text> : null}
        {listError ? (
          <Flex role="alert" justify="space-between" align="center" gap="4" p="3" borderRadius="md" bg="red.50" color="red.800">
            <Text>{listError}</Text>
            <Button size="sm" variant="outline" onClick={() => { void load(); }}>
              {t('common.tryAgain')}
            </Button>
          </Flex>
        ) : null}
        {!loading && !listError && keys && keys.length === 0 ? (
          <Text role="status" py="8" color="governance.muted" textAlign="center">{t('gateway.noKeys')}</Text>
        ) : null}

        {keys && keys.length > 0 ? (
          <Table.ScrollArea>
            <Table.Root native size="sm" interactive>
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>{t('gateway.name')}</Table.ColumnHeader>
                  <Table.ColumnHeader>{t('gateway.prefix')}</Table.ColumnHeader>
                  <Table.ColumnHeader>{t('gateway.createdAt')}</Table.ColumnHeader>
                  <Table.ColumnHeader>{t('gateway.lastUsed')}</Table.ColumnHeader>
                  <Table.ColumnHeader>{t('gateway.status')}</Table.ColumnHeader>
                  <Table.ColumnHeader>{t('gateway.actions')}</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {keys.map((key) => (
                  <Table.Row key={key.id}>
                    <Table.Cell fontWeight="semibold">{key.name}</Table.Cell>
                    <Table.Cell><Code>{key.tokenPrefix}…</Code></Table.Cell>
                    <Table.Cell>{formatDate(key.createdAt)}</Table.Cell>
                    <Table.Cell>{formatDate(key.lastUsedAt)}</Table.Cell>
                    <Table.Cell><Badge colorPalette={key.revokedAt ? 'gray' : 'green'} variant="subtle">{key.revokedAt ? t('gateway.revoked') : t('gateway.active')}</Badge></Table.Cell>
                    <Table.Cell>
                      {key.revokedAt ? (
                        <Text color="governance.muted" fontSize="xs">{t('gateway.noActions')}</Text>
                      ) : pendingRevoke?.id === key.id ? (
                        <HStack gap="2">
                          <Button size="xs" colorPalette="red" onClick={() => { void revoke(key.id, key.name); }}>
                            {t('gateway.confirmRevoke')}
                          </Button>
                          <Button size="xs" variant="outline" onClick={() => setPendingRevoke(null)}>
                            {t('common.cancel')}
                          </Button>
                        </HStack>
                      ) : (
                        <Button size="xs" variant="outline" colorPalette="red" onClick={() => setPendingRevoke({ id: key.id, name: key.name })}>
                          {t('gateway.revoke')}
                        </Button>
                      )}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Table.ScrollArea>
        ) : null}
      </Box>

      <StepUpDialog
        open={stepUp}
        onCancel={() => {
          setStepUp(false);
          setPending(null);
        }}
        onConfirmed={() => {
          const action = pending;
          setStepUp(false);
          setPending(null);
          if (action?.kind === 'create') {
            void create(action.name);
          } else if (action?.kind === 'revoke') {
            void revoke(action.id, action.name);
          }
        }}
      />
    </Stack>
  );
}
