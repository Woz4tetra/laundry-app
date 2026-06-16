import type { FastifyInstance } from 'fastify';
import { addPushSub, removePushSub, type StoredPushSub } from '../db.js';
import { getPublicKey, pushEnabled, sendToAll } from '../push.js';

export default async function pushRoutes(app: FastifyInstance) {
  app.get('/api/push/key', async () => ({ publicKey: getPublicKey(), enabled: pushEnabled }));

  app.post('/api/push/subscribe', async (req) => {
    const sub = req.body as StoredPushSub;
    if (sub?.endpoint) addPushSub(sub);
    return { ok: true };
  });

  app.post('/api/push/unsubscribe', async (req) => {
    const { endpoint } = req.body as { endpoint: string };
    if (endpoint) removePushSub(endpoint);
    return { ok: true };
  });

  app.post('/api/push/test', async () => {
    await sendToAll({ title: '🧺 Laundry', body: 'Notifications are working!' });
    return { ok: true };
  });
}
