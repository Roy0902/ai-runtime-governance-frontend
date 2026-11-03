import { Link, useParams } from 'react-router-dom';
import { ApiError } from '../../ApplicationApiClient';
import type { EventNode } from './ActivityTimelineModel';
import {
  formatTime,
  outcomeLabel,
  shortId,
  statusLabel,
  StatusBadge,
  TraceSummaryPanel,
} from './ActivityTimelinePresentation';
import type { ActivityEvent } from './ActivityTimelineTypes';
import { useTraceDetail } from './useActivityTimeline';

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

function eventHeading(event: ActivityEvent): string {
  switch (event.kind) {
    case 'prompt':
      return 'Prompt metadata';
    case 'guard':
      return 'Guard decision';
    case 'approval':
      return `Approval ${event.metadata.state ?? 'state not reported'}`;
    default:
      return event.metadata.name ?? `${event.kind} activity`;
  }
}

function eventState(event: ActivityEvent): string {
  switch (event.kind) {
    case 'prompt':
      return outcomeLabel(event.metadata.guardOutcome);
    case 'guard':
      return outcomeLabel(event.metadata.outcome);
    case 'approval':
      return event.metadata.state ?? 'Not reported';
    default:
      return statusLabel(event.metadata.status);
  }
}

function eventMetadata(event: ActivityEvent): string[] {
  switch (event.kind) {
    case 'prompt':
      return event.metadata.ruleIds.length
        ? [`Rules: ${event.metadata.ruleIds.join(', ')}`]
        : [];
    case 'guard':
      return [
        ...(event.metadata.policyId ? [`Policy: ${event.metadata.policyId}`] : []),
        ...(event.metadata.policyVersion ? [`Version: ${event.metadata.policyVersion}`] : []),
        ...(event.metadata.ruleIds.length ? [`Rules: ${event.metadata.ruleIds.join(', ')}`] : []),
      ];
    case 'approval':
      return event.metadata.approvalId ? [`Approval ID: ${shortId(event.metadata.approvalId)}`] : [];
    default:
      return event.metadata.name ? [`Reported name: ${event.metadata.name}`] : [];
  }
}

