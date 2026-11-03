import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchEventPage, fetchTrace, fetchTracePage } from './ActivityTimelineApi';
import { buildEventTree } from './ActivityTimelineModel';
import type { ActivityEvent, TraceDetail, TraceSummary } from './ActivityTimelineTypes';

export interface TraceListState {
  items: TraceSummary[];
  nextCursor: string | null;
  loading: boolean;
  pending: boolean;
  error: unknown;
  refresh: () => void;
  loadMore: () => void;
}

export function useTraceList(): TraceListState {
  const [items, setItems] = useState<TraceSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const cursor = useRef<string | null>(null);
  const generation = useRef(0);

  const load = useCallback(async (append: boolean) => {
    const current = ++generation.current;
    setError(null);
    if (append) {
      setPending(true);
    } else {
      setLoading(true);
    }
    try {
      const page = await fetchTracePage(append ? cursor.current : null);
      if (current !== generation.current) {
        return;
      }
      cursor.current = page.nextCursor;
      setNextCursor(page.nextCursor);
      setItems((previous) => (append ? [...previous, ...page.items] : page.items));
    } catch (caught) {
      if (current === generation.current) {
        setError(caught);
      }
    } finally {
      if (current === generation.current) {
        setLoading(false);
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

  const refresh = useCallback(() => {
    cursor.current = null;
    void load(false);
  }, [load]);

  const loadMore = useCallback(() => {
    if (cursor.current) {
      void load(true);
    }
  }, [load]);

  return { items, nextCursor, loading, pending, error, refresh, loadMore };
}

export interface TraceDetailState {
  trace: TraceDetail | null;
  events: ActivityEvent[];
  tree: ReturnType<typeof buildEventTree>;
  nextCursor: string | null;
  loading: boolean;
  pending: boolean;
  lastLoaded: number | null;
  error: unknown;
  expanded: Set<string>;
  toggle: (eventId: string) => void;
  refresh: () => void;
  loadMore: () => void;
}

export function useTraceDetail(traceId: string | undefined): TraceDetailState {
  const [trace, setTrace] = useState<TraceDetail | null>(null);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [lastLoaded, setLastLoaded] = useState<number | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const cursor = useRef<string | null>(null);
  const generation = useRef(0);

  const loadFirst = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true);
    setError(null);
    setLastLoaded(null);
    try {
      if (!traceId) {
        throw new Error('Missing trace identity');
      }
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
      setExpanded((previous) => {
        const kept = [...previous].filter((id) => page.items.some((event) => event.eventId === id));
        return new Set(kept);
      });
    } catch (caught) {
      if (current === generation.current) {
        setError(caught);
      }
    } finally {
      if (current === generation.current) {
        setLoading(false);
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
      setEvents((previous) => [...previous, ...page.items]);
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
    toggle,
    refresh,
    loadMore,
  };
}
