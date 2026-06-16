import type { AppConfig, LaundrySession } from './types';

async function req<T>(url: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...opts,
  });
  if (res.status === 401) throw new AuthError();
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : ({} as T);
}

export class AuthError extends Error {
  constructor() {
    super('unauthorized');
  }
}

export const api = {
  me: () => req<{ authed: boolean }>('/api/me'),
  login: (passcode: string) =>
    req<{ ok: boolean }>('/api/login', { method: 'POST', body: JSON.stringify({ passcode }) }),
  logout: () => req<{ ok: boolean }>('/api/logout', { method: 'POST' }),

  getConfig: () => req<AppConfig>('/api/config'),
  putConfig: (patch: Partial<AppConfig>) =>
    req<AppConfig>('/api/config', { method: 'PUT', body: JSON.stringify(patch) }),

  getSession: () => req<{ session: LaundrySession | null }>('/api/session'),
  newSession: () => req<{ session: LaundrySession }>('/api/session', { method: 'POST' }),
  endSession: () => req<{ ok: boolean }>('/api/session/end', { method: 'POST' }),
  patchSession: (session: LaundrySession) =>
    req<{ session: LaundrySession }>('/api/session', {
      method: 'PATCH',
      body: JSON.stringify({ session }),
    }),
  buildLoads: () =>
    req<{ session: LaundrySession; service: string[]; notes: string[] }>('/api/session/build', {
      method: 'POST',
    }),

  dryerCalc: (body: {
    baseHeat: string;
    baseMinutes: number;
    dampness: string;
    weight: string;
  }) =>
    req<{ heat: string; minutes: number; breakdown: string[] }>('/api/dryer/calc', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  saveDryerMemory: (categoryId: string, heat: string, minutes: number) =>
    req('/api/dryer/memory', {
      method: 'POST',
      body: JSON.stringify({ categoryId, heat, minutes }),
    }),

  pushKey: () => req<{ publicKey: string; enabled: boolean }>('/api/push/key'),
  pushSubscribe: (sub: unknown) =>
    req('/api/push/subscribe', { method: 'POST', body: JSON.stringify(sub) }),
  pushTest: () => req('/api/push/test', { method: 'POST' }),
};