function EventCard({
  node,
  expanded,
  onToggle,
}: {
  node: EventNode;
  expanded: Set<string>;
  onToggle: (eventId: string) => void;
}) {
  const { event } = node;
  const open = expanded.has(event.eventId);

  return (
    <li className="timeline-node">
      <article className="event-card">
        <div className="event-card-top">
          <div>
            <span className={`event-kind event-kind-${event.kind}`}>{event.kind}</span>
            <h3>{eventHeading(event)}</h3>
          </div>
          <StatusBadge value={eventState(event)} />
        </div>

        {node.unresolved ? <p className="event-unlinked">Unlinked activity.</p> : null}
        {node.parentNotLoaded ? (
          <p className="event-unlinked">Parent event is not loaded in this page.</p>
        ) : null}

        <button
          className="event-toggle"
          type="button"
          aria-expanded={open}
          onClick={() => onToggle(event.eventId)}
        >
          {open ? `Collapse event ${event.eventId}` : `Expand event ${event.eventId}`}
        </button>

        {open ? (
          <dl className="event-details">
            <div>
              <dt>Received (UTC)</dt>
              <dd>{formatTime(event.receivedAt)}</dd>
            </div>
            <div>
              <dt>Source time (UTC)</dt>
              <dd>{formatTime(event.sourceAt)}</dd>
            </div>
            <div>
              <dt>Duration</dt>
              <dd>{event.durationMs === null ? 'Not reported' : `${event.durationMs} ms`}</dd>
            </div>
            {event.identity ? (
              <div>
                <dt>Reporter</dt>
                <dd>{event.identity}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}

        {open && eventMetadata(event).length ? (
          <ul className="event-metadata">
            {eventMetadata(event).map((value) => <li key={value}>{value}</li>)}
          </ul>
        ) : null}
      </article>

      {node.children.length ? (
        <ol className="timeline-children">
          {node.children.map((child) => (
            <EventCard key={child.event.eventId} node={child} expanded={expanded} onToggle={onToggle} />
          ))}
        </ol>
      ) : null}
    </li>
  );
}

export function ActivityTracePage() {
  const { traceId } = useParams<{ traceId: string }>();
  const {
    trace,
    events,
    tree,
    nextCursor,
    loading,
    pending,
    lastLoaded,
    error,
    expanded,
    toggle,
    refresh,
    loadMore,
  } = useTraceDetail(traceId);
  const failure = error ? failureCopy(error) : null;
  const approvals = events.filter(
    (event): event is Extract<ActivityEvent, { kind: 'approval' }> =>
      !('tombstone' in event) && event.kind === 'approval',
  );

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
        <div className="activity-actions">
          <Link className="button-secondary" to="/activity">Back to traces</Link>
          <button className="button-secondary" type="button" onClick={refresh} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>

      {loading && !trace ? <p role="status">Loading activity…</p> : null}

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

      {failure && trace ? (
        <p className="stale-note" role="note">
          Showing the last loaded activity; refresh failed.
        </p>
      ) : null}

      {trace ? <TraceSummaryPanel trace={trace} /> : null}

      {trace && approvals.length ? (
        <section className="approval-panel" aria-labelledby="approval-heading">
          <div className="panel-heading">
            <div>
              <p className="section-eyebrow">Reported resolutions</p>
              <h2 id="approval-heading">Approval history</h2>
            </div>
          </div>
          <ul className="approval-list">
            {approvals.map((approval) => (
              <li key={approval.eventId}>
                <span>Approval {shortId(approval.eventId)}</span>
                <strong>{approval.metadata.state ?? 'Not reported'}</strong>
                <span>
                  {approval.metadata.approvalId
                    ? `ID ${shortId(approval.metadata.approvalId)}`
                    : 'ID not reported'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {trace ? (
        <section className="timeline-panel" aria-labelledby="timeline-heading">
          <div className="timeline-heading">
            <div>
              <p className="section-eyebrow">Receipt order · sibling events</p>
              <h2 id="timeline-heading">Timeline</h2>
            </div>
            <span className="event-count">
              {events.length} event{events.length === 1 ? '' : 's'}
            </span>
          </div>
          <p className="timeline-explainer">
            Events are ordered by server receipt time within each parent group. Producer-reported
            source time is shown separately.
          </p>
          <p className="activity-status" role="status">
            {pending
              ? 'Loading more activity…'
              : lastLoaded !== null
                ? `Loaded ${lastLoaded} more event${lastLoaded === 1 ? '' : 's'}.`
                : ''}
          </p>

          {tree.roots.length ? (
            <ol className="timeline-roots" aria-label="Activity events">
              {tree.roots.map((node) => (
                <EventCard
                  key={node.event.eventId}
                  node={node}
                  expanded={expanded}
                  onToggle={toggle}
                />
              ))}
            </ol>
          ) : (
            <p className="empty-timeline">No activity is reported for this trace.</p>
          )}

          {tree.unavailable.length ? (
            <section className="unavailable-panel" aria-label="Unavailable event details">
              <h3>Unavailable event details</h3>
              <p>The event was reported, but its metadata is no longer available.</p>
              <ul>
                {tree.unavailable.map((item) => (
                  <li key={item.eventId} className="unavailable-event">
                    <span className="unavailable-marker" aria-hidden="true">—</span>
                    <span>Event details unavailable</span>
                    <code>{shortId(item.eventId)}</code>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {events.length > 0 ? (
            <button
              className="load-more-button"
              type="button"
              onClick={loadMore}
              aria-disabled={pending || !nextCursor}
            >
              {pending
                ? 'Loading more activity…'
                : nextCursor ? 'Load more events' : 'All events loaded'}
            </button>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
