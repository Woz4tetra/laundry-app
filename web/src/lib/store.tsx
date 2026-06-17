import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api, AuthError } from './api';
import { startScheduledPhase } from './schedule';
import type { AppConfig, LaundrySession, Load } from './types';

interface Store {
  ready: boolean;
  authed: boolean;
  config: AppConfig | null;
  session: LaundrySession | null;
  setAuthed: (v: boolean) => void;
  reloadConfig: () => Promise<void>;
  newSession: () => Promise<LaundrySession>;
  endSession: () => Promise<void>;
  buildLoads: () => Promise<{ service: string[]; notes: string[] }>;
  /** Optimistically mutate the session and persist it. */
  update: (mutate: (s: LaundrySession) => void) => Promise<void>;
  updateLoad: (loadId: string, mutate: (l: Load) => void) => Promise<void>;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [session, setSession] = useState<LaundrySession | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const sessionRef = useRef<LaundrySession | null>(null);
  sessionRef.current = session;
  const configRef = useRef<AppConfig | null>(null);
  configRef.current = config;

  const reloadConfig = useCallback(async () => {
    setConfig(await api.getConfig());
  }, []);

  // Subscribe to live session updates over SSE once authed.
  const connectStream = useCallback(() => {
    if (esRef.current) return;
    const es = new EventSource('/api/session/stream');
    es.addEventListener('session', (e) => {
      const data = (e as MessageEvent).data;
      setSession(data ? (JSON.parse(data) as LaundrySession) : null);
    });
    es.onerror = () => {
      // EventSource auto-reconnects; nothing to do.
    };
    esRef.current = es;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const me = await api.me();
        setAuthed(me.authed);
        if (me.authed) {
          await reloadConfig();
          const { session } = await api.getSession();
          setSession(session);
          connectStream();
        }
      } catch (e) {
        if (e instanceof AuthError) setAuthed(false);
      } finally {
        setReady(true);
      }
    })();
    return () => esRef.current?.close();
  }, [reloadConfig, connectStream]);

  // When auth flips to true (after login), load data + stream.
  useEffect(() => {
    if (authed && !config) {
      reloadConfig();
      api.getSession().then(({ session }) => setSession(session));
      connectStream();
    }
  }, [authed, config, reloadConfig, connectStream]);

  const newSession = useCallback(async () => {
    const { session } = await api.newSession();
    setSession(session);
    return session;
  }, []);

  const endSession = useCallback(async () => {
    await api.endSession();
    setSession(null);
  }, []);

  const buildLoads = useCallback(async () => {
    const { session, service, notes } = await api.buildLoads();
    setSession(session);
    return { service, notes };
  }, []);

  const update = useCallback(async (mutate: (s: LaundrySession) => void) => {
    const current = sessionRef.current;
    if (!current) return;
    const next: LaundrySession = JSON.parse(JSON.stringify(current));
    mutate(next);
    setSession(next); // optimistic
    try {
      const { session } = await api.patchSession(next);
      setSession(session);
    } catch {
      // On failure, the next SSE frame will reconcile us back to server truth.
    }
  }, []);

  const updateLoad = useCallback(
    (loadId: string, mutate: (l: Load) => void) =>
      update((s) => {
        const load = s.loads.find((l) => l.id === loadId);
        if (load) mutate(load);
      }),
    [update],
  );

  // Auto-start scheduled washes the moment their delay elapses while the app is
  // open. The server's timer loop is the source of truth for the closed-app
  // case; this just avoids waiting for the next server scan when someone's
  // watching, so a scheduled wash needs no manual tap.
  useEffect(() => {
    if (!authed) return;
    const tick = () => {
      const s = sessionRef.current;
      const cfg = configRef.current;
      if (!s || !cfg) return;
      const now = Date.now();
      const due = s.loads.some(
        (l) => l.timer?.kind === 'delayed_start' && l.timer.endsAt <= now,
      );
      if (!due) return;
      update((draft) => {
        for (const l of draft.loads) {
          const t = l.timer;
          if (t?.kind === 'delayed_start' && t.endsAt <= Date.now()) {
            startScheduledPhase(l, cfg.settings);
          }
        }
      });
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => clearInterval(id);
  }, [authed, update]);

  const value: Store = {
    ready,
    authed,
    config,
    session,
    setAuthed,
    reloadConfig,
    newSession,
    endSession,
    buildLoads,
    update,
    updateLoad,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
