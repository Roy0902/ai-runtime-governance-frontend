import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from '../../ApplicationApiClient';
import {
  fetchEventPage,
  fetchLiveEvents,
  fetchLiveTraces,
  fetchTrace,
  fetchTracePage,
  liveToken,
} from './ActivityTimelineApi';
import { buildEventTree } from './ActivityTimelineModel';
import type { ActivityTimelineItem, TraceDetail, TraceItem } from './ActivityTimelineTypes';

const LIVE_LIST_INTERVAL_MS = 2_000;
const LIVE_DETAIL_INTERVAL_MS = 1_000;

function appendEvents(
  previous: ActivityTimelineItem[],
  incoming: ActivityTimelineItem[],
): ActivityTimelineItem[] {
  const known = new Set(previous.map((event) => event.eventId));
  const additions = incoming.filter((event) => !known.has(event.eventId));
  return additions.length ? [...previous, ...additions] : previous;
}

function newestTraceToken(items: TraceItem[]): string | null {
  for (const item of items) {
    if (!('tombstone' in item)) {
      return liveToken(item.receivedAt, item.traceId);
    }
  }
  return null;
}

export interface TraceListState {
  items: TraceItem[];
  nextCursor: string | null;
  loading: boolean;
  pending: boolean;
  error: unknown;
  live: boolean;
  refresh: () => void;
  loadMore: () => void;
}

export function useTraceList(): TraceListState {
  const [items, setItems] = useState<TraceItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [live, setLive] = useState(true);
  const cursor = useRef<string | null>(null);
  const generation = useRef(0);
  const liveSince = useRef<string | null>(null);
  const liveEnabled = useRef(true);
  const loadingRef = useRef(true);

  const load = useCallback(async (append: boolean) => {
    const current = ++generation.current;
    setError(null);
    if (append) {
      setPending(true);
    } else {
      setLoading(true);
      loadingRef.current = true;
    }
    try {
      const page = await fetchTracePage(append ? cursor.current : null);
      if (current !== generation.current) {
        return;
      }
      cursor.current = page.nextCursor;
      setNextCursor(page.nextCursor);
      setItems((previous) => (append ? [...previous, ...page.items] : page.items));
      if (!append) {
        liveSince.current = newestTraceToken(page.items) ?? liveSince.current;
      }
    } catch (caught) {
      if (current === generation.current) {
        setError(caught);
      }
    } finally {
      if (current === generation.current) {
        setLoading(false);
        loadingRef.current = false;
        setPending(false);
      }
    }
  }, []);

  useEffect(() => {
    void load(false);
    return () => {
      generation.current += 1;
    };
  }, [load]);

  const poll = useCallback(async () => {
    if (!liveEnabled.current || loadingRef.current || document.hidden) {
      return;
    }
    try {
      const fresh = await fetchLiveTraces(liveSince.current);
      if (!liveEnabled.current) {
        return;
      }
      setLive(true);
      if (!fresh.length) {
        return;
      }
      setError(null);
      liveSince.current = newestTraceToken(fresh) ?? liveSince.current;
      setItems((previous) => {
        const known = new Set(previous.map((item) => item.traceId));
        const additions = fresh.filter((item) => !known.has(item.traceId));
        return additions.length ? [...additions, ...previous] : previous;
      });
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 404) {
        liveEnabled.current = false;
        setLive(false);
      }
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void poll();
    }, LIVE_LIST_INTERVAL_MS);
    const onVisibility = () => {
      if (!document.hidden) {
        void poll();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [poll]);

  const refresh = useCallback(() => {
    cursor.current = null;
    void load(false);
  }, [load]);

  const loadMore = useCallback(() => {
    if (cursor.current) {
      void load(true);
    }
  }, [load]);

  return { items, nextCursor, loading, pending, error, live, refresh, loadMore };
}

export interface TraceDetailState {
  trace: TraceDetail | null;
  events: ActivityTimelineItem[];
  tree: ReturnType<typeof buildEventTree>;
  nextCursor: string | null;
  loading: boolean;
  pending: boolean;
  lastLoaded: number | null;
  error: unknown;
  expanded: Set<string>;
  live: boolean;
  toggle: (eventId: string) => void;
  refresh: () => void;
  loadMore: () => void;
}

function newestEventToken(events: ActivityTimelineItem[]): string | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (!('tombstone' in event)) {
      return liveToken(event.receivedAt, event.eventId);
    }
  }
  return null;
}

