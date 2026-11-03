import type { ActivityEvent, EventTombstone, TraceDetail, TraceSummary } from './ActivityTimelineTypes';

const primaryTraceId = '6f670000-0000-4000-8000-000000000001';
const deniedTraceId = '6f670000-0000-4000-8000-000000000002';
const runningTraceId = '6f670000-0000-4000-8000-000000000003';
const unsupportedTraceId = '6f670000-0000-4000-8000-000000000004';

export const fixtureTraces: TraceSummary[] = [
  {
    traceId: primaryTraceId,
    receivedAt: '2026-11-03T05:42:18.220Z',
    executionStatus: 'completed',
    telemetryStatus: 'incomplete',
    guardOutcome: 'require_approval',
  },
  {
    traceId: deniedTraceId,
    receivedAt: '2026-11-03T05:37:05.004Z',
    executionStatus: 'completed',
    telemetryStatus: 'complete',
    guardOutcome: 'deny',
  },
  {
    traceId: runningTraceId,
    receivedAt: '2026-11-03T05:29:41.781Z',
    executionStatus: 'running',
    telemetryStatus: 'unknown',
    guardOutcome: null,
  },
  {
    traceId: unsupportedTraceId,
    receivedAt: '2026-11-03T05:17:12.050Z',
    executionStatus: 'canceled',
    telemetryStatus: 'unsupported',
    guardOutcome: 'redact',
  },
];

export const fixtureTraceDetails: Record<string, TraceDetail> = {
  [primaryTraceId]: {
    ...fixtureTraces[0],
    identity: 'Local agent session',
    coverage: { input: 'guarded', response: 'observed', tools: 'degraded' },
    loss: {
      causeCode: 'TOOL_EVENT_GAP',
      missingCount: 1,
      from: '2026-11-03T05:42:20.010Z',
      to: '2026-11-03T05:42:20.010Z',
    },
  },
  [deniedTraceId]: {
    ...fixtureTraces[1],
    identity: 'Local agent session',
    coverage: { input: 'guarded', response: 'unknown', tools: 'unknown' },
    loss: null,
  },
  [runningTraceId]: {
    ...fixtureTraces[2],
    identity: null,
    coverage: { input: 'bypassed', response: 'observed', tools: 'unsupported' },
    loss: null,
  },
  [unsupportedTraceId]: {
    ...fixtureTraces[3],
    identity: 'Local agent session',
    coverage: { input: 'degraded', response: 'unknown', tools: 'unsupported' },
    loss: null,
  },
};

