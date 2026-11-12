import { useCallback, useEffect, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Code,
  Field,
  Flex,
  Grid,
  Heading,
  HStack,
  Input,
  Stack,
  Table,
  Text,
} from '@chakra-ui/react';
import { Copy, KeyRound, LogIn, Plus, Trash2, UserPlus, Users } from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';
import { ApiError } from '../../ApplicationApiClient';
import { useAuthentication } from '../../AuthenticationContext';
import type { GroupDetail, GroupSummary, IssuedInvite } from '../../api/Groups';
import type { ProviderCredentialSummary, ProviderKind } from '../../api/ProviderCredentials';
import { formatDateTime } from '../../format/date';
import { t } from '../../i18n';
import { StepUpDialog } from '../authentication/StepUpDialog';

interface PendingAction {
  run: () => void;
}

interface ProviderForm {
  provider: ProviderKind;
  accessKey: string;
  secretKey: string;
}

const EMPTY_PROVIDER: ProviderForm = { provider: 'LANGFUSE', accessKey: '', secretKey: '' };

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

export function GroupsPage() {
  const { send } = useAuthentication();
  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [details, setDetails] = useState<Record<string, GroupDetail>>({});
  const [providers, setProviders] = useState<Record<string, ProviderCredentialSummary[]>>({});
  const [newName, setNewName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<Record<string, IssuedInvite>>({});
  const [forms, setForms] = useState<Record<string, ProviderForm>>({});
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [stepUp, setStepUp] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await send<GroupSummary[]>('/api/v1/account/groups', 'GET');
      setGroups(list);
      const loaded = await Promise.all(list.map(async (group) => {
        const detail = await send<GroupDetail>(`/api/v1/account/groups/${group.id}`, 'GET');
        let providerList: ProviderCredentialSummary[] = [];
        if (group.role === 'OWNER') {
          providerList = await send<ProviderCredentialSummary[]>(
            `/api/v1/account/groups/${group.id}/provider-credentials`, 'GET');
        }
        return { detail, providerList };
      }));
      const nextDetails: Record<string, GroupDetail> = {};
      const nextProviders: Record<string, ProviderCredentialSummary[]> = {};
      for (const item of loaded) {
        nextDetails[item.detail.id] = item.detail;
        nextProviders[item.detail.id] = item.providerList;
      }
      setDetails(nextDetails);
      setProviders(nextProviders);
    } catch (caught) {
      setError(errorText(caught));
    }
  }, [send]);

  useEffect(() => {
    void load();
  }, [load]);

  function retryAfterStepUp(caught: unknown, run: () => void): boolean {
    if (caught instanceof ApiError && caught.code === 'RECENT_AUTH_REQUIRED') {
      setPending({ run });
      setStepUp(true);
      return true;
    }
    return false;
  }

  async function createGroup() {
    if (!newName.trim()) {
      return;
    }
    setBusy('create');
    setError(null);
    setStatus('');
    try {
      await send('/api/v1/account/groups', 'POST', { name: newName.trim() });
      setNewName('');
      setStatus(t('groups.created'));
      await load();
    } catch (caught) {
      if (!retryAfterStepUp(caught, createGroup)) {
        setError(errorText(caught));
      }
    } finally {
      setBusy('');
    }
  }

  async function joinGroup() {
    if (!joinCode.trim()) {
      return;
    }
    setBusy('join');
    setError(null);
    setStatus('');
    try {
      const group = await send<GroupSummary>('/api/v1/account/groups/join', 'POST', { code: joinCode.trim() });
      setJoinCode('');
      setStatus(t('groups.joinedGroup', { name: group.name }));
      await load();
    } catch (caught) {
      if (!retryAfterStepUp(caught, joinGroup)) {
        setError(errorText(caught));
      }
    } finally {
      setBusy('');
    }
  }

  async function createInvite(groupId: string) {
    setBusy(`invite:${groupId}`);
    setError(null);
    setStatus('');
    try {
      const invite = await send<IssuedInvite>(`/api/v1/account/groups/${groupId}/invites`, 'POST', {
        expiresInHours: 168,
        maxUses: 0,
      });
      setIssued((current) => ({ ...current, [groupId]: invite }));
      setStatus(t('groups.inviteReady'));
      await load();
    } catch (caught) {
      if (!retryAfterStepUp(caught, () => { void createInvite(groupId); })) {
        setError(errorText(caught));
      }
    } finally {
      setBusy('');
    }
  }

  async function revokeInvite(groupId: string, inviteId: string) {
    setBusy(`revoke:${inviteId}`);
    setError(null);
    try {
      await send(`/api/v1/account/groups/${groupId}/invites/${inviteId}`, 'DELETE');
      setIssued((current) => {
        const next = { ...current };
        delete next[groupId];
        return next;
      });
      await load();
    } catch (caught) {
      if (!retryAfterStepUp(caught, () => { void revokeInvite(groupId, inviteId); })) {
        setError(errorText(caught));
      }
    } finally {
      setBusy('');
    }
  }

  async function removeMember(groupId: string, userId: string) {
    setBusy(`member:${userId}`);
    setError(null);
    try {
      await send(`/api/v1/account/groups/${groupId}/members/${userId}`, 'DELETE');
      setStatus(t('groups.memberRemoved'));
      await load();
    } catch (caught) {
      if (!retryAfterStepUp(caught, () => { void removeMember(groupId, userId); })) {
        setError(errorText(caught));
      }
    } finally {
      setBusy('');
    }
  }

  async function saveProvider(groupId: string) {
    const form = forms[groupId] ?? EMPTY_PROVIDER;
    if (!form.secretKey) {
      return;
    }
    setBusy(`provider:${groupId}`);
    setError(null);
    setStatus('');
    try {
      await send(`/api/v1/account/groups/${groupId}/provider-credentials/${form.provider}`, 'PUT', {
        accessKey: form.accessKey.trim() || null,
        secretKey: form.secretKey,
      });
      setForms((current) => ({ ...current, [groupId]: { ...EMPTY_PROVIDER } }));
      setStatus(t('groups.providerSaved'));
      await load();
    } catch (caught) {
      if (!retryAfterStepUp(caught, () => { void saveProvider(groupId); })) {
        setError(errorText(caught));
      }
    } finally {
      setBusy('');
    }
  }

  async function deleteProvider(groupId: string, provider: ProviderKind) {
    setBusy(`provider:${groupId}`);
    setError(null);
    try {
      await send(`/api/v1/account/groups/${groupId}/provider-credentials/${provider}`, 'DELETE');
      await load();
    } catch (caught) {
      if (!retryAfterStepUp(caught, () => { void deleteProvider(groupId, provider); })) {
        setError(errorText(caught));
      }
    } finally {
      setBusy('');
    }
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setStatus(t('groups.copied'));
    } catch {
      setStatus(t('groups.copyFailed'));
    }
  }

  return (
    <Stack gap="6">
      <Box>
        <Text mb="2" color="governance.primary" fontSize="xs" fontWeight="bold" textTransform="uppercase">
          {t('groups.eyebrow')}
        </Text>
        <Heading as="h1" fontFamily="heading" fontSize={{ base: '3xl', md: '4xl' }}>{t('groups.title')}</Heading>
        <Text mt="2" maxW="56rem" color="governance.muted">{t('groups.description')}</Text>
      </Box>

      {status ? <Text role="status" p="3" borderRadius="md" bg="green.50" color="green.900">{status}</Text> : null}
      {error ? <Text role="alert" p="3" borderRadius="md" bg="red.50" color="red.800">{error}</Text> : null}

      <Grid templateColumns={{ base: '1fr', lg: '1fr 1fr' }} gap="4">
        <Box p="5" borderWidth="1px" borderColor="governance.line" borderRadius="xl" bg="white">
          <Heading fontFamily="heading" fontSize="md" mb="3">{t('groups.createTitle')}</Heading>
          <HStack gap="2" flexWrap="wrap">
            <Input
              aria-label={t('groups.name')}
              value={newName}
              maxLength={80}
              onChange={(event) => setNewName(event.target.value)}
              placeholder={t('groups.name')}
              maxW="22rem"
            />
            <Button colorPalette="green" disabled={!newName.trim() || busy === 'create'} onClick={() => { void createGroup(); }}>
              <Plus size={16} aria-hidden="true" /> {t('groups.create')}
            </Button>
          </HStack>
        </Box>
        <Box p="5" borderWidth="1px" borderColor="governance.line" borderRadius="xl" bg="white">
          <Heading fontFamily="heading" fontSize="md" mb="3">{t('groups.joinTitle')}</Heading>
          <HStack gap="2" flexWrap="wrap">
            <Input
              aria-label={t('groups.inviteCode')}
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value)}
              placeholder={t('groups.inviteCodePlaceholder')}
              maxW="22rem"
            />
            <Button colorPalette="green" disabled={!joinCode.trim() || busy === 'join'} onClick={() => { void joinGroup(); }}>
              <LogIn size={16} aria-hidden="true" /> {t('groups.join')}
            </Button>
          </HStack>
        </Box>
      </Grid>

      {groups && groups.length === 0 ? (
        <Text color="governance.muted">{t('groups.empty')}</Text>
      ) : null}

      <Stack gap="5">
        {(groups ?? []).map((group) => {
          const detail = details[group.id];
          const groupProviders = providers[group.id] ?? [];
          const form = forms[group.id] ?? EMPTY_PROVIDER;
          const invite = issued[group.id];
          return (
            <Box key={group.id} p={{ base: '4', md: '6' }} borderWidth="1px" borderColor="governance.line" borderRadius="xl" bg="white">
              <Flex justify="space-between" align="center" gap="3" wrap="wrap" mb="3">
                <HStack gap="2">
                  <Users size={18} aria-hidden="true" />
                  <Heading fontFamily="heading" fontSize="lg">{group.name}</Heading>
                  <Badge colorPalette={group.role === 'OWNER' ? 'green' : 'gray'} variant="subtle">
                    {group.role === 'OWNER' ? t('groups.owner') : t('groups.member')}
                  </Badge>
                  <Badge colorPalette="gray" variant="subtle">{t('groups.memberCount', { count: group.memberCount })}</Badge>
                </HStack>
                <Button asChild size="sm" variant="outline">
                  <RouterLink to={`/account/agent-setup?group=${group.id}`}>
                    <KeyRound size={16} aria-hidden="true" /> {t('groups.myKey')}
                  </RouterLink>
                </Button>
              </Flex>

              {detail ? (
                <Table.ScrollArea mb="4">
                  <Table.Root native size="sm">
                    <Table.Header>
                      <Table.Row>
                        <Table.ColumnHeader>{t('groups.memberColumn')}</Table.ColumnHeader>
                        <Table.ColumnHeader>{t('groups.role')}</Table.ColumnHeader>
                        <Table.ColumnHeader>{t('groups.joinedAt')}</Table.ColumnHeader>
                        <Table.ColumnHeader>{t('groups.actions')}</Table.ColumnHeader>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {detail.members.map((member) => (
                        <Table.Row key={member.userId}>
                          <Table.Cell>
                            <Text fontWeight="semibold">{member.displayName || member.email}</Text>
                            <Text color="governance.muted" fontSize="xs">{member.email}</Text>
                          </Table.Cell>
                          <Table.Cell><Badge colorPalette={member.role === 'OWNER' ? 'green' : 'gray'} variant="subtle">{member.role}</Badge></Table.Cell>
                          <Table.Cell>{formatDateTime(member.joinedAt, '', 'local', true)}</Table.Cell>
                          <Table.Cell>
                            {group.role === 'OWNER' && member.role !== 'OWNER' ? (
                              <Button
                                size="xs"
                                variant="outline"
                                colorPalette="red"
                                disabled={busy === `member:${member.userId}`}
                                onClick={() => { void removeMember(group.id, member.userId); }}
                              >
                                <Trash2 size={14} aria-hidden="true" /> {t('groups.remove')}
                              </Button>
                            ) : (
                              <Text color="governance.muted" fontSize="xs">{t('groups.noActions')}</Text>
                            )}
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Root>
                </Table.ScrollArea>
              ) : null}

              {group.role === 'OWNER' ? (
                <Stack gap="4">
                  <Box p="4" borderRadius="lg" bg="governance.canvas">
                    <Flex justify="space-between" align="center" gap="3" wrap="wrap">
                      <Box>
                        <Text fontWeight="semibold" fontSize="sm">{t('groups.inviteTitle')}</Text>
                        <Text color="governance.muted" fontSize="xs">{t('groups.inviteDescription')}</Text>
                      </Box>
                      <Button size="sm" variant="outline" disabled={busy === `invite:${group.id}`} onClick={() => { void createInvite(group.id); }}>
                        <UserPlus size={16} aria-hidden="true" /> {t('groups.createInvite')}
                      </Button>
                    </Flex>
                    {invite ? (
                      <HStack mt="3" gap="2" flexWrap="wrap">
                        <Code flex="1 1 18rem" p="3" borderRadius="md" fontSize="sm" overflowWrap="anywhere">{invite.token}</Code>
                        <Button size="sm" onClick={() => { void copy(invite.token); }}><Copy size={16} aria-hidden="true" /> {t('groups.copy')}</Button>
                      </HStack>
                    ) : null}
                    {detail?.invites?.length ? (
                      <Stack mt="3" gap="1">
                        {detail.invites.filter((item) => !item.revokedAt).map((item) => (
                          <Flex key={item.id} justify="space-between" align="center" gap="2">
                            <Text fontSize="xs" color="governance.muted">
                              {item.tokenPrefix}… · {t('groups.uses', { uses: item.uses, max: item.maxUses === 0 ? '∞' : item.maxUses })}
                            </Text>
                            <Button size="xs" variant="ghost" colorPalette="red" onClick={() => { void revokeInvite(group.id, item.id); }}>
                              {t('groups.revoke')}
                            </Button>
                          </Flex>
                        ))}
                      </Stack>
                    ) : null}
                  </Box>

                  <Box p="4" borderRadius="lg" bg="governance.canvas">
                    <Text fontWeight="semibold" fontSize="sm" mb="1">{t('groups.providersTitle')}</Text>
                    <Text color="governance.muted" fontSize="xs" mb="3">{t('groups.providersDescription')}</Text>
                    {groupProviders.length ? (
                      <Stack mb="3" gap="1">
                        {groupProviders.map((item) => (
                          <Flex key={item.provider} justify="space-between" align="center" gap="2">
                            <Text fontSize="sm">{item.provider} · {item.accessKey ?? '—'} · {item.secretHint}</Text>
                            <Button size="xs" variant="ghost" colorPalette="red" onClick={() => { void deleteProvider(group.id, item.provider); }}>
                              {t('groups.remove')}
                            </Button>
                          </Flex>
                        ))}
                      </Stack>
                    ) : null}
                    <Grid templateColumns={{ base: '1fr', md: 'repeat(4, minmax(0, 1fr))' }} gap="2">
                      <Field.Root>
                        <Field.Label>{t('groups.provider')}</Field.Label>
                        <select
                          aria-label={t('groups.provider')}
                          value={form.provider}
                          onChange={(event) => setForms((current) => ({
                            ...current,
                            [group.id]: { ...form, provider: event.target.value as ProviderKind },
                          }))}
                          style={{ padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d2d6db' }}
                        >
                          <option value="LANGFUSE">{t('setup.langfuse')}</option>
                          <option value="LANGSMITH">{t('setup.langsmith')}</option>
                        </select>
                      </Field.Root>
                      <Field.Root>
                        <Field.Label>{t('groups.accessKey')}</Field.Label>
                        <Input
                          aria-label={t('groups.accessKey')}
                          value={form.accessKey}
                          disabled={form.provider === 'LANGSMITH'}
                          onChange={(event) => setForms((current) => ({
                            ...current,
                            [group.id]: { ...form, accessKey: event.target.value },
                          }))}
                          placeholder={t('groups.accessKeyPlaceholder')}
                        />
                      </Field.Root>
                      <Field.Root>
                        <Field.Label>{t('groups.secretKey')}</Field.Label>
                        <Input
                          aria-label={t('groups.secretKey')}
                          type="password"
                          autoComplete="off"
                          value={form.secretKey}
                          onChange={(event) => setForms((current) => ({
                            ...current,
                            [group.id]: { ...form, secretKey: event.target.value },
                          }))}
                        />
                      </Field.Root>
                      <Field.Root>
                        <Field.Label>&nbsp;</Field.Label>
                        <Button
                          colorPalette="green"
                          disabled={!form.secretKey || busy === `provider:${group.id}`}
                          onClick={() => { void saveProvider(group.id); }}
                        >
                          {t('groups.saveProvider')}
                        </Button>
                      </Field.Root>
                    </Grid>
                  </Box>
                </Stack>
              ) : null}
            </Box>
          );
        })}
      </Stack>

      <StepUpDialog
        open={stepUp}
        onCancel={() => { setStepUp(false); setPending(null); }}
        onConfirmed={() => {
          const action = pending;
          setStepUp(false);
          setPending(null);
          action?.run();
        }}
      />
    </Stack>
  );
}
