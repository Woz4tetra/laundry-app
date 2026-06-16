import { describe, it, expect } from 'vitest';
import {
  buildLoads,
  computeWash,
  computeDry,
  dryerCalculate,
} from './rules-engine.js';
import { SEED_CATEGORIES, SEED_SETTINGS } from './seed.js';
import type { FillLevel, Load } from './types.js';

let n = 0;
const ids = () => `L${++n}`;

function build(sort: Record<string, FillLevel>) {
  n = 0;
  return buildLoads(sort, SEED_CATEGORIES, ids);
}

describe('buildLoads', () => {
  it('makes one load per non-empty washable category', () => {
    const { loads } = build({ towels: 'full', sheets: 'half' });
    expect(loads.map((l) => l.categoryIds[0]).sort()).toEqual(['sheets', 'towels']);
  });

  it('merges a small socks load into general', () => {
    const { loads, notes } = build({ general: 'half', socks_underwear: 'small' });
    expect(loads).toHaveLength(1);
    expect(loads[0].categoryIds.sort()).toEqual(['general', 'socks_underwear']);
    expect(notes.some((x) => /merged/i.test(x))).toBe(true);
  });

  it('keeps socks separate when there is a significant (non-small) amount', () => {
    const { loads } = build({ general: 'half', socks_underwear: 'full' });
    expect(loads).toHaveLength(2);
  });

  it('keeps socks separate when there is no general load to merge into', () => {
    const { loads } = build({ socks_underwear: 'small' });
    expect(loads).toHaveLength(1);
    expect(loads[0].categoryIds).toEqual(['socks_underwear']);
  });

  it('routes special delicates to the cleaning service, not a wash load', () => {
    const { loads, service } = build({ special_delicates: 'small', general: 'half' });
    expect(service).toEqual(['special_delicates']);
    expect(loads).toHaveLength(1);
    expect(loads[0].categoryIds[0]).toBe('general');
  });

  it('surfaces the towels exclusion note', () => {
    const { notes } = build({ towels: 'full' });
    expect(notes.some((x) => /bath mats|kitchen towels/i.test(x))).toBe(true);
  });

  it('ignores empty bins', () => {
    const { loads, service } = build({ towels: 'empty', special_delicates: 'empty' });
    expect(loads).toHaveLength(0);
    expect(service).toHaveLength(0);
  });
});

describe('computeWash', () => {
  const load = (catId: string): Load => ({
    id: 'x',
    categoryIds: [catId],
    label: catId,
    status: 'queued',
    checked: {},
    createdAt: 0,
  });

  it('uses the category wash temperature', () => {
    expect(computeWash(load('towels'), SEED_CATEGORIES, SEED_SETTINGS, 'half').tempLevel).toBe(4);
    expect(computeWash(load('general'), SEED_CATEGORIES, SEED_SETTINGS, 'half').tempLevel).toBe(2);
  });

  it('detergent is mark 1 at or below half full, mark 2 above', () => {
    expect(computeWash(load('general'), SEED_CATEGORIES, SEED_SETTINGS, 'small').detergentMark).toBe(1);
    expect(computeWash(load('general'), SEED_CATEGORIES, SEED_SETTINGS, 'half').detergentMark).toBe(1);
    expect(computeWash(load('general'), SEED_CATEGORIES, SEED_SETTINGS, 'full').detergentMark).toBe(2);
  });

  it('always uses extra rinse and vinegar', () => {
    const w = computeWash(load('general'), SEED_CATEGORIES, SEED_SETTINGS, 'half');
    expect(w.extraRinse).toBe(true);
    expect(w.vinegar).toBe(true);
  });

  it('uses the warmer temp for a merged load', () => {
    const merged: Load = { ...load('general'), categoryIds: ['general', 'socks_underwear'] };
    expect(computeWash(merged, SEED_CATEGORIES, SEED_SETTINGS, 'half').tempLevel).toBe(2);
  });
});

describe('computeDry', () => {
  const load = (catId: string): Load => ({
    id: 'x',
    categoryIds: [catId],
    label: catId,
    status: 'queued',
    checked: {},
    createdAt: 0,
  });

  it('setting-2 loads get a fixed Low / 60 min recommendation', () => {
    const d = computeDry(load('general'), SEED_CATEGORIES);
    expect(d.method).toBe('machine');
    expect(d.heat).toBe('Low');
    expect(d.minutes).toBe(60);
    expect(d.useCalculator).toBe(false);
  });

  it('towels are machine dried but flagged for the calculator', () => {
    const d = computeDry(load('towels'), SEED_CATEGORIES);
    expect(d.method).toBe('machine');
    expect(d.useCalculator).toBe(true);
  });

  it('bras hang dry, delicates go on the rack', () => {
    expect(computeDry(load('bras'), SEED_CATEGORIES).method).toBe('hang');
    expect(computeDry(load('delicates'), SEED_CATEGORIES).method).toBe('rack');
  });
});

describe('dryerCalculate', () => {
  it('adds time for very damp heavy loads and rounds to 5 min', () => {
    const r = dryerCalculate({
      baseHeat: 'Medium',
      baseMinutes: 60,
      dampness: 'very_damp',
      weight: 'heavy',
    });
    expect(r.minutes).toBe(95); // 60 + 20 + 15
    expect(r.heat).toBe('Medium');
  });

  it('never goes below 20 minutes', () => {
    const r = dryerCalculate({
      baseHeat: 'Low',
      baseMinutes: 20,
      dampness: 'almost_dry',
      weight: 'light',
    });
    expect(r.minutes).toBe(20);
  });
});
