import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Box, Button, Code, Container, Field, Flex, Grid, Heading, HStack, Input, Link as ChakraLink, Table, Text } from '@chakra-ui/react';
import { Copy, RefreshCw, X } from 'lucide-react';
import { ApiError } from '../../ApplicationApiClient';
import { useAuthentication } from '../../AuthenticationContext';
import type { GatewayKeySummary, GatewaySetup } from '../../api/GatewayKeys';
import type { UsageSummary } from '../../api/Usage';
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
      return `Too many attempts. Try again in ${error.retryAfterSeconds} seconds.`;
    }
    return error.message;
  }
  return 'Something went wrong. Try again.';
}

function formatTokens(value: number): string {
  return value.toLocaleString();
}

function formatCost(value: number | null, currency: string): string {
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

function formatDate(value: string | null): string {
  if (!value) {
    return 'Never';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
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
      setStatus('Gateway key created. Copy it now; it is not shown again.');
      await load();
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'RECENT_AUTH_REQUIRED') {
        setPending({ kind: 'create', name: keyName });
        setStepUp(true);
      } else if (caught instanceof ApiError && caught.code === 'GATEWAY_NOT_ENTITLED') {
        setError('Gateway access is not granted for this account. Ask the host operator to grant it.');
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
      setStatus(`Revoked ${keyName}. Agents using it will be rejected.`);
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
      setCopyStatus(`${label} copied.`);
    } catch {
      setCopyStatus('Copy failed. Select the text and copy it manually.');
    }
  }

  return (
    <Container as="main" maxW="1440px" py={{ base: '6', md: '10' }} px={{ base: '4', md: '8' }}>
      <Flex justify="space-between" align="flex-end" gap="6" wrap="wrap" mb="6">
        <div>
          <Text mb="2" color="governance.primary" fontSize="xs" fontWeight="bold" textTransform="uppercase">Access</Text>
          <Heading fontFamily="heading" fontSize={{ base: '3xl', md: '4xl' }}>Gateway keys</Heading>
          <Text mt="2" maxW="52rem" color="governance.muted">
            Create a key for an agent, point the agent at the gateway base URL, and route model
            traffic through the guarded endpoint. The upstream provider key stays on the server.
          </Text>
        </div>
        <Button variant="outline" type="button" onClick={() => { void load(); }} disabled={loading}>
          <RefreshCw size={16} aria-hidden="true" /> Refresh
        </Button>
      </Flex>

      <ChakraLink asChild display="inline-flex" mb="5" fontSize="sm"><Link to="/account">Back to account</Link></ChakraLink>

      {!entitled ? (
        <Text role="status" mb="5" p="4" borderRadius="lg" bg="orange.50" color="orange.900" fontSize="sm">
          Gateway access is not granted for this account. You can view and revoke existing keys,
          but a host operator must grant gateway permission before new keys can be created.
        </Text>
      ) : null}

      <Box as="section" aria-labelledby="usage-summary-heading" mb="5" p={{ base: '4', md: '6' }} borderWidth="1px" borderColor="governance.line" borderRadius="xl" bg="white">
        <Text mb="1" color="governance.primary" fontSize="xs" fontWeight="bold" textTransform="uppercase">Last 30 days</Text>
        <Heading id="usage-summary-heading" mb="4" fontFamily="heading" fontSize="xl">Usage</Heading>
        {usageError ? (
          <Text role="status" color="governance.muted" fontSize="sm">Usage summary is unavailable.</Text>
        ) : null}
        {usageSummary ? (
          <>
            <Grid templateColumns={{ base: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(5, minmax(0, 1fr))' }} gap="3">
              {[
                ['Calls', formatTokens(usageSummary.calls)],
                ['Input tokens', formatTokens(usageSummary.inputTokens)],
                ['Output tokens', formatTokens(usageSummary.outputTokens)],
                ['Total tokens', formatTokens(usageSummary.totalTokens)],
                ['Estimated cost', formatCost(usageSummary.totalCostUsd, usageSummary.currency)],
              ].map(([label, value]) => (
                <Box key={label} p="3" borderRadius="lg" bg="governance.canvas">
                  <Text color="governance.muted" fontSize="xs">{label}</Text>
                  <Text mt="1" color="governance.ink" fontSize="lg" fontWeight="bold">{value}</Text>
                </Box>
              ))}
            </Grid>
            <Text mt="3" color="governance.muted" fontSize="xs">
              Cost is shown only when the deployment has a price configured for the model.
            </Text>
          </>
        ) : null}
      </Box>

      <Box as="section" aria-labelledby="create-key-heading" mb="5" p={{ base: '4', md: '6' }} borderWidth="1px" borderColor="governance.line" borderRadius="xl" bg="white">
        <Text mb="1" color="governance.primary" fontSize="xs" fontWeight="bold" textTransform="uppercase">New key</Text>
        <Heading id="create-key-heading" mb="4" fontFamily="heading" fontSize="xl">Create a gateway key</Heading>
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
            <Field.Label>Key name</Field.Label>
            <Input
              aria-label="Key name"
              value={name}
              maxLength={64}
              onChange={(event) => setName(event.target.value)}
              placeholder="laptop"
            />
          </Field.Root>
          <Button type="submit" disabled={!entitled || creating} colorPalette="green">
            {creating ? 'Creating…' : 'Create key'}
          </Button>
        </Box>
        <Text mt="3" color="governance.muted" fontSize="xs">
          Use 1–64 letters, digits, spaces, dots, underscores or hyphens. Up to five active keys
          are allowed per account.
        </Text>
      </Box>

      {status ? <Text role="status" mb="4" p="3" borderRadius="md" bg="green.50" color="green.900">{status}</Text> : null}
      {error ? <Text role="alert" mb="4" p="3" borderRadius="md" bg="red.50" color="red.800">{error}</Text> : null}
      {copyStatus ? <Text role="status" mb="4" color="governance.muted" fontSize="sm">{copyStatus}</Text> : null}

      {created ? (
        <Box as="section" aria-labelledby="new-key-heading" mb="5" p={{ base: '4', md: '6' }} borderWidth="1px" borderColor="green.300" borderRadius="xl" bg="white">
          <Flex justify="space-between" align="center" gap="4" wrap="wrap">
            <Box>
              <Text mb="1" color="governance.primary" fontSize="xs" fontWeight="bold" textTransform="uppercase">Shown once</Text>
              <Heading id="new-key-heading" fontFamily="heading" fontSize="xl">New key: {created.name}</Heading>
            </Box>
            <Button size="sm" variant="outline" onClick={() => setCreated(null)}><X size={16} aria-hidden="true" /> Hide</Button>
          </Flex>
          <Text role="alert" mt="4" p="3" borderRadius="md" bg="orange.50" color="orange.900" fontSize="sm">
            This token is shown once. Copy it now; it cannot be retrieved later.
          </Text>

          <HStack mt="4" align="stretch" gap="2" flexWrap="wrap">
            <Code aria-label="Gateway key" flex="1 1 20rem" p="3" borderRadius="md" fontSize="sm" overflowWrap="anywhere">{created.token}</Code>
            <Button onClick={() => { void copy(created.token, 'Gateway key'); }}><Copy size={16} aria-hidden="true" /> Copy key</Button>
          </HStack>

          <Grid mt="5" templateColumns={{ base: '1fr', md: 'repeat(3, minmax(0, 1fr))' }} gap="3">
            {[
              ['Base URL', created.baseUrl],
              ['Chat endpoint', `${created.baseUrl}${created.chatCompletionsPath}`],
              ['Models', created.models.length > 0 ? created.models.join(', ') : 'No models configured'],
            ].map(([label, value]) => (
              <Box key={label} minW="0" p="3" borderRadius="md" bg="governance.canvas">
                <Text color="governance.muted" fontSize="xs">{label}</Text>
                <Text mt="1" overflowWrap="anywhere" fontSize="sm">{value}</Text>
              </Box>
            ))}
          </Grid>

          <Heading as="h3" mt="6" mb="2" fontFamily="heading" fontSize="md">OpenCode</Heading>
          <Box as="pre" maxH="20rem" overflow="auto" p="4" borderRadius="lg" bg="governance.ink" color="white" fontFamily="mono" fontSize="xs" whiteSpace="pre-wrap" overflowWrap="anywhere">{created.openCodeConfig}</Box>
          <Button mt="2" variant="outline" onClick={() => { void copy(created.openCodeConfig, 'OpenCode config'); }}><Copy size={16} aria-hidden="true" /> Copy OpenCode config</Button>

          <Heading as="h3" mt="6" mb="2" fontFamily="heading" fontSize="md">VS Code Copilot BYOK</Heading>
          <Box as="pre" maxH="20rem" overflow="auto" p="4" borderRadius="lg" bg="governance.ink" color="white" fontFamily="mono" fontSize="xs" whiteSpace="pre-wrap" overflowWrap="anywhere">{created.vsCodeConfig}</Box>
          <Button mt="2" variant="outline" onClick={() => { void copy(created.vsCodeConfig, 'VS Code config'); }}><Copy size={16} aria-hidden="true" /> Copy VS Code config</Button>
        </Box>
      ) : null}

      <Box as="section" aria-labelledby="keys-heading" p={{ base: '4', md: '6' }} borderWidth="1px" borderColor="governance.line" borderRadius="xl" bg="white">
        <Flex justify="space-between" align="center" gap="4" mb="4">
          <Box>
            <Text mb="1" color="governance.primary" fontSize="xs" fontWeight="bold" textTransform="uppercase">Existing keys</Text>
            <Heading id="keys-heading" fontFamily="heading" fontSize="xl">Keys</Heading>
          </Box>
          <Badge colorPalette="gray" variant="subtle">{keys?.length ?? 0} keys</Badge>
        </Flex>

        {loading ? <Text role="status" color="governance.muted">Loading keys…</Text> : null}
        {listError ? (
          <Flex role="alert" justify="space-between" align="center" gap="4" p="3" borderRadius="md" bg="red.50" color="red.800">
            <Text>{listError}</Text>
            <Button size="sm" variant="outline" onClick={() => { void load(); }}>
              Try again
            </Button>
          </Flex>
        ) : null}
        {!loading && !listError && keys && keys.length === 0 ? (
          <Text role="status" py="8" color="governance.muted" textAlign="center">No gateway keys yet.</Text>
        ) : null}

        {keys && keys.length > 0 ? (
          <Table.ScrollArea>
            <Table.Root native size="sm" interactive>
              <Table.Caption>Gateway keys</Table.Caption>
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>Name</Table.ColumnHeader>
                  <Table.ColumnHeader>Prefix</Table.ColumnHeader>
                  <Table.ColumnHeader>Created</Table.ColumnHeader>
                  <Table.ColumnHeader>Last used</Table.ColumnHeader>
                  <Table.ColumnHeader>Status</Table.ColumnHeader>
                  <Table.ColumnHeader>Actions</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {keys.map((key) => (
                  <Table.Row key={key.id}>
                    <Table.Cell fontWeight="semibold">{key.name}</Table.Cell>
                    <Table.Cell><Code>{key.tokenPrefix}…</Code></Table.Cell>
                    <Table.Cell>{formatDate(key.createdAt)}</Table.Cell>
                    <Table.Cell>{formatDate(key.lastUsedAt)}</Table.Cell>
                    <Table.Cell><Badge colorPalette={key.revokedAt ? 'gray' : 'green'} variant="subtle">{key.revokedAt ? 'Revoked' : 'Active'}</Badge></Table.Cell>
                    <Table.Cell>
                      {key.revokedAt ? (
                        <Text color="governance.muted" fontSize="xs">No actions</Text>
                      ) : pendingRevoke?.id === key.id ? (
                        <HStack gap="2">
                          <Button size="xs" colorPalette="red" onClick={() => { void revoke(key.id, key.name); }}>
                            Confirm revoke
                          </Button>
                          <Button size="xs" variant="outline" onClick={() => setPendingRevoke(null)}>
                            Cancel
                          </Button>
                        </HStack>
                      ) : (
                        <Button size="xs" variant="outline" colorPalette="red" onClick={() => setPendingRevoke({ id: key.id, name: key.name })}>
                          Revoke
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
    </Container>
  );
}
