// Quiet-hours / bedtime scheduling math. Runs on the client so it uses the
// user's local time. The server only stores the resulting absolute timestamps.

import type { QuietHours } from './types';

export function parseHM(s: string): number {
  const [h, m] = s.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function isInQuietHours(d: Date, qh: QuietHours): boolean {
  if (!qh.enabled) return false;
  const m = minutesOfDay(d);
  const qs = parseHM(qh.start);
  const qe = parseHM(qh.end);
  if (qs === qe) return false;
  return qs > qe ? m >= qs || m < qe : m >= qs && m < qe; // qs>qe => crosses midnight
}

/** Next Date strictly after `from` whose clock time equals `minutes` of day. */
function nextTimeOfDay(from: Date, minutes: number): Date {
  const d = new Date(from);
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  if (d.getTime() <= from.getTime()) d.setDate(d.getDate() + 1);
  return d;
}

export interface ScheduleEval {
  conflict: boolean;
  finishMs: number;
  /** When the run would finish if delayed to start after quiet hours. */
  suggestedStartMs?: number;
  suggestedFinishMs?: number;
}

/**
 * Decide whether a run of `durationMin` starting at `startMs` would overlap
 * quiet hours, and if so suggest a delayed start that begins after they end.
 */
export function evaluateSchedule(
  startMs: number,
  durationMin: number,
  qh: QuietHours,
): ScheduleEval {
  const start = new Date(startMs);
  const finishMs = startMs + durationMin * 60_000;
  if (!qh.enabled) return { conflict: false, finishMs };

  let conflict = false;
  if (isInQuietHours(start, qh)) {
    conflict = true;
  } else {
    const onset = nextTimeOfDay(start, parseHM(qh.start));
    conflict = onset.getTime() < finishMs;
  }
  if (!conflict) return { conflict: false, finishMs };

  // Suggest starting when the upcoming quiet window ends.
  const anchor = isInQuietHours(start, qh) ? start : nextTimeOfDay(start, parseHM(qh.start));
  const suggestedStart = nextTimeOfDay(anchor, parseHM(qh.end));
  const suggestedStartMs = suggestedStart.getTime();
  return {
    conflict: true,
    finishMs,
    suggestedStartMs,
    suggestedFinishMs: suggestedStartMs + durationMin * 60_000,
  };
}

export function fmtTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function fmtClock(ms: number): string {
  const total = Math.max(0, Math.round((ms - Date.now()) / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
