import { apiRequest } from '../../ApplicationApiClient';
import type {
  ActivityTimelineItem,
  EventTombstone,
  ExecutionStatus,
  GuardOutcome,
  ModelUsageSummary,
  TraceDetail,
  TraceItem,
  TraceSummary,
  TraceTombstone,
} from './ActivityTimelineTypes';

interface PageDto<T> {
  items: T[];
  nextCursor: string | null;
}

interface TraceSummaryDto extends TraceSummary {
  tombstone?: boolean;
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
  traceId: string | null;
  parentEventId: string | null;
  relationship: 'root' | 'linked' | 'unresolved';
  kind: 'prompt' | 'guard' | 'approval' | 'agent' | 'model' | 'tool' | null;
  receivedAt: string | null;
  sourceAt: string | null;
  durationMs: number | null;
  identity: string | null;
  metadata: EventMetadataDto | null;
  usage: ModelUsageSummary | null;
  tombstone?: boolean;
}

export interface LoadedPage<T> {
  items: T[];
  nextCursor: string | null;
}

function toActivityEvent(dto: ActivityEventDto): ActivityTimelineItem {
  if (dto.tombstone) {
    const tombstone: EventTombstone = { tombstone: true, eventId: dto.eventId };
    return tombstone;
  }

  const metadata = dto.metadata as EventMetadataDto;
  const base = {
    eventId: dto.eventId,
    traceId: dto.traceId ?? '',
    parentEventId: dto.parentEventId,
    relationship: dto.relationship,
    receivedAt: dto.receivedAt ?? '',
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
          guardOutcome: metadata.guardOutcome,
          ruleIds: metadata.ruleIds,
        },
      };
    case 'guard':
      return {
        ...base,
        kind: 'guard',
        metadata: {
          outcome: metadata.outcome,
          policyId: metadata.policyId,
          policyVersion: metadata.policyVersion,
          ruleIds: metadata.ruleIds,
        },
      };
    case 'approval':
      return {
        ...base,
        kind: 'approval',
        metadata: {
          approvalId: metadata.approvalId,
          state: metadata.state,
        },
      };
    default:
      return {
        ...base,
        kind: dto.kind ?? 'agent',
        metadata: {
          name: metadata.name,
          status: metadata.status,
        },
        usage: dto.usage ?? null,
      };
  }
}

export async function fetchTracePage(cursor?: string | null): Promise<LoadedPage<TraceItem>> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  const page = await apiRequest<PageDto<TraceSummaryDto>>(`/api/v1/traces${query}`);
  const items: TraceItem[] = page.items.map((item) => {
    if (item.tombstone) {
      const tombstone: TraceTombstone = { tombstone: true, traceId: item.traceId };
      return tombstone;
    }
    return item;
  });
  return { items, nextCursor: page.nextCursor };
}

export async function fetchTrace(traceId: string): Promise<TraceDetail> {
  return apiRequest<TraceDetail>(`/api/v1/traces/${encodeURIComponent(traceId)}`);
}

export async function fetchEventPage(
  traceId: string,
  cursor?: string | null,
): Promise<LoadedPage<ActivityTimelineItem>> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  const page = await apiRequest<PageDto<ActivityEventDto>>(
    `/api/v1/traces/${encodeURIComponent(traceId)}/events${query}`,
  );
  return { items: page.items.map(toActivityEvent), nextCursor: page.nextCursor };
}
