import { Link } from 'react-router-dom';
import { ApiError } from '../../ApplicationApiClient';
import {
  formatTime,
  outcomeLabel,
  statusLabel,
  StatusBadge,
} from './ActivityTimelinePresentation';
import { useTraceList } from './useActivityTimeline';

function failureCopy(error: unknown): { message: string; signIn: boolean } {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return { message: 'Sign in to view activity.', signIn: true };
    }
    if (error.status === 404) {
      return { message: 'Trace is unavailable.', signIn: false };
    }
  }
  return { message: 'Activity could not be loaded.', signIn: false };
}

export function ActivityTracesPage() {
  const { items, nextCursor, loading, pending, error, refresh, loadMore } = useTraceList();
  const failure = error ? failureCopy(error) : null;

  return (
    <main className="activity-main">
      <div className="activity-heading">
        <div>
          <p className="section-eyebrow">Observability</p>
          <h1>Activity</h1>
          <p className="activity-intro">
            Inspect reported agent, model, tool, guard, and approval activity without exposing payloads.
          </p>
        </div>
        <button className="button-secondary" type="button" onClick={refresh} disabled={loading}>
          Refresh
        </button>
      </div>

      <section className="trace-panel" aria-labelledby="traces-heading">
        <div className="panel-heading">
          <div>
            <p className="section-eyebrow">Recent activity</p>
            <h2 id="traces-heading">Traces</h2>
          </div>
          <span className="trace-count">{items.length} traces</span>
        </div>

        {loading ? <p role="status">Loading activity…</p> : null}

        {failure ? (
          <p className="read-error" role="alert">
            {failure.message}{' '}
            {failure.signIn ? (
              <Link to="/sign-in">Sign in</Link>
            ) : (
              <button className="button-secondary" type="button" onClick={refresh}>Try again</button>
            )}
          </p>
        ) : null}

        {!loading && !failure && items.length === 0 ? (
          <p role="status">No traces recorded.</p>
        ) : null}

        {!failure && items.length > 0 ? (
          <ul className="trace-list" aria-label="Traces">
            {items.map((trace) =>
              'tombstone' in trace ? (
                <li key={trace.traceId} className="trace-tombstone">
                  Trace unavailable
                </li>
              ) : (
                <li key={trace.traceId}>
                  <Link
                    className="trace-row"
                    to={`/activity/${trace.traceId}`}
                    aria-label={`Open trace ${trace.traceId}`}
                  >
                    <span className="trace-row-heading">
                      <span className="trace-id">Trace {trace.traceId.slice(-8)}</span>
                      <StatusBadge value={trace.executionStatus} />
                    </span>
                    <span className="trace-row-time">{formatTime(trace.receivedAt)}</span>
                    <span className="trace-row-meta">
                      <span>{outcomeLabel(trace.guardOutcome)}</span>
                      <span>{statusLabel(trace.telemetryStatus)} telemetry</span>
                    </span>
                  </Link>
                </li>
              ),
            )}
          </ul>
        ) : null}

        {nextCursor ? (
          <button className="load-more-button" type="button" onClick={loadMore} disabled={pending}>
            {pending ? 'Loading more activity…' : 'Load more traces'}
          </button>
        ) : null}
      </section>
    </main>
  );
}
