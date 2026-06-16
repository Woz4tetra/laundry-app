// Client mirror of the wash/dry computations (kept in sync with the server's
// rules-engine.ts) so the UI can render settings instantly.

import type { Category, FillLevel, GlobalSettings, Load } from './types';

const FILL_ORDER: FillLevel[] = ['empty', 'small', 'half', 'full'];
const rank = (f: FillLevel) => FILL_ORDER.indexOf(f);

export interface WashSettings {
  tempLevel: number | null;
  tempLabel: string;
  detergentMark: 1 | 2;
  extraRinse: boolean;
  vinegar: boolean;
  vinegarNote: string;
  maxFillFraction: number;
}

export function computeWash(
  load: Load,
  categories: Category[],
  settings: GlobalSettings,
  fill: FillLevel,
  washerTempScale?: Record<string, string>,
): WashSettings {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const temps = load.categoryIds
    .map((id) => byId.get(id)?.washTemp)
    .filter((t): t is number => typeof t === 'number');
  const tempLevel = temps.length ? Math.max(...temps) : null;
  const tempLabel =
    tempLevel != null ? washerTempScale?.[String(tempLevel)] ?? `Level ${tempLevel}` : '—';

  return {
    tempLevel,
    tempLabel,
    detergentMark: rank(fill) <= rank(settings.detergentMark1MaxFill) ? 1 : 2,
    extraRinse: settings.extraRinseAlways,
    vinegar: settings.vinegarInSoftenerTray,
    vinegarNote: settings.vinegarNote,
    maxFillFraction: settings.maxFillFraction,
  };
}

export interface DrySettings {
  method: 'machine' | 'hang' | 'rack' | 'none';
  heat: string | null;
  minutes: number | null;
  instruction: string;
  useCalculator: boolean;
}

export function computeDry(load: Load, categories: Category[]): DrySettings {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const primary = byId.get(load.categoryIds[0]);
  if (!primary)
    return { method: 'none', heat: null, minutes: null, instruction: '', useCalculator: false };

  switch (primary.dryMethod) {
    case 'hang':
      return {
        method: 'hang',
        heat: null,
        minutes: null,
        instruction: 'Hang dry. Bras and the mesh dress are hang dried, not tumbled.',
        useCalculator: false,
      };
    case 'rack':
      return {
        method: 'rack',
        heat: null,
        minutes: null,
        instruction: 'Lay flat on the drying rack.',
        useCalculator: false,
      };
    case 'none':
      return {
        method: 'none',
        heat: null,
        minutes: null,
        instruction: 'Not machine dried.',
        useCalculator: false,
      };
    case 'machine': {
      const d = primary.dryDefault ?? { heat: 'Low', minutes: 60 };
      const fixed = primary.washTemp === 2;
      return {
        method: 'machine',
        heat: d.heat,
        minutes: d.minutes,
        instruction: fixed
          ? `Tumble dry on ${d.heat} for ${d.minutes} minutes.`
          : `Start around ${d.heat} for ${d.minutes} minutes, then adjust with the calculator.`,
        useCalculator: !fixed,
      };
    }
  }
}

/** Prep rules that apply to any category in this load. */
export function prepRulesForLoad(
  load: Load,
  prepRules: { id: string; text: string; icon: string; appliesTo: string[] }[],
) {
  return prepRules.filter((r) => r.appliesTo.some((c) => load.categoryIds.includes(c)));
}
