import { useEffect, useState } from 'react';
import { useAuthentication } from '../../AuthenticationContext';
import type { ModelUsage } from '../../api/Usage';
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

  return (
    <section className="usage-panel" aria-labelledby="usage-heading">
      <div className="timeline-heading">
        <div>
          <p className="section-eyebrow">Provider accounting</p>
          <h2 id="usage-heading">Model usage</h2>
        </div>
        {usage ? <span className="trace-count">{usage.length} calls</span> : null}
      </div>

      {loading ? <p role="status">Loading model usage…</p> : null}
      {error ? <p className="read-error" role="alert">{error}</p> : null}
      {!loading && !error && usage && usage.length === 0 ? (
        <p role="status">No model usage is reported for this trace.</p>
      ) : null}

      {usage && usage.length > 0 ? (
        <div className="usage-table-wrap">
          <table className="usage-table">
            <caption className="visually-hidden">Model usage by call</caption>
            <thead>
              <tr>
                <th scope="col">Model</th>
                <th scope="col">Input</th>
                <th scope="col">Output</th>
                <th scope="col">Cached</th>
                <th scope="col">Reasoning</th>
                <th scope="col">Total</th>
                <th scope="col">Cost</th>
                <th scope="col">Latency</th>
                <th scope="col">First byte</th>
                <th scope="col">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {usage.map((row) => (
                <tr key={row.id}>
                  <th scope="row">
                    <span>{modelLabel(row)}</span>
                    <small className="usage-subtle">
                      {row.stream ? 'stream' : 'non-stream'} · {row.provider ?? 'provider not reported'}
                    </small>
                    {row.finishReasons.length ? (
                      <small className="usage-subtle">finish: {row.finishReasons.join(', ')}</small>
                    ) : null}
                    {row.toolCallNames.length ? (
                      <small className="usage-subtle">tools: {row.toolCallNames.join(', ')}</small>
                    ) : null}
                    {row.errorCode || row.errorType ? (
                      <small className="usage-subtle usage-error">
                        {[row.errorType, row.errorCode].filter(Boolean).join(': ')}
                      </small>
                    ) : null}
                  </th>
                  <td>{tokens(row.inputTokens)}</td>
                  <td>{tokens(row.outputTokens)}</td>
                  <td>{tokens(row.cachedInputTokens)}</td>
                  <td>{tokens(row.reasoningOutputTokens)}</td>
                  <td>{tokens(row.totalTokens)}</td>
                  <td>
                    <span>{money(row.totalCostUsd, row.currency)}</span>
                    {row.providerReportedCostUsd !== null ? (
                      <small className="usage-subtle">
                        provider: {money(row.providerReportedCostUsd, row.currency)}
                      </small>
                    ) : null}
                  </td>
                  <td>{duration(row.durationMs)}</td>
                  <td>{duration(row.timeToFirstByteMs)}</td>
                  <td><StatusBadge value={row.outcome} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {usage?.some((row) => row.captureTruncated) ? (
        <p className="stale-note" role="note">
          At least one response exceeded the capture limit; token and cost values may be partial.
        </p>
      ) : null}
    </section>
  );
}
