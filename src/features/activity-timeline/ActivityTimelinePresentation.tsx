import type { GuardOutcome, TraceDetail } from './ActivityTimelineTypes';

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
  return <span className={`status-badge status-${normalized}`}>{label ?? statusLabel(value)}</span>;
}

export function TraceSummaryPanel({ trace }: { trace: TraceDetail }) {
  return (
    <section className="trace-summary-panel" aria-label="Trace summary">
      <div className="trace-summary-heading">
        <div>
          <p className="section-eyebrow">Trace</p>
          <h2>{trace.identity ?? 'Identity not reported'}</h2>
          <code>Trace {trace.traceId}</code>
        </div>
        <StatusBadge value={trace.executionStatus} />
      </div>
      <div className="summary-grid">
        <div className="summary-cell">
          <span>Execution</span>
          <strong>{statusLabel(trace.executionStatus)}</strong>
        </div>
        <div className="summary-cell">
          <span>Telemetry</span>
          <strong>{statusLabel(trace.telemetryStatus)}</strong>
        </div>
        <div className="summary-cell">
          <span>Prompt guard</span>
          <strong>{outcomeLabel(trace.guardOutcome)}</strong>
        </div>
        <div className="summary-cell">
          <span>Received (UTC)</span>
          <strong>{formatTime(trace.receivedAt)}</strong>
        </div>
      </div>
      <section className="coverage-grid" aria-label="Reported integration coverage">
        <div><span>Input</span><strong>{statusLabel(trace.coverage.input)}</strong></div>
        <div><span>Response</span><strong>{statusLabel(trace.coverage.response)}</strong></div>
        <div><span>Tools</span><strong>{statusLabel(trace.coverage.tools)}</strong></div>
      </section>
      {trace.loss ? (
        <section className="loss-details" aria-label="Loss extent">
          <h3>Telemetry loss</h3>
          <dl>
            <div>
              <dt>Loss cause</dt>
              <dd>{trace.loss.causeCode ?? 'Unknown'}</dd>
            </div>
            <div>
              <dt>Missing events</dt>
              <dd>{trace.loss.missingCount === null ? 'Unknown' : trace.loss.missingCount}</dd>
            </div>
            <div>
              <dt>Missing time range</dt>
              <dd>
                {trace.loss.from || trace.loss.to
                  ? `${formatTime(trace.loss.from)} to ${formatTime(trace.loss.to)}`
                  : 'Unknown'}
              </dd>
            </div>
          </dl>
        </section>
      ) : null}
    </section>
  );
}
