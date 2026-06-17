// Web Push (VAPID) plus the background loop that fires timer notifications even
// when the app is closed.

import webpush from 'web-push';
import {
  getActiveSession,
  getSettings,
  listPushSubs,
  removePushSub,
  saveSession,
  type StoredPushSub,
} from './db.js';
import { broadcast } from './broadcast.js';
import type { Load } from './types.js';

const PUBLIC = process.env.VAPID_PUBLIC_KEY || '';
const PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:laundry@example.com';

export const pushEnabled = Boolean(PUBLIC && PRIVATE);

if (pushEnabled) {
  webpush.setVapidDetails(SUBJECT, PUBLIC, PRIVATE);
}

export function getPublicKey(): string {
  return PUBLIC;
}

export interface PushPayload {
  title: string;
  body: string;
  loadId?: string;
}

export async function sendToAll(payload: PushPayload): Promise<void> {
  if (!pushEnabled) return;
  const subs = listPushSubs();
  await Promise.all(
    subs.map(async (sub: StoredPushSub) => {
      try {
        await webpush.sendNotification(sub as any, JSON.stringify(payload));
      } catch (err: any) {
        // 404/410 mean the subscription is dead; drop it.
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          removePushSub(sub.endpoint);
        }
      }
    }),
  );
}

function timerMessage(load: Load): PushPayload {
  const kind = load.timer?.kind;
  if (kind === 'wash') {
    return { title: '🧺 Wash done', body: `${load.label} is washed. Time to dry or hang.`, loadId: load.id };
  }
  if (kind === 'dry') {
    return { title: '🔥 Dry done', body: `${load.label} is dry. Time to fold!`, loadId: load.id };
  }
  return { title: '⏰ Time to start', body: `Start the ${load.label} load now.`, loadId: load.id };
}

function startedMessage(load: Load, phase: 'wash' | 'dry'): PushPayload {
  if (phase === 'dry') {
    return { title: '🔥 Drying started', body: `${load.label} started drying automatically.`, loadId: load.id };
  }
  return { title: '🧺 Wash started', body: `${load.label} started washing automatically.`, loadId: load.id };
}

/**
 * Move a load whose scheduled delay has elapsed into its running phase. The wash
 * starts on its own, so the family never has to come back and tap "start".
 */
function startScheduledPhase(load: Load, now: number): 'wash' | 'dry' {
  const settings = getSettings();
  const phase = load.timer?.startsPhase ?? 'wash';
  if (phase === 'dry') {
    const minutes = load.dry?.minutes ?? settings.defaultDryMinutes;
    load.status = 'drying';
    load.timer = { kind: 'dry', endsAt: now + minutes * 60_000, notified: false };
  } else {
    load.status = 'washing';
    load.timer = { kind: 'wash', endsAt: now + settings.defaultWashMinutes * 60_000, notified: false };
  }
  return phase;
}

/**
 * Scan the active session for due timers, fire notifications, and advance load
 * status. Runs on an interval from index.ts.
 */
export async function scanTimers(now = Date.now()): Promise<void> {
  const session = getActiveSession();
  if (!session) return;
  let changed = false;

  for (const load of session.loads) {
    const t = load.timer;
    if (!t || t.notified || t.endsAt > now) continue;

    // A scheduled wash auto-starts when its delay elapses: swap the
    // delayed_start timer for a live wash/dry timer instead of nagging the
    // user to start it manually.
    if (t.kind === 'delayed_start') {
      const phase = startScheduledPhase(load, now);
      await sendToAll(startedMessage(load, phase));
      changed = true;
      continue;
    }

    await sendToAll(timerMessage(load));
    t.notified = true;

    // Advance status when a wash/dry timer completes.
    if (t.kind === 'wash' && load.status === 'washing') load.status = 'wash_done';
    if (t.kind === 'dry' && load.status === 'drying') load.status = 'dry_done';
    changed = true;
  }

  if (changed) {
    saveSession(session);
    broadcast('session', session);
  }
}

export function startTimerLoop(intervalMs = 15000): NodeJS.Timeout {
  return setInterval(() => {
    scanTimers().catch((e) => console.error('timer loop error', e));
  }, intervalMs);
}
