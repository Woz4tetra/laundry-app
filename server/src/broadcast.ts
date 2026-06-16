// Tiny Server-Sent-Events hub so every connected phone sees the same session
// state in real time. Clients subscribe to GET /api/session/stream.

import type { FastifyReply } from 'fastify';

const clients = new Set<FastifyReply>();

export function addClient(reply: FastifyReply): void {
  clients.add(reply);
}

export function removeClient(reply: FastifyReply): void {
  clients.delete(reply);
}

/** Push a JSON payload to every connected client. */
export function broadcast(event: string, data: unknown): void {
  const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const reply of clients) {
    try {
      reply.raw.write(frame);
    } catch {
      clients.delete(reply);
    }
  }
}

export function clientCount(): number {
  return clients.size;
}
