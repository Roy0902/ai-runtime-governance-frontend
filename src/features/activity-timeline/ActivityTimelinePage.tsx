import { useMemo, useState } from 'react';
import { buildEventTree, type EventNode } from './ActivityTimelineModel';
import { fixtureEvents, fixtureTraceDetails, fixtureTraces } from './ActivityTimelineFixtures';
import type {
  ActivityEvent,
  GuardOutcome,
  EventTombstone,
  TraceDetail,
  TraceSummary,
} from './ActivityTimelineTypes';

const INITIAL_TRACE_COUNT = 2;
const INITIAL_EVENT_COUNT = 4;

function formatTime(value: string | null): string {
  return value
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'medium',
        timeZone: 'UTC',
      }).format(new Date(value)) + ' UTC'
    : 'Not reported';
}

function statusLabel(value: string | null): string {
  return value ? value.replaceAll('_', ' ') : 'Not reported';
}

function shortId(value: string): string {
  return value.slice(-8);
}

function outcomeLabel(value: GuardOutcome | null): string {
  return value ? value.replaceAll('_', ' ') : 'No guard outcome reported';
}

function eventHeading(event: ActivityEvent): string {
  switch (event.kind) {
    case 'prompt':
      return 'Prompt metadata';
    case 'guard':
      return 'Guard decision';
    case 'approval':
      return `Approval ${event.metadata.state}`;
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
      return event.metadata.state;
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
      return [`Approval ID: ${shortId(event.metadata.approvalId)}`];
    default:
      return event.metadata.name ? [`Reported name: ${event.metadata.name}`] : [];
  }
}

function StatusBadge({ value, label }: { value: string | null; label?: string }) {
  const normalized = value?.replaceAll('_', '-') ?? 'unknown';
  return <span className={`status-badge status-${normalized}`}>{label ?? statusLabel(value)}</span>;
}

function TraceRow({
  trace,
  selected,
  onSelect,
}: {
  trace: TraceSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      className={`trace-row${selected ? ' trace-row-selected' : ''}`}
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
    >
      <span className="trace-row-heading">
        <span className="trace-id">Trace {shortId(trace.traceId)}</span>
        <StatusBadge value={trace.executionStatus} />
      </span>
      <span className="trace-row-time">{formatTime(trace.receivedAt)}</span>
      <span className="trace-row-meta">
        <span>{outcomeLabel(trace.guardOutcome)}</span>
        <span>{statusLabel(trace.telemetryStatus)} telemetry</span>
      </span>
    </button>
  );
}

function EventCard({ node }: { node: EventNode }) {
  const { event } = node;
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
        {node.unlinked ? (
          <p className="event-unlinked">
            Unlinked activity. Its reported parent is not available in this loaded page.
          </p>
        ) : null}
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
        {eventMetadata(event).length ? (
          <ul className="event-metadata">
            {eventMetadata(event).map((value) => <li key={value}>{value}</li>)}
          </ul>
        ) : null}
      </article>
      {node.children.length ? (
        <ol className="timeline-children">
          {node.children.map((child) => <EventCard key={child.event.eventId} node={child} />)}
        </ol>
      ) : null}
    </li>
  );
}

function UnavailableEvent({ event }: { event: EventTombstone }) {
  return (
    <li className="unavailable-event">
      <span className="unavailable-marker" aria-hidden="true">—</span>
      <span>Event details unavailable</span>
      <code>{shortId(event.eventId)}</code>
    </li>
  );
}

function TraceDetails({ trace }: { trace: TraceDetail }) {
  return (
    <section className="trace-summary-panel" aria-label="Trace summary">
      <div className="trace-summary-heading">
        <div>
          <p className="section-eyebrow">Selected trace</p>
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
      <div className="coverage-grid" aria-label="Reported integration coverage">
        <div><span>Input</span><strong>{statusLabel(trace.coverage.input)}</strong></div>
        <div><span>Response</span><strong>{statusLabel(trace.coverage.response)}</strong></div>
        <div><span>Tools</span><strong>{statusLabel(trace.coverage.tools)}</strong></div>
      </div>
      {trace.loss ? (
        <p className="loss-note" role="note">
          Telemetry loss reported: {trace.loss.causeCode ?? 'cause unknown'}
          {trace.loss.missingCount === null ? '' : ` · ${trace.loss.missingCount} event(s) reported missing`}
          {trace.loss.from ? ` · from ${formatTime(trace.loss.from)}` : ''}
          {trace.loss.to ? ` · to ${formatTime(trace.loss.to)}` : ''}
        </p>
      ) : null}
    </section>
  );
}

