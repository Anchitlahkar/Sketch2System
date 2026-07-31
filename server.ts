/**
 * Local and container entry point (also what Cloud Run runs).
 *
 * Request handling lives in src/server/handlers.ts and is shared with the Vercel
 * functions in api/, so the two deployment targets cannot diverge.
 */

import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import path from 'path';
import dotenv from 'dotenv';

import { APP_NAME, APP_VERSION } from './src/shared/aiSpec';
import { GEMINI_MODEL, JSON_BODY_LIMIT, compileSketch, healthPayload } from './src/server/handlers';
import type { CompileErrorBody } from './src/types';

dotenv.config();

// `tsx server.ts --dev` is used by `npm run dev`. Checking argv rather than an inline
// NODE_ENV assignment keeps the scripts working on Windows without cross-env.
const IS_DEV = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '0.0.0.0';

async function startServer(): Promise<void> {
  const app: Express = express();

  // Cloud Run and most PaaS proxies front the app; without this, every request shares
  // one rate-limit bucket because req.ip is the proxy address.
  if (process.env.TRUST_PROXY === 'true' || process.env.K_SERVICE) {
    app.set('trust proxy', 1);
  }

  app.use(express.json({ limit: JSON_BODY_LIMIT }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json(healthPayload(IS_DEV ? 'development' : 'production'));
  });

  app.post('/api/compile-sketch', async (req: Request, res: Response) => {
    const result = await compileSketch(req.body, req.ip ?? 'unknown');
    if (result.headers) {
      for (const [name, value] of Object.entries(result.headers)) res.setHeader(name, value);
    }
    res.status(result.status).json(result.body);
  });

  if (IS_DEV) {
    // Imported dynamically so Vite stays a devDependency and is never loaded in production.
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // `app.use` rather than `app.get('*')`: the wildcard string is invalid path syntax
    // in Express 5, and this form works on both 4 and 5.
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      if (req.path.startsWith('/api/')) return next();
      return res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Last-resort handler so a thrown error never leaks a stack trace to the client.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[server] unhandled error:', err);
    if (res.headersSent) return;
    const body: CompileErrorBody = { ok: false, code: 'internal_error', error: 'Internal server error.' };
    res.status(500).json(body);
  });

  await new Promise<void>((resolve, reject) => {
    const server = app.listen(PORT, HOST, () => {
      console.log(
        `[${APP_NAME}] v${APP_VERSION} listening on http://${HOST}:${PORT} (${IS_DEV ? 'development' : 'production'})`,
      );
      console.log(`[${APP_NAME}] model: ${GEMINI_MODEL} | key configured: ${healthPayload('').gemini_configured}`);
      resolve();
    });
    server.on('error', reject);
  });
}

startServer().catch((err) => {
  console.error('[server] failed to start:', err);
  process.exitCode = 1;
});
