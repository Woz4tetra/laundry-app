// SQLite persistence. Config (rules, machines) lives as JSON blobs in a small
// key/value table; the single active session is one JSON document.

import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { nanoid } from 'nanoid';
import {
  SEED_CATEGORIES,
  SEED_MACHINES,
  SEED_PREP_RULES,
  SEED_SETTINGS,
} from './seed.js';
import type {
  Category,
  GlobalSettings,
  LaundrySession,
  Machine,
  PrepRule,
} from './types.js';

const DATA_DIR = process.env.DATA_DIR || resolve('data');
mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(join(DATA_DIR, 'laundry.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS session (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    active INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS push_subscription (
    endpoint TEXT PRIMARY KEY,
    data TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS dryer_memory (
    category_id TEXT PRIMARY KEY,
    heat TEXT NOT NULL,
    minutes INTEGER NOT NULL
  );
`);

// --- config helpers ---

function readConfig<T>(key: string): T | null {
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return row ? (JSON.parse(row.value) as T) : null;
}

function writeConfig(key: string, value: unknown): void {
  db.prepare(
    'INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  ).run(key, JSON.stringify(value));
}

function seedIfMissing(key: string, value: unknown): void {
  if (readConfig(key) === null) writeConfig(key, value);
}

seedIfMissing('categories', SEED_CATEGORIES);
seedIfMissing('prep_rules', SEED_PREP_RULES);
seedIfMissing('settings', SEED_SETTINGS);
seedIfMissing('machines', SEED_MACHINES);

export const getCategories = (): Category[] =>
  readConfig<Category[]>('categories') ?? SEED_CATEGORIES;
export const setCategories = (c: Category[]) => writeConfig('categories', c);

export const getPrepRules = (): PrepRule[] =>
  readConfig<PrepRule[]>('prep_rules') ?? SEED_PREP_RULES;
export const setPrepRules = (p: PrepRule[]) => writeConfig('prep_rules', p);

export const getSettings = (): GlobalSettings =>
  readConfig<GlobalSettings>('settings') ?? SEED_SETTINGS;
export const setSettings = (s: GlobalSettings) => writeConfig('settings', s);

export const getMachines = (): Machine[] =>
  readConfig<Machine[]>('machines') ?? SEED_MACHINES;
export const setMachines = (m: Machine[]) => writeConfig('machines', m);

// --- session helpers ---

export function getActiveSession(): LaundrySession | null {
  const row = db
    .prepare('SELECT data FROM session WHERE active = 1 ORDER BY updated_at DESC LIMIT 1')
    .get() as { data: string } | undefined;
  return row ? (JSON.parse(row.data) as LaundrySession) : null;
}

export function saveSession(s: LaundrySession): void {
  s.updatedAt = Date.now();
  db.prepare(
    `INSERT INTO session (id, data, updated_at, active) VALUES (@id, @data, @updated_at, @active)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, active = excluded.active`,
  ).run({
    id: s.id,
    data: JSON.stringify(s),
    updated_at: s.updatedAt,
    active: s.active ? 1 : 0,
  });
}

export function createSession(): LaundrySession {
  // Close any previously active sessions.
  db.prepare('UPDATE session SET active = 0 WHERE active = 1').run();
  const now = Date.now();
  const session: LaundrySession = {
    id: nanoid(10),
    step: 'sort',
    sort: {},
    loads: [],
    doorOpenAcknowledged: false,
    createdAt: now,
    updatedAt: now,
    active: true,
  };
  saveSession(session);
  return session;
}

export function endSession(): void {
  db.prepare('UPDATE session SET active = 0 WHERE active = 1').run();
}

// --- push subscriptions ---

export interface StoredPushSub {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export function listPushSubs(): StoredPushSub[] {
  const rows = db.prepare('SELECT data FROM push_subscription').all() as { data: string }[];
  return rows.map((r) => JSON.parse(r.data) as StoredPushSub);
}

export function addPushSub(sub: StoredPushSub): void {
  db.prepare(
    'INSERT INTO push_subscription (endpoint, data) VALUES (?, ?) ON CONFLICT(endpoint) DO UPDATE SET data = excluded.data',
  ).run(sub.endpoint, JSON.stringify(sub));
}

export function removePushSub(endpoint: string): void {
  db.prepare('DELETE FROM push_subscription WHERE endpoint = ?').run(endpoint);
}

// --- dryer last-used memory ---

export function getDryerMemory(): Record<string, { heat: string; minutes: number }> {
  const rows = db.prepare('SELECT category_id, heat, minutes FROM dryer_memory').all() as {
    category_id: string;
    heat: string;
    minutes: number;
  }[];
  const out: Record<string, { heat: string; minutes: number }> = {};
  for (const r of rows) out[r.category_id] = { heat: r.heat, minutes: r.minutes };
  return out;
}

export function setDryerMemory(categoryId: string, heat: string, minutes: number): void {
  db.prepare(
    `INSERT INTO dryer_memory (category_id, heat, minutes) VALUES (?, ?, ?)
     ON CONFLICT(category_id) DO UPDATE SET heat = excluded.heat, minutes = excluded.minutes`,
  ).run(categoryId, heat, minutes);
}

export default db;
