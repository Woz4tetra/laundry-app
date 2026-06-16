// Web Push (VAPID) plus the background loop that fires timer notifications even
// when the app is closed.

import webpush from 'web-push';
import {
  getActiveSession,
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
