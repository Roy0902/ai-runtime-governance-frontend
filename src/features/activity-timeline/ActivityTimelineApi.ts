import { apiRequest } from '../../ApplicationApiClient';
import type {
  ActivityEvent,
  ExecutionStatus,
  GuardOutcome,
  TraceDetail,
  TraceSummary,
} from './ActivityTimelineTypes';

interface PageDto<T> {
  items: T[];
  nextCursor: string | null;
}

interface EventMetadataDto {
  guardOutcome: GuardOutcome | null;
  outcome: GuardOutcome | null;
  ruleIds: string[];
  policyId: string | null;
  policyVersion: string | null;
  approvalId: string | null;
  state: 'requested' | 'approved' | 'rejected' | 'canceled' | 'expired' | null;
  name: string | null;
  status: ExecutionStatus | null;
}

interface ActivityEventDto {
  eventId: string;
  traceId: string;
  parentEventId: string | null;
  relationship: 'root' | 'linked' | 'unresolved';
  kind: 'prompt' | 'guard' | 'approval' | 'agent' | 'model' | 'tool';
  receivedAt: string;
  sourceAt: string | null;
  durationMs: number | null;
  identity: string | null;
  metadata: EventMetadataDto;
}

export interface LoadedPage<T> {
  items: T[];
  nextCursor: string | null;
}

function toActivityEvent(dto: ActivityEventDto): ActivityEvent {
  const base = {
    eventId: dto.eventId,
    traceId: dto.traceId,
    parentEventId: dto.parentEventId,
    relationship: dto.relationship,
    receivedAt: dto.receivedAt,
    sourceAt: dto.sourceAt,
    durationMs: dto.durationMs,
    identity: dto.identity,
  };

  switch (dto.kind) {
    case 'prompt':
      return {
        ...base,
        kind: 'prompt',
        metadata: {
          guardOutcome: dto.metadata.guardOutcome,
          ruleIds: dto.metadata.ruleIds,
        },
      };
    case 'guard':
      return {
        ...base,
        kind: 'guard',
        metadata: {
          outcome: dto.metadata.outcome,
          policyId: dto.metadata.policyId,
          policyVersion: dto.metadata.policyVersion,
          ruleIds: dto.metadata.ruleIds,
        },
      };
    case 'approval':
      return {
        ...base,
        kind: 'approval',
        metadata: {
          approvalId: dto.metadata.approvalId,
          state: dto.metadata.state,
        },
      };
    default:
      return {
        ...base,
        kind: dto.kind,
        metadata: {
          name: dto.metadata.name,
          status: dto.metadata.status,
        },
      };
  }
}

export async function fetchTracePage(cursor?: string | null): Promise<LoadedPage<TraceSummary>> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  return apiRequest<PageDto<TraceSummary>>(`/api/v1/traces${query}`);
}

export async function fetchTrace(traceId: string): Promise<TraceDetail> {
  return apiRequest<TraceDetail>(`/api/v1/traces/${encodeURIComponent(traceId)}`);
}

export async function fetchEventPage(
  traceId: string,
  cursor?: string | null,
): Promise<LoadedPage<ActivityEvent>> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  const page = await apiRequest<PageDto<ActivityEventDto>>(
    `/api/v1/traces/${encodeURIComponent(traceId)}/events${query}`,
  );
  return { items: page.items.map(toActivityEvent), nextCursor: page.nextCursor };
}
