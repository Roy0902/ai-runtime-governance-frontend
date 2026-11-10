import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Box, Button, Code, Field, Flex, Grid, Heading, HStack, Input, Stack, Text } from '@chakra-ui/react';
import { Copy, KeyRound } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { ApiError } from '../../ApplicationApiClient';
import { useAuthentication } from '../../AuthenticationContext';
import type { GatewaySetup } from '../../api/GatewayKeys';
import type { GroupSummary } from '../../api/Groups';
import type { ProviderCredentialSummary, ProviderKind } from '../../api/ProviderCredentials';
import { PROVIDERS } from '../../api/ProviderCredentials';
import { formatDateTime } from '../../format/simpleDate';
import { StepUpDialog } from '../authentication/StepUpDialog';
import { buildBashScript, buildPowerShellScript } from './installScripts';

type PendingAction =
  | { kind: 'save'; provider: ProviderKind }
  | { kind: 'delete'; provider: ProviderKind }
  | { kind: 'key'; name: string };

interface ProviderForm {
  accessKey: string;
  secretKey: string;
  name: string;
}

const EMPTY_FORM: ProviderForm = { accessKey: '', secretKey: '', name: '' };

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

function providerLabel(provider: ProviderKind): string {
  return provider === 'LANGSMITH' ? 'LangSmith' : 'Langfuse';
}

