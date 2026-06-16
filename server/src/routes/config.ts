import type { FastifyInstance } from 'fastify';
import {
  getCategories,
  getDryerMemory,
  getMachines,
  getPrepRules,
  getSettings,
  setCategories,
  setMachines,
  setPrepRules,
  setSettings,
} from '../db.js';
import type { Category, GlobalSettings, Machine, PrepRule } from '../types.js';

export default async function configRoutes(app: FastifyInstance) {
  app.get('/api/config', async () => ({
    categories: getCategories(),
    prepRules: getPrepRules(),
    settings: getSettings(),
    machines: getMachines(),
    dryerMemory: getDryerMemory(),
  }));

  // Partial update of the editable rule set.
  app.put('/api/config', async (req) => {
    const body = req.body as {
      categories?: Category[];
      prepRules?: PrepRule[];
      settings?: GlobalSettings;
      machines?: Machine[];
    };
    if (body.categories) setCategories(body.categories);
    if (body.prepRules) setPrepRules(body.prepRules);
    if (body.settings) setSettings(body.settings);
    if (body.machines) setMachines(body.machines);
    return {
      categories: getCategories(),
      prepRules: getPrepRules(),
      settings: getSettings(),
      machines: getMachines(),
    };
  });
}