function sameTrace(previous: TraceDetail | null, next: TraceDetail): boolean {
  return previous !== null && JSON.stringify(previous) === JSON.stringify(next);
}

export function useTraceDetail(traceId: string | undefined): TraceDetailState {
  const [trace, setTrace] = useState<TraceDetail | null>(null);
  const [events, setEvents] = useState<ActivityTimelineItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [lastLoaded, setLastLoaded] = useState<number | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [live, setLive] = useState(true);
  const cursor = useRef<string | null>(null);
  const generation = useRef(0);
  const liveSince = useRef<string | null>(null);
  const liveEnabled = useRef(true);
  const loadingRef = useRef(true);

  const loadFirst = useCallback(async () => {
    const current = ++generation.current;
    if (!traceId) {
      loadingRef.current = false;
      setLoading(false);
      setTrace(null);
      setEvents([]);
      setNextCursor(null);
      setError(null);
      return;
    }
    setLoading(true);
    loadingRef.current = true;
    setError(null);
    setLastLoaded(null);
    try {
      const [nextTrace, page] = await Promise.all([
        fetchTrace(traceId),
        fetchEventPage(traceId),
      ]);
      if (current !== generation.current) {
        return;
      }
      cursor.current = page.nextCursor;
      setTrace(nextTrace);
      setEvents(page.items);
      setNextCursor(page.nextCursor);
      liveSince.current = newestEventToken(page.items);
      setExpanded(new Set(
        page.items
          .filter((item) => !('tombstone' in item))
          .map((item) => item.eventId),
      ));
    } catch (caught) {
      if (current === generation.current) {
        setError(caught);
      }
    } finally {
      if (current === generation.current) {
        setLoading(false);
        loadingRef.current = false;
      }
    }
  }, [traceId]);

  useEffect(() => {
    setExpanded(new Set());
    void loadFirst();
    return () => {
      generation.current += 1;
    };
  }, [loadFirst]);

  const poll = useCallback(async () => {
    if (!traceId || !liveEnabled.current || loadingRef.current || document.hidden) {
      return;
    }
    try {
      const [nextTrace, fresh] = await Promise.all([
        fetchTrace(traceId),
        fetchLiveEvents(traceId, liveSince.current),
      ]);
      if (!liveEnabled.current) {
        return;
      }
      setLive(true);
      setError(null);
      setTrace((previous) => (sameTrace(previous, nextTrace) ? previous : nextTrace));
      if (!fresh.length) {
        return;
      }
      liveSince.current = newestEventToken(fresh) ?? liveSince.current;
      setEvents((previous) => appendEvents(previous, fresh));
      setExpanded((previous) => {
        const next = new Set(previous);
        for (const event of fresh) {
          if (!('tombstone' in event)) {
            next.add(event.eventId);
          }
        }
        return next;
      });
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 404) {
        liveEnabled.current = false;
        setLive(false);
      }
    }
  }, [traceId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void poll();
    }, LIVE_DETAIL_INTERVAL_MS);
    const onVisibility = () => {
      if (!document.hidden) {
        void poll();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [poll]);

  const refresh = useCallback(() => {
    cursor.current = null;
    void loadFirst();
  }, [loadFirst]);

  const loadMore = useCallback(async () => {
    if (!traceId || !cursor.current || pending) {
      return;
    }
    const current = generation.current;
    setPending(true);
    setLastLoaded(null);
    try {
      const page = await fetchEventPage(traceId, cursor.current);
      if (current !== generation.current) {
        return;
      }
      cursor.current = page.nextCursor;
      setNextCursor(page.nextCursor);
      setEvents((previous) => appendEvents(previous, page.items));
      setExpanded((previous) => {
        const next = new Set(previous);
        for (const item of page.items) {
          if (!('tombstone' in item)) {
            next.add(item.eventId);
          }
        }
        return next;
      });
      setLastLoaded(page.items.length);
    } catch (caught) {
      if (current === generation.current) {
        setError(caught);
      }
    } finally {
      if (current === generation.current) {
        setPending(false);
      }
    }
  }, [traceId, pending]);

  const toggle = useCallback((eventId: string) => {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  }, []);

  const tree = useMemo(() => buildEventTree(events), [events]);

  return {
    trace,
    events,
    tree,
    nextCursor,
    loading,
    pending,
    lastLoaded,
    error,
    expanded,
    live,
    toggle,
    refresh,
    loadMore,
  };
}
