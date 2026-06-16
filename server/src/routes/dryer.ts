import type { FastifyInstance } from 'fastify';
import { dryerCalculate, type Dampness, type FabricWeight } from '../rules-engine.js';
import { setDryerMemory } from '../db.js';

export default async function dryerRoutes(app: FastifyInstance) {
  app.post('/api/dryer/calc', async (req) => {
    const b = req.body as {
      baseHeat: string;
      baseMinutes: number;
      dampness: Dampness;
      weight: FabricWeight;
    };
    return dryerCalculate(b);
  });

  // Remember the last-used dryer settings for a category.
  app.post('/api/dryer/memory', async (req) => {
    const b = req.body as { categoryId: string; heat: string; minutes: number };
    setDryerMemory(b.categoryId, b.heat, b.minutes);
    return { ok: true };
  });
}
