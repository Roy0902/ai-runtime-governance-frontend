import type { ActivityEvent, ActivityTimelineItem, EventTombstone } from './ActivityTimelineTypes';

export interface EventNode {
  event: ActivityEvent;
  children: EventNode[];
  unlinked: boolean;
}

export interface EventTree {
  roots: EventNode[];
  unavailable: EventTombstone[];
}

function compareEvents(left: ActivityEvent, right: ActivityEvent): number {
  const timeDifference = Date.parse(left.receivedAt) - Date.parse(right.receivedAt);
  if (Number.isFinite(timeDifference) && timeDifference !== 0) {
    return timeDifference;
  }
  return left.eventId.localeCompare(right.eventId);
}

function findCycleIds(eventsById: Map<string, ActivityEvent>): Set<string> {
  const complete = new Set<string>();
  const cycles = new Set<string>();

  for (const event of eventsById.values()) {
    const path: string[] = [];
    const positions = new Map<string, number>();
    let current: ActivityEvent | undefined = event;

    while (current && !complete.has(current.eventId)) {
      const cycleStart = positions.get(current.eventId);
      if (cycleStart !== undefined) {
        for (const eventId of path.slice(cycleStart)) {
          cycles.add(eventId);
        }
        break;
      }

      positions.set(current.eventId, path.length);
      path.push(current.eventId);
      current = current.parentEventId ? eventsById.get(current.parentEventId) : undefined;
    }

    for (const eventId of path) {
      complete.add(eventId);
    }
  }

  return cycles;
}

export function buildEventTree(items: ActivityTimelineItem[]): EventTree {
  const events = items.filter((item): item is ActivityEvent => !('tombstone' in item));
  const unavailable = items.filter((item): item is EventTombstone => 'tombstone' in item);
  const eventsById = new Map(events.map((event) => [event.eventId, event]));
  const cycleIds = findCycleIds(eventsById);
  const nodes = new Map<string, EventNode>();
  for (const event of events) {
    nodes.set(event.eventId, {
        event,
        children: [],
        unlinked: cycleIds.has(event.eventId),
    });
  }
  const roots: EventNode[] = [];

  for (const event of events) {
    const node = nodes.get(event.eventId);
    if (!node) {
      continue;
    }

    const parentId = event.parentEventId;
    const parent = parentId ? nodes.get(parentId) : undefined;
    const canLink = event.relationship === 'linked' && parent && !cycleIds.has(event.eventId);

    if (canLink) {
      parent.children.push(node);
    } else {
      node.unlinked =
        node.unlinked ||
        event.relationship === 'unresolved' ||
        event.relationship === 'linked' ||
        parentId !== null;
      roots.push(node);
    }
  }

  function sortNodes(nodesToSort: EventNode[]): void {
    nodesToSort.sort((left, right) => compareEvents(left.event, right.event));
    for (const node of nodesToSort) {
      sortNodes(node.children);
    }
  }

  sortNodes(roots);
  return { roots, unavailable };
}
