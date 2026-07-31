import type { VercelRequest, VercelResponse } from '@vercel/node';

import { compileSketch } from '../src/server/handlers.js';

/**
 * Gemini vision calls on a full-page sketch measured 18-28s in testing, so this needs
 * headroom well past the platform default.
 */
export const config = { maxDuration: 60 };

function clientKey(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return raw?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, code: 'method_not_allowed', error: 'Use POST.' });
  }

  const result = await compileSketch(req.body, clientKey(req));
  if (result.headers) {
    for (const [name, value] of Object.entries(result.headers)) res.setHeader(name, value);
  }
  return res.status(result.status).json(result.body);
}