export function AgentSetupPage() {
  const { context, send } = useAuthentication();
  const [searchParams] = useSearchParams();
  const entitled = context?.account?.gatewayEntitlement === 'GRANTED';
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [selectedGroup, setSelectedGroup] = useState(searchParams.get('group') ?? '');
  const canCreate = entitled || Boolean(selectedGroup);

  const [summaries, setSummaries] = useState<ProviderCredentialSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<ProviderKind, ProviderForm>>({
    LANGSMITH: EMPTY_FORM,
    LANGFUSE: EMPTY_FORM,
  });
  const [busy, setBusy] = useState<ProviderKind | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [keyName, setKeyName] = useState('agent');
  const [creating, setCreating] = useState(false);
  const [setup, setSetup] = useState<GatewaySetup | null>(null);
  const [scriptKind, setScriptKind] = useState<'powershell' | 'bash'>('powershell');
  const [copyStatus, setCopyStatus] = useState('');

  const [pending, setPending] = useState<PendingAction | null>(null);
  const [stepUp, setStepUp] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const value = await send<ProviderCredentialSummary[]>('/api/v1/account/provider-credentials', 'GET');
      setSummaries(value);
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
    send<GroupSummary[]>('/api/v1/account/groups', 'GET')
      .then((value) => setGroups(value))
      .catch(() => setGroups([]));
  }, [send]);

  function updateForm(provider: ProviderKind, field: keyof ProviderForm, value: string) {
    setForms((current) => ({ ...current, [provider]: { ...current[provider], [field]: value } }));
  }

  function handleRecentAuth(caught: unknown, action: PendingAction): boolean {
    if (caught instanceof ApiError && caught.code === 'RECENT_AUTH_REQUIRED') {
      setPending(action);
      setStepUp(true);
      return true;
    }
    return false;
  }

  async function save(provider: ProviderKind) {
    setBusy(provider);
    setError(null);
    setStatus('');
    const form = forms[provider];
    try {
      await send<ProviderCredentialSummary>(`/api/v1/account/provider-credentials/${provider}`, 'PUT', {
        accessKey: form.accessKey.trim() || null,
        secretKey: form.secretKey,
        name: form.name.trim() || null,
      });
      setForms((current) => ({ ...current, [provider]: { ...EMPTY_FORM } }));
      setStatus(`${providerLabel(provider)} saved.`);
      await load();
    } catch (caught) {
      if (!handleRecentAuth(caught, { kind: 'save', provider })) {
        setError(errorText(caught));
      }
    } finally {
      setBusy(null);
    }
  }

  async function remove(provider: ProviderKind) {
    setBusy(provider);
    setError(null);
    setStatus('');
    try {
      await send(`/api/v1/account/provider-credentials/${provider}`, 'DELETE');
      setStatus(`${providerLabel(provider)} removed.`);
      await load();
    } catch (caught) {
      if (!handleRecentAuth(caught, { kind: 'delete', provider })) {
        setError(errorText(caught));
      }
    } finally {
      setBusy(null);
    }
  }

  async function createKey(name: string) {
    setCreating(true);
    setError(null);
    setStatus('');
    setCopyStatus('');
    try {
      const path = selectedGroup
        ? `/api/v1/account/groups/${selectedGroup}/gateway-keys`
        : '/api/v1/account/gateway-keys';
      const value = await send<GatewaySetup>(path, 'POST', {
        name: name.trim() || 'agent',
      });
      setSetup(value);
      setStatus('Install script generated.');
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'GATEWAY_NOT_ENTITLED') {
        setError('Gateway access is not granted for this account. A host operator must grant it before you can generate an access key.');
      } else if (!handleRecentAuth(caught, { kind: 'key', name })) {
        setError(errorText(caught));
      }
    } finally {
      setCreating(false);
    }
  }

  async function copy(value: string) {
    setCopyStatus('');
    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus('Copied');
    } catch {
      setCopyStatus('Could not copy');
    }
  }

  const script = useMemo(() => {
    if (!setup) {
      return '';
    }
    return scriptKind === 'powershell' ? buildPowerShellScript(setup) : buildBashScript(setup);
  }, [setup, scriptKind]);

  return (
    <Stack gap="6">
      <Box>
        <Text mb="2" color="governance.primary" fontSize="xs" fontWeight="bold" textTransform="uppercase">
          Bring your own keys
        </Text>
        <Heading as="h1" fontFamily="heading" fontSize={{ base: '3xl', md: '4xl' }}>Agent setup</Heading>
        <Text mt="2" maxW="52rem" color="governance.muted">
          Store your tracing provider keys, then generate a one-time install script for your CLI or IDE.
          Provider secrets stay on the server; clients only receive a gateway access key.
        </Text>
      </Box>

      {status ? <Text role="status" p="3" borderRadius="md" bg="green.50" color="green.900">{status}</Text> : null}
      {error ? <Text role="alert" p="3" borderRadius="md" bg="red.50" color="red.800">{error}</Text> : null}
      {listError ? (
        <Flex role="alert" justify="space-between" align="center" gap="4" p="3" borderRadius="md" bg="red.50" color="red.800">
          <Text>{listError}</Text>
          <Button size="sm" variant="outline" onClick={() => { void load(); }}>Try again</Button>
        </Flex>
      ) : null}

      <Box p={{ base: '4', md: '6' }} borderWidth="1px" borderColor="governance.line" borderRadius="xl" bg="white">
        <Heading fontFamily="heading" fontSize="xl">Tracing providers</Heading>
        <Text mt="1" mb="5" color="governance.muted" fontSize="sm">
          Secrets are encrypted before storage and are never returned. The access key is the Langfuse
          public key; LangSmith only needs the secret.
        </Text>
        {loading ? <Text role="status" mb="4" color="governance.muted" fontSize="sm">Loading tracing providers…</Text> : null}

        <Stack gap="5">
          {PROVIDERS.map((provider) => {
            const summary = summaries?.find((item) => item.provider === provider);
            const form = forms[provider];
            return (
              <Box key={provider} p="4" borderWidth="1px" borderColor="governance.line" borderRadius="lg">
                <Flex justify="space-between" align="center" gap="4" wrap="wrap" mb="3">
                  <Heading as="h3" fontFamily="heading" fontSize="md">{providerLabel(provider)}</Heading>
                  <Badge colorPalette={summary ? 'green' : 'gray'} variant="subtle">
                    {summary ? 'Configured' : 'Not configured'}
                  </Badge>
                </Flex>

                {summary ? (
                  <Text mb="3" color="governance.muted" fontSize="sm">
                    {summary.accessKey ? `Access key: ${summary.accessKey} · ` : ''}
                    {`Secret: ${summary.secretHint}`}
                    {' · '}
                    {`Updated ${formatDateTime(summary.updatedAt, '')}`}
                  </Text>
                ) : null}

                <Grid templateColumns={{ base: '1fr', md: 'repeat(3, minmax(0, 1fr))' }} gap="3" mb="3">
                  {provider === 'LANGFUSE' ? (
                    <Field.Root>
                      <Field.Label>Public / access key</Field.Label>
                      <Input
                        aria-label={`${providerLabel(provider)} Public / access key`}
                        value={form.accessKey}
                        maxLength={512}
                        onChange={(event) => updateForm(provider, 'accessKey', event.target.value)}
                        placeholder="pk-lf-..."
                      />
                    </Field.Root>
                  ) : (
                    <Field.Root>
                      <Field.Label>Public / access key</Field.Label>
                      <Input value="" disabled placeholder="Not used by LangSmith" aria-label="Not used by LangSmith" />
                    </Field.Root>
                  )}
                  <Field.Root>
                    <Field.Label>Secret key</Field.Label>
                    <Input
                      type="password"
                      autoComplete="off"
                      aria-label={`${providerLabel(provider)} Secret key`}
                      value={form.secretKey}
                      maxLength={4096}
                      onChange={(event) => updateForm(provider, 'secretKey', event.target.value)}
                      placeholder={provider === 'LANGSMITH' ? 'lsv2_...' : 'sk-lf-...'}
                    />
                  </Field.Root>
                  <Field.Root>
                    <Field.Label>Label</Field.Label>
                    <Input
                      aria-label={`${providerLabel(provider)} Label`}
                      value={form.name}
                      maxLength={64}
                      onChange={(event) => updateForm(provider, 'name', event.target.value)}
                      placeholder={providerLabel(provider)}
                    />
                  </Field.Root>
                </Grid>

                <HStack gap="2" flexWrap="wrap">
                  <Button
                    size="sm"
                    colorPalette="green"
                    disabled={!form.secretKey || busy === provider}
                    onClick={() => { void save(provider); }}
                  >
                    {busy === provider ? 'Saving…' : summary ? 'Update' : 'Save'}
                  </Button>
                  {summary ? (
                    <Button
                      size="sm"
                      variant="outline"
                      colorPalette="red"
                      disabled={busy === provider}
                      onClick={() => { void remove(provider); }}
                    >
                      Remove
                    </Button>
                  ) : null}
                  <Text color="governance.muted" fontSize="xs">Stored encrypted. It is never displayed again.</Text>
                </HStack>
              </Box>
            );
          })}
        </Stack>
      </Box>

      <Box p={{ base: '4', md: '6' }} borderWidth="1px" borderColor="governance.line" borderRadius="xl" bg="white">
        <Flex justify="space-between" align="center" gap="4" wrap="wrap" mb="2">
          <Heading fontFamily="heading" fontSize="xl">Install script</Heading>
          <KeyRound size={18} aria-hidden="true" />
        </Flex>
        <Text mb="4" color="governance.muted" fontSize="sm">
          Creates a gateway access key and builds an install script. Give the script to your AI agent,
          or run it yourself. It contains the access key, not your provider secrets.
        </Text>

        {groups.length > 0 ? (
          <Box mb="4">
            <Text mb="2" fontSize="sm" fontWeight="semibold">Key scope</Text>
            <HStack gap="2" flexWrap="wrap">
              <Button
                size="sm"
                variant={selectedGroup === '' ? 'solid' : 'outline'}
                onClick={() => setSelectedGroup('')}
              >
                Personal
              </Button>
              {groups.map((group) => (
                <Button
                  key={group.id}
                  size="sm"
                  variant={selectedGroup === group.id ? 'solid' : 'outline'}
                  onClick={() => setSelectedGroup(group.id)}
                >
                  {group.name}
                </Button>
              ))}
            </HStack>
            {selectedGroup ? (
              <Text mt="2" color="governance.muted" fontSize="xs">
                This key is issued in the selected group and uses the group provider credentials.
              </Text>
            ) : null}
          </Box>
        ) : null}

        {!canCreate ? (
          <Text role="status" mb="4" p="3" borderRadius="md" bg="orange.50" color="orange.900" fontSize="sm">
            Gateway access is not granted for this account. A host operator must grant it before you can generate an access key.
          </Text>
        ) : null}

        <HStack gap="2" flexWrap="wrap" mb="4">
          <Input
            aria-label="Access key name"
            value={keyName}
            maxLength={64}
            onChange={(event) => setKeyName(event.target.value)}
            placeholder="Access key name"
            maxW="18rem"
          />
          <Button
            colorPalette="green"
            disabled={!canCreate || creating}
            onClick={() => { void createKey(keyName); }}
          >
            {creating ? 'Generating…' : 'Generate script'}
          </Button>
        </HStack>

        {setup ? (
          <Box p="4" borderWidth="1px" borderColor="green.300" borderRadius="lg">
            <Text mb="1" color="governance.primary" fontSize="xs" fontWeight="bold" textTransform="uppercase">
              Shown once
            </Text>
            <Text role="alert" mb="3" p="3" borderRadius="md" bg="orange.50" color="orange.900" fontSize="sm">
              This script contains a secret gateway key. Store it safely; it cannot be shown again.
            </Text>
            <HStack align="stretch" gap="2" flexWrap="wrap" mb="4">
              <Code flex="1 1 20rem" p="3" borderRadius="md" fontSize="sm" overflowWrap="anywhere">{setup.token}</Code>
              <Button onClick={() => { void copy(setup.token); }}>
                <Copy size={16} aria-hidden="true" /> Copy
              </Button>
            </HStack>

            <HStack gap="2" mb="2" flexWrap="wrap">
              <Button
                size="sm"
                variant={scriptKind === 'powershell' ? 'solid' : 'outline'}
                onClick={() => setScriptKind('powershell')}
              >
                PowerShell
              </Button>
              <Button
                size="sm"
                variant={scriptKind === 'bash' ? 'solid' : 'outline'}
                onClick={() => setScriptKind('bash')}
              >
                Bash
              </Button>
              <Button size="sm" variant="outline" onClick={() => { void copy(script); }}>
                <Copy size={16} aria-hidden="true" /> {copyStatus || 'Copy script'}
              </Button>
            </HStack>
            <Box
              as="pre"
              maxH="26rem"
              overflow="auto"
              p="4"
              borderRadius="lg"
              bg="governance.ink"
              color="white"
              fontFamily="mono"
              fontSize="xs"
              whiteSpace="pre-wrap"
              overflowWrap="anywhere"
            >
              {script}
            </Box>
            <Text mt="3" color="governance.muted" fontSize="xs">
              Run the script, restart OpenCode or VS Code, then open Activity to verify the trace.
            </Text>
          </Box>
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
          if (action?.kind === 'save') {
            void save(action.provider);
          } else if (action?.kind === 'delete') {
            void remove(action.provider);
          } else if (action?.kind === 'key') {
            void createKey(action.name);
          }
        }}
      />
    </Stack>
  );
}