export function ActivityTimelinePage() {
  const [selectedTraceId, setSelectedTraceId] = useState(fixtureTraces[0].traceId);
  const [visibleTraceCount, setVisibleTraceCount] = useState(INITIAL_TRACE_COUNT);
  const [visibleEventCount, setVisibleEventCount] = useState(INITIAL_EVENT_COUNT);
  const [notice, setNotice] = useState('');
  const selectedTrace = fixtureTraceDetails[selectedTraceId] ?? fixtureTraceDetails[fixtureTraces[0].traceId];
  const traceItems = fixtureEvents[selectedTraceId] ?? [];
  const visibleItems = traceItems.slice(0, visibleEventCount);
  const eventTree = useMemo(() => buildEventTree(visibleItems), [visibleItems]);

  function selectTrace(traceId: string) {
    setSelectedTraceId(traceId);
    setVisibleEventCount(INITIAL_EVENT_COUNT);
  }

  function resetPreview() {
    setSelectedTraceId(fixtureTraces[0].traceId);
    setVisibleTraceCount(INITIAL_TRACE_COUNT);
    setVisibleEventCount(INITIAL_EVENT_COUNT);
    setNotice('Preview reset. No live service request was made.');
  }

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
        <button className="button-secondary" type="button" onClick={resetPreview}>
          Reset preview
        </button>
      </div>

      <div className="fixture-banner" role="note">
        <span className="fixture-dot" aria-hidden="true" />
        <div>
          <strong>Synthetic fixture preview</strong>
          <p>This data is illustrative only. It is not connected to the service or a real account trace.</p>
        </div>
      </div>
      {notice ? <p className="preview-notice" role="status">{notice}</p> : null}

      <div className="activity-layout">
        <aside className="trace-panel" aria-label="Trace list">
          <div className="panel-heading">
            <div>
              <p className="section-eyebrow">Recent activity</p>
              <h2>Traces</h2>
            </div>
            <span className="trace-count">{fixtureTraces.length} fixtures</span>
          </div>
          <div className="trace-list">
            {fixtureTraces.slice(0, visibleTraceCount).map((trace) => (
              <TraceRow
                key={trace.traceId}
                trace={trace}
                selected={trace.traceId === selectedTraceId}
                onSelect={() => selectTrace(trace.traceId)}
              />
            ))}
          </div>
          {visibleTraceCount < fixtureTraces.length ? (
            <button
              className="load-more-button"
              type="button"
              onClick={() => setVisibleTraceCount(fixtureTraces.length)}
            >
              Load more traces
            </button>
          ) : null}
        </aside>

        <div className="trace-workspace">
          <TraceDetails trace={selectedTrace} />
          <section className="timeline-panel" aria-labelledby="timeline-heading">
            <div className="timeline-heading">
              <div>
                <p className="section-eyebrow">Receipt order · sibling events</p>
                <h2 id="timeline-heading">Timeline</h2>
              </div>
              <span className="event-count">
                {visibleItems.length} of {traceItems.length} items
              </span>
            </div>
            <p className="timeline-explainer">
              Events are ordered by server receipt time within each parent group. Producer-reported source time is shown separately.
            </p>
            {eventTree.roots.length ? (
              <ol className="timeline-roots">
                {eventTree.roots.map((node) => <EventCard key={node.event.eventId} node={node} />)}
              </ol>
            ) : null}
            {eventTree.unavailable.length ? (
              <section className="unavailable-panel" aria-label="Unavailable event details">
                <h3>Unavailable event details</h3>
                <p>The event was reported, but its metadata is not available in this page.</p>
                <ul>
                  {eventTree.unavailable.map((event) => (
                    <UnavailableEvent key={event.eventId} event={event} />
                  ))}
                </ul>
              </section>
            ) : null}
            {!eventTree.roots.length && !eventTree.unavailable.length ? (
              <p className="empty-timeline">No activity is included in this fixture.</p>
            ) : null}
            {visibleEventCount < traceItems.length ? (
              <button
                className="load-more-button"
                type="button"
                onClick={() => setVisibleEventCount(traceItems.length)}
              >
                Load more activity
              </button>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}
