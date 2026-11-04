import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
    <main className="activity-main gateway-main">
      <div className="activity-heading">
        <div>
          <p className="section-eyebrow">Access</p>
          <h1>Gateway keys</h1>
          <p className="activity-intro">
            Create a key for an agent, point the agent at the gateway base URL, and route model
            traffic through the guarded endpoint. The upstream provider key stays on the server.
          </p>
        </div>
        <button className="button-secondary" type="button" onClick={() => { void load(); }} disabled={loading}>
          Refresh
        </button>
      </div>

      <p>
        <Link to="/account">Back to account</Link>
      </p>

      {!entitled ? (
        <p className="notice notice-warning" role="status">
          Gateway access is not granted for this account. You can view and revoke existing keys,
          but a host operator must grant gateway permission before new keys can be created.
        </p>
      ) : null}

      <section className="gateway-panel" aria-labelledby="usage-summary-heading">
        <div className="panel-heading">
          <div>
            <p className="section-eyebrow">Last 30 days</p>
            <h2 id="usage-summary-heading">Usage</h2>
          </div>
        </div>
        {usageError ? (
          <p className="usage-subtle" role="status">Usage summary is unavailable.</p>
        ) : null}
        {usageSummary ? (
          <>
            <div className="usage-summary-grid">
              <div>
                <span>Calls</span>
                <strong>{formatTokens(usageSummary.calls)}</strong>
              </div>
              <div>
                <span>Input tokens</span>
                <strong>{formatTokens(usageSummary.inputTokens)}</strong>
              </div>
              <div>
                <span>Output tokens</span>
                <strong>{formatTokens(usageSummary.outputTokens)}</strong>
              </div>
              <div>
                <span>Total tokens</span>
                <strong>{formatTokens(usageSummary.totalTokens)}</strong>
              </div>
              <div>
                <span>Estimated cost</span>
                <strong>{formatCost(usageSummary.totalCostUsd, usageSummary.currency)}</strong>
              </div>
            </div>
            <p className="usage-subtle">
              Cost is shown only when the deployment has a price configured for the model.
            </p>
          </>
        ) : null}
      </section>

      <section className="gateway-panel" aria-labelledby="create-key-heading">
        <div className="panel-heading">
          <div>
            <p className="section-eyebrow">New key</p>
            <h2 id="create-key-heading">Create a gateway key</h2>
          </div>
        </div>
        <form
          className="gateway-create-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!entitled || creating) {
              return;
            }
            void create(name.trim() || 'default');
          }}
        >
          <label>
            Key name
            <input
              aria-label="Key name"
              value={name}
              maxLength={64}
              onChange={(event) => setName(event.target.value)}
              placeholder="laptop"
            />
          </label>
          <button type="submit" disabled={!entitled || creating}>
            {creating ? 'Creating…' : 'Create key'}
          </button>
        </form>
        <p className="gateway-help">
          Use 1–64 letters, digits, spaces, dots, underscores or hyphens. Up to five active keys
          are allowed per account.
        </p>
      </section>

      {status ? <p className="notice notice-success" role="status">{status}</p> : null}
      {error ? <p className="read-error" role="alert">{error}</p> : null}
      {copyStatus ? <p className="activity-status" role="status">{copyStatus}</p> : null}

      {created ? (
        <section className="gateway-panel gateway-secret" aria-labelledby="new-key-heading">
          <div className="panel-heading">
            <div>
              <p className="section-eyebrow">Shown once</p>
              <h2 id="new-key-heading">New key: {created.name}</h2>
            </div>
            <button className="button-secondary" type="button" onClick={() => setCreated(null)}>
              Hide
            </button>
          </div>
          <p className="notice notice-warning" role="alert">
            This token is shown once. Copy it now; it cannot be retrieved later.
          </p>

          <div className="gateway-secret-row">
            <output aria-label="Gateway key">{created.token}</output>
            <button type="button" onClick={() => { void copy(created.token, 'Gateway key'); }}>
              Copy key
            </button>
          </div>

          <dl className="gateway-meta">
            <div>
              <dt>Base URL</dt>
              <dd><code>{created.baseUrl}</code></dd>
            </div>
            <div>
              <dt>Chat endpoint</dt>
              <dd><code>{created.baseUrl}{created.chatCompletionsPath}</code></dd>
            </div>
            <div>
              <dt>Models</dt>
              <dd>{created.models.length > 0 ? created.models.join(', ') : 'No models configured'}</dd>
            </div>
          </dl>

          <h3>OpenCode</h3>
          <pre className="gateway-snippet">{created.openCodeConfig}</pre>
          <button type="button" onClick={() => { void copy(created.openCodeConfig, 'OpenCode config'); }}>
            Copy OpenCode config
          </button>

          <h3>VS Code Copilot BYOK</h3>
          <pre className="gateway-snippet">{created.vsCodeConfig}</pre>
          <button type="button" onClick={() => { void copy(created.vsCodeConfig, 'VS Code config'); }}>
            Copy VS Code config
          </button>
        </section>
      ) : null}

      <section className="gateway-panel" aria-labelledby="keys-heading">
        <div className="panel-heading">
          <div>
            <p className="section-eyebrow">Existing keys</p>
            <h2 id="keys-heading">Keys</h2>
          </div>
          <span className="trace-count">{keys?.length ?? 0} keys</span>
        </div>

        {loading ? <p role="status">Loading keys…</p> : null}
        {listError ? (
          <p className="read-error" role="alert">
            {listError}{' '}
            <button className="button-secondary" type="button" onClick={() => { void load(); }}>
              Try again
            </button>
          </p>
        ) : null}
        {!loading && !listError && keys && keys.length === 0 ? (
          <p role="status">No gateway keys yet.</p>
        ) : null}

        {keys && keys.length > 0 ? (
          <div className="gateway-table-wrap">
            <table className="gateway-key-table">
              <caption className="visually-hidden">Gateway keys</caption>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Prefix</th>
                  <th scope="col">Created</th>
                  <th scope="col">Last used</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((key) => (
                  <tr key={key.id}>
                    <th scope="row">{key.name}</th>
                    <td><code>{key.tokenPrefix}…</code></td>
                    <td>{formatDate(key.createdAt)}</td>
                    <td>{formatDate(key.lastUsedAt)}</td>
                    <td>{key.revokedAt ? 'Revoked' : 'Active'}</td>
                    <td>
                      {key.revokedAt ? (
                        <span className="gateway-muted">No actions</span>
                      ) : pendingRevoke?.id === key.id ? (
                        <span className="gateway-actions">
                          <button type="button" onClick={() => { void revoke(key.id, key.name); }}>
                            Confirm revoke
                          </button>
                          <button
                            className="button-secondary"
                            type="button"
                            onClick={() => setPendingRevoke(null)}
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          className="button-secondary"
                          type="button"
                          onClick={() => setPendingRevoke({ id: key.id, name: key.name })}
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

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
    </main>
  );
}
