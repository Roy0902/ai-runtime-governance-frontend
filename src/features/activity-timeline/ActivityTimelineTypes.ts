export type ExecutionStatus = 'running' | 'completed' | 'failed' | 'canceled' | 'unknown';
export type TelemetryStatus = 'complete' | 'incomplete' | 'unknown' | 'unsupported';
export type GuardOutcome = 'allow' | 'deny' | 'redact' | 'require_approval';

export interface TraceSummary {
  traceId: string;
  receivedAt: string;
  executionStatus: ExecutionStatus;
  telemetryStatus: TelemetryStatus;
  guardOutcome: GuardOutcome | null;
}

export interface TraceDetail extends TraceSummary {
  identity: string | null;
  coverage: {
    input: 'guarded' | 'bypassed' | 'unknown' | 'unsupported' | 'degraded';
    response: 'observed' | 'unknown' | 'unsupported' | 'degraded';
    tools: 'observed' | 'unknown' | 'unsupported' | 'degraded';
  };
  loss: {
    causeCode: string | null;
    missingCount: number | null;
    from: string | null;
    to: string | null;
  } | null;
}

export interface PromptMetadata {
  guardOutcome: GuardOutcome | null;
  ruleIds: string[];
}

export interface GuardMetadata {
  outcome: GuardOutcome | null;
  policyId: string | null;
  policyVersion: string | null;
  ruleIds: string[];
}

export interface ApprovalMetadata {
  approvalId: string | null;
  state: 'requested' | 'approved' | 'rejected' | 'canceled' | 'expired' | null;
}

export interface ObservedMetadata {
  name: string | null;
  status: ExecutionStatus | null;
}

interface ActivityEventBase {
  eventId: string;
  traceId: string;
  parentEventId: string | null;
  relationship: 'root' | 'linked' | 'unresolved';
  receivedAt: string;
  sourceAt: string | null;
  durationMs: number | null;
  identity: string | null;
}

export type ActivityEvent =
  | (ActivityEventBase & { kind: 'prompt'; metadata: PromptMetadata })
  | (ActivityEventBase & { kind: 'guard'; metadata: GuardMetadata })
  | (ActivityEventBase & { kind: 'approval'; metadata: ApprovalMetadata })
  | (ActivityEventBase & {
      kind: 'agent' | 'model' | 'tool';
      metadata: ObservedMetadata;
    });

export interface EventTombstone {
  tombstone: true;
  eventId: string;
}

export type ActivityTimelineItem = ActivityEvent | EventTombstone;
