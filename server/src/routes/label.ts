import type { FastifyInstance } from 'fastify';

// Care-label scanner. Wired as a later phase: when OLLAMA_URL is configured it
// proxies a label photo to a local VLM (Qwen2.5-VL / Qwen3-VL). Until then it
// reports as disabled so the UI can hide the feature.

const OLLAMA_URL = process.env.OLLAMA_URL || '';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5vl:7b';

const PROMPT =
  'Identify and translate the laundry care symbols on this label, including text instructions. ' +
  'Return JSON with keys: wash_temp_c, machine_wash (bool), tumble_dry, iron, bleach, dry_clean, notes.';

export default async function labelRoutes(app: FastifyInstance) {
  app.get('/api/label/status', async () => ({ enabled: Boolean(OLLAMA_URL), model: OLLAMA_MODEL }));

  app.post('/api/label/scan', async (req, reply) => {
    if (!OLLAMA_URL) {
      return reply.code(501).send({ error: 'label scanner not configured', enabled: false });
    }
    const { imageBase64 } = req.body as { imageBase64?: string };
    if (!imageBase64) return reply.code(400).send({ error: 'missing imageBase64' });

    try {
      const res = await fetch(`${OLLAMA_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          prompt: PROMPT,
          images: [imageBase64.replace(/^data:image\/\w+;base64,/, '')],
          stream: false,
          format: 'json',
        }),
      });
      const data = (await res.json()) as { response?: string };
      return { raw: data.response ?? '' };
    } catch (e) {
      app.log.error(e);
      return reply.code(502).send({ error: 'vlm request failed' });
    }
  });
}
