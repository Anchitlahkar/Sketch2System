import type { VercelRequest, VercelResponse } from '@vercel/node';

import { healthPayload } from '../src/server/handlers.js';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json(healthPayload('vercel'));
}
