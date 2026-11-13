import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from '../../ApplicationApiClient';
import {
  fetchEventContent,
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
const IDLE_DETAIL_INTERVAL_MS = 10_000;
const TERMINAL_IDLE_POLLS = 3;
const MAX_LIST_ITEMS = 300;

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
  const pollingRef = useRef(false);
  const pendingRef = useRef(false);

  const load = useCallback(async (append: boolean) => {
    if (append && pendingRef.current) {
      return;
    }
    const current = ++generation.current;
    setError(null);
    if (append) {
      pendingRef.current = true;
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
      pendingRef.current = false;
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
    if (!liveEnabled.current || loadingRef.current || pollingRef.current || document.hidden) {
      return;
    }
    pollingRef.current = true;
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
        return additions.length
          ? [...additions, ...previous].slice(0, MAX_LIST_ITEMS)
          : previous;
      });
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 404) {
        liveEnabled.current = false;
        setLive(false);
      }
    } finally {
      pollingRef.current = false;
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

export interface EventContentState {
  content: Record<string, unknown> | null;
  raw: Record<string, unknown> | null;
  loading: boolean;
  error: boolean;
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
  contentById: Record<string, EventContentState>;
  live: boolean;
  toggle: (eventId: string) => void;
  loadContent: (eventId: string) => void;
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

function isTerminal(trace: TraceDetail): boolean {
  return trace.executionStatus !== 'running' && trace.telemetryStatus !== 'incomplete';
}

function sameTrace(previous: TraceDetail | null, next: TraceDetail): boolean {
  if (previous === null) {
    return false;
  }
  return previous.traceId === next.traceId
    && previous.receivedAt === next.receivedAt
    && previous.executionStatus === next.executionStatus
    && previous.telemetryStatus === next.telemetryStatus
    && previous.guardOutcome === next.guardOutcome
    && previous.identity === next.identity
    && previous.sessionId === next.sessionId
    && previous.coverage.input === next.coverage.input
    && previous.coverage.response === next.coverage.response
    && previous.coverage.tools === next.coverage.tools
    && previous.loss?.causeCode === next.loss?.causeCode
    && previous.loss?.missingCount === next.loss?.missingCount
    && previous.loss?.from === next.loss?.from
    && previous.loss?.to === next.loss?.to;
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
  const [contentById, setContentById] = useState<Record<string, EventContentState>>({});
  const [live, setLive] = useState(true);
  const cursor = useRef<string | null>(null);
  const generation = useRef(0);
  const liveSince = useRef<string | null>(null);
  const liveEnabled = useRef(true);
  const loadingRef = useRef(true);
  const pollingRef = useRef(false);
  const terminalRef = useRef(false);
  const idlePolls = useRef(0);
  const loadingMoreRef = useRef(false);
  const contentRef = useRef<Record<string, EventContentState>>({});
  const hasContentRef = useRef<Set<string>>(new Set());

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
      terminalRef.current = isTerminal(nextTrace);
      idlePolls.current = 0;
      setExpanded(new Set());
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
    setContentById({});
    contentRef.current = {};
    terminalRef.current = false;
    idlePolls.current = 0;
    void loadFirst();
    return () => {
      generation.current += 1;
    };
  }, [loadFirst]);

  const poll = useCallback(async () => {
    if (
      !traceId
      || !liveEnabled.current
      || loadingRef.current
      || pollingRef.current
      || document.hidden
    ) {
      return;
    }
    const current = generation.current;
    pollingRef.current = true;
    try {
      const [nextTrace, fresh] = await Promise.all([
        fetchTrace(traceId),
        fetchLiveEvents(traceId, liveSince.current),
      ]);
      if (current !== generation.current || !liveEnabled.current) {
        return;
      }
      setLive(true);
      setError(null);
      setTrace((previous) => (sameTrace(previous, nextTrace) ? previous : nextTrace));
      terminalRef.current = isTerminal(nextTrace);
      if (fresh.length) {
        idlePolls.current = 0;
        liveSince.current = newestEventToken(fresh) ?? liveSince.current;
        setEvents((previous) => appendEvents(previous, fresh));
      } else if (terminalRef.current) {
        idlePolls.current += 1;
        if (idlePolls.current >= TERMINAL_IDLE_POLLS) {
          liveEnabled.current = false;
          setLive(false);
        }
      }
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 404) {
        liveEnabled.current = false;
        setLive(false);
      }
    } finally {
      pollingRef.current = false;
    }
  }, [traceId]);

  useEffect(() => {
    let timer: number | undefined;
    let stopped = false;
    const schedule = (delay: number) => {
      timer = window.setTimeout(async () => {
        await poll();
        if (stopped) {
          return;
        }
        schedule(terminalRef.current ? IDLE_DETAIL_INTERVAL_MS : LIVE_DETAIL_INTERVAL_MS);
      }, delay);
    };
    const onVisibility = () => {
      if (!document.hidden) {
        void poll();
      }
    };
    schedule(LIVE_DETAIL_INTERVAL_MS);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stopped = true;
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [poll]);

  const refresh = useCallback(() => {
    cursor.current = null;
    liveEnabled.current = true;
    terminalRef.current = false;
    idlePolls.current = 0;
    setLive(true);
    void loadFirst();
  }, [loadFirst]);

  const loadMore = useCallback(async () => {
    if (!traceId || !cursor.current || loadingMoreRef.current) {
      return;
    }
    const current = generation.current;
    loadingMoreRef.current = true;
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
      setLastLoaded(page.items.length);
    } catch (caught) {
      if (current === generation.current) {
        setError(caught);
      }
    } finally {
      loadingMoreRef.current = false;
      if (current === generation.current) {
        setPending(false);
      }
    }
  }, [traceId]);

  useEffect(() => {
    hasContentRef.current = new Set(
      events
        .filter((item) => !('tombstone' in item) && item.hasContent)
        .map((item) => item.eventId),
    );
  }, [events]);

  const loadContent = useCallback(async (eventId: string) => {
    if (!traceId) {
      return;
    }
    const known = contentRef.current[eventId];
    if (known && (known.loading || !known.error)) {
      return;
    }
    const current = generation.current;
    const loading: EventContentState = {
      content: null,
      raw: null,
      loading: true,
      error: false,
    };
    contentRef.current = { ...contentRef.current, [eventId]: loading };
    setContentById(contentRef.current);
    try {
      const value = await fetchEventContent(traceId, eventId);
      if (current !== generation.current) {
        return;
      }
      contentRef.current = {
        ...contentRef.current,
        [eventId]: { ...value, loading: false, error: false },
      };
    } catch {
      if (current !== generation.current) {
        return;
      }
      contentRef.current = {
        ...contentRef.current,
        [eventId]: { content: null, raw: null, loading: false, error: true },
      };
    }
    setContentById(contentRef.current);
  }, [traceId]);

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
    if (hasContentRef.current.has(eventId)) {
      void loadContent(eventId);
    }
  }, [loadContent]);

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
    contentById,
    live,
    toggle,
    loadContent,
    refresh,
    loadMore,
  };
}