const primaryEvents: ActivityEvent[] = [
  {
    eventId: 'a0000001-0000-4000-8000-000000000001',
    traceId: primaryTraceId,
    parentEventId: null,
    relationship: 'root',
    kind: 'agent',
    receivedAt: '2026-11-03T05:42:18.221Z',
    sourceAt: '2026-11-03T05:42:18.190Z',
    durationMs: null,
    identity: 'Local agent session',
    metadata: { name: 'Agent turn', status: 'completed' },
  },
  {
    eventId: 'a0000002-0000-4000-8000-000000000002',
    traceId: primaryTraceId,
    parentEventId: 'a0000001-0000-4000-8000-000000000001',
    relationship: 'linked',
    kind: 'prompt',
    receivedAt: '2026-11-03T05:42:18.224Z',
    sourceAt: '2026-11-03T05:42:18.200Z',
    durationMs: null,
    identity: null,
    metadata: { guardOutcome: 'require_approval', ruleIds: ['injection-indicator'] },
  },
  {
    eventId: 'a0000003-0000-4000-8000-000000000003',
    traceId: primaryTraceId,
    parentEventId: 'a0000002-0000-4000-8000-000000000002',
    relationship: 'linked',
    kind: 'guard',
    receivedAt: '2026-11-03T05:42:18.231Z',
    sourceAt: '2026-11-03T05:42:18.205Z',
    durationMs: 7,
    identity: 'Guard service',
    metadata: {
      outcome: 'require_approval',
      policyId: 'default-policy',
      policyVersion: '1',
      ruleIds: ['injection-indicator'],
    },
  },
  {
    eventId: 'a0000004-0000-4000-8000-000000000004',
    traceId: primaryTraceId,
    parentEventId: 'a0000003-0000-4000-8000-000000000003',
    relationship: 'linked',
    kind: 'approval',
    receivedAt: '2026-11-03T05:42:18.245Z',
    sourceAt: null,
    durationMs: null,
    identity: 'Approval service',
    metadata: {
      approvalId: 'b0000001-0000-4000-8000-000000000001',
      state: 'requested',
    },
  },
  {
    eventId: 'a0000005-0000-4000-8000-000000000005',
    traceId: primaryTraceId,
    parentEventId: 'a0000003-0000-4000-8000-000000000003',
    relationship: 'linked',
    kind: 'approval',
    receivedAt: '2026-11-03T05:42:19.810Z',
    sourceAt: null,
    durationMs: null,
    identity: 'Approval service',
    metadata: {
      approvalId: 'b0000001-0000-4000-8000-000000000001',
      state: 'approved',
    },
  },
  {
    eventId: 'a0000006-0000-4000-8000-000000000006',
    traceId: primaryTraceId,
    parentEventId: 'a0000001-0000-4000-8000-000000000001',
    relationship: 'linked',
    kind: 'model',
    receivedAt: '2026-11-03T05:42:19.900Z',
    sourceAt: '2026-11-03T05:42:19.870Z',
    durationMs: 860,
    identity: 'Model gateway',
    metadata: { name: 'Model response', status: 'completed' },
  },
  {
    eventId: 'a0000007-0000-4000-8000-000000000007',
    traceId: primaryTraceId,
    parentEventId: 'a0000006-0000-4000-8000-000000000006',
    relationship: 'linked',
    kind: 'tool',
    receivedAt: '2026-11-03T05:42:20.010Z',
    sourceAt: null,
    durationMs: null,
    identity: 'Tool reporter',
    metadata: { name: 'Tool activity not reported', status: 'unknown' },
  },
];

const deniedEvents: ActivityEvent[] = [
  {
    eventId: 'c0000001-0000-4000-8000-000000000001',
    traceId: deniedTraceId,
    parentEventId: null,
    relationship: 'root',
    kind: 'prompt',
    receivedAt: '2026-11-03T05:37:05.005Z',
    sourceAt: '2026-11-03T05:37:04.990Z',
    durationMs: null,
    identity: null,
    metadata: { guardOutcome: 'deny', ruleIds: ['restricted-action'] },
  },
  {
    eventId: 'c0000002-0000-4000-8000-000000000002',
    traceId: deniedTraceId,
    parentEventId: 'c0000001-0000-4000-8000-000000000001',
    relationship: 'linked',
    kind: 'guard',
    receivedAt: '2026-11-03T05:37:05.011Z',
    sourceAt: null,
    durationMs: 6,
    identity: 'Guard service',
    metadata: {
      outcome: 'deny',
      policyId: 'default-policy',
      policyVersion: '1',
      ruleIds: ['restricted-action'],
    },
  },
];

const runningEvents: ActivityEvent[] = [
  {
    eventId: 'd0000001-0000-4000-8000-000000000001',
    traceId: runningTraceId,
    parentEventId: null,
    relationship: 'root',
    kind: 'agent',
    receivedAt: '2026-11-03T05:29:41.782Z',
    sourceAt: null,
    durationMs: null,
    identity: null,
    metadata: { name: null, status: 'running' },
  },
];

const unsupportedEvents: ActivityEvent[] = [
  {
    eventId: 'e0000001-0000-4000-8000-000000000001',
    traceId: unsupportedTraceId,
    parentEventId: 'e0000000-0000-4000-8000-000000000000',
    relationship: 'unresolved',
    kind: 'tool',
    receivedAt: '2026-11-03T05:17:12.051Z',
    sourceAt: null,
    durationMs: null,
    identity: null,
    metadata: { name: 'Unlinked tool activity', status: 'unknown' },
  },
];

const primaryTombstone: EventTombstone = {
  tombstone: true,
  eventId: 'a0000008-0000-4000-8000-000000000008',
};

export const fixtureEvents: Record<string, (ActivityEvent | EventTombstone)[]> = {
  [primaryTraceId]: [...primaryEvents, primaryTombstone],
  [deniedTraceId]: deniedEvents,
  [runningTraceId]: runningEvents,
  [unsupportedTraceId]: unsupportedEvents,
};
