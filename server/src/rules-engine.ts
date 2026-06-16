// Pure laundry logic: turn a sort into proposed loads, and compute wash/dry
// settings from the rules. No I/O here so it can be unit tested in isolation.

import type { Category, FillLevel, GlobalSettings, Load } from './types.js';

const FILL_ORDER: FillLevel[] = ['empty', 'small', 'half', 'full'];

export function fillRank(f: FillLevel): number {
  return FILL_ORDER.indexOf(f);
}

export interface BuildResult {
  loads: Load[];
  /** Category ids routed to the cleaning service (not washed). */
  service: string[];
  /** Human-readable notes about merges and exclusions to show the user. */
  notes: string[];
}

let fallbackCounter = 0;

/**
 * Propose wash loads from a sort.
 *
 * Each washable, non-empty category becomes its own load, except a category
 * with `mergeIntoId` and only a "small" amount, which folds into its target
 * load if that target is also present.
 */
export function buildLoads(
  sort: Record<string, FillLevel>,
  categories: Category[],
  makeId: () => string = () => `load_${++fallbackCounter}`,
  now = 0,
): BuildResult {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const present = (id: string): boolean => {
    const f = sort[id];
    return !!f && f !== 'empty';
  };

  const service: string[] = [];
  const notes: string[] = [];
  // Primary category id -> load being assembled.
  const loadMap = new Map<string, Load>();

  // Sort categories by their configured order for stable, intuitive output.
  const ordered = [...categories].sort((a, b) => a.order - b.order);

  for (const cat of ordered) {
    if (!present(cat.id)) continue;

    if (cat.routeToService) {
      service.push(cat.id);
      continue;
    }
    if (cat.washTemp == null) continue; // not washable, not service: skip

    const fill = sort[cat.id];

    // Try to merge a small amount into another category's load.
    if (cat.mergeIntoId && fill === 'small' && present(cat.mergeIntoId)) {
      const target = byId.get(cat.mergeIntoId);
      if (target) {
        let load = loadMap.get(target.id);
        if (!load) {
          load = newLoad(target, makeId, now);
          loadMap.set(target.id, load);
        }
        load.categoryIds.push(cat.id);
        load.label = loadLabel(load.categoryIds, byId);
        notes.push(`Merged a small ${cat.name.toLowerCase()} load into ${target.name}.`);
        continue;
      }
    }

    let load = loadMap.get(cat.id);
    if (!load) {
      load = newLoad(cat, makeId, now);
      loadMap.set(cat.id, load);
    }
    if (cat.exclusions.length) {
      notes.push(
        `${cat.name}: do not wash ${cat.exclusions
          .map(humanizeTag)
          .join(' or ')} in the same load.`,
      );
    }
  }

  return { loads: [...loadMap.values()], service, notes };
}

function newLoad(primary: Category, makeId: () => string, now: number): Load {
  return {
    id: makeId(),
    categoryIds: [primary.id],
    label: primary.name,
    status: 'queued',
    checked: {},
    createdAt: now,
  };
}

function loadLabel(categoryIds: string[], byId: Map<string, Category>): string {
  return categoryIds
    .map((id) => byId.get(id)?.name ?? id)
    .join(' + ');
}

function humanizeTag(tag: string): string {
  return tag.replace(/_/g, ' ');
}

export interface WashSettings {
  tempLevel: number | null;
  detergentMark: 1 | 2;
  extraRinse: boolean;
  vinegar: boolean;
  vinegarNote: string;
  maxFillFraction: number;
}

/** Compute wash settings for a load given the chosen drum fill level. */
export function computeWash(
  load: Load,
  categories: Category[],
  settings: GlobalSettings,
  fill: FillLevel,
): WashSettings {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const temps = load.categoryIds
    .map((id) => byId.get(id)?.washTemp)
    .filter((t): t is number => typeof t === 'number');
  // Combined categories share a temp; if they differ, use the warmer one.
  const tempLevel = temps.length ? Math.max(...temps) : null;

  const detergentMark =
    fillRank(fill) <= fillRank(settings.detergentMark1MaxFill) ? 1 : 2;

  return {
    tempLevel,
    detergentMark,
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
  /** True when the machine recommendation is a starting point to refine in the calculator. */
  useCalculator: boolean;
}

/** Compute the dry recommendation for a load (uses the primary category). */
export function computeDry(load: Load, categories: Category[]): DrySettings {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const primary = byId.get(load.categoryIds[0]);
  if (!primary) {
    return { method: 'none', heat: null, minutes: null, instruction: '', useCalculator: false };
  }
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
      // Setting-2 wash loads have a fixed default; warmer loads use the calculator.
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

export type Dampness = 'very_damp' | 'damp' | 'almost_dry';
export type FabricWeight = 'light' | 'medium' | 'heavy';

export interface DryerCalcInput {
  baseHeat: string;
  baseMinutes: number;
  dampness: Dampness;
  weight: FabricWeight;
}

export interface DryerCalcResult {
  heat: string;
  minutes: number;
  breakdown: string[];
}

/**
 * Adjust a base dry time for how damp and how heavy the load is. The dryer's
 * auto mode is unreliable, so this gives a manual time/heat starting point.
 */
export function dryerCalculate(input: DryerCalcInput): DryerCalcResult {
  const breakdown: string[] = [`Base: ${input.baseMinutes} min on ${input.baseHeat}`];
  let minutes = input.baseMinutes;

  const dampAdj: Record<Dampness, number> = {
    very_damp: 20,
    damp: 0,
    almost_dry: -20,
  };
  const weightAdj: Record<FabricWeight, number> = {
    heavy: 15,
    medium: 0,
    light: -10,
  };

  if (dampAdj[input.dampness]) {
    minutes += dampAdj[input.dampness];
    breakdown.push(`${input.dampness.replace('_', ' ')}: ${signed(dampAdj[input.dampness])} min`);
  }
  if (weightAdj[input.weight]) {
    minutes += weightAdj[input.weight];
    breakdown.push(`${input.weight} fabric: ${signed(weightAdj[input.weight])} min`);
  }

  minutes = Math.max(20, Math.round(minutes / 5) * 5);
  return { heat: input.baseHeat, minutes, breakdown };
}

function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}
