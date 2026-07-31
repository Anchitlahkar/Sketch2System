import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import path from 'path';
import { GoogleGenAI, type Schema } from '@google/genai';
import dotenv from 'dotenv';

import {
  APP_NAME,
  APP_VERSION,
  DEFAULT_GEMINI_MODEL,
  MAX_PROMPT_HINT_LENGTH,
  RESPONSE_SCHEMA,
  SUPPORTED_IMAGE_MIME_TYPES,
  SYSTEM_PROMPT,
  buildUserPrompt,
} from './src/shared/aiSpec';
import { normalizeAnalysis } from './src/shared/validate';
import type { CompileErrorBody, CompileSuccessBody, SketchAnalysisResult } from './src/types';

dotenv.config();

// `tsx server.ts --dev` is used by `npm run dev`. Checking argv rather than an
// inline NODE_ENV assignment keeps the scripts working on Windows without cross-env.
const IS_DEV = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '0.0.0.0';
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL;

/** Decoded image ceiling. The JSON body limit sits above this to leave room for base64 overhead. */
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const JSON_BODY_LIMIT = '12mb';
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS ?? 60_000);

const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 5 * 60_000);
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX ?? 20);

/**
 * In-memory fixed-window limiter. Sufficient for a single-instance deployment; if
 * this ever runs multi-instance, move the counter to Redis or put the limit in
 * front of the service (Cloud Armor / API Gateway).
 */
function createRateLimiter(windowMs: number, max: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  // Bound memory growth: drop expired buckets on a slow timer rather than per request.
  const sweeper = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }, windowMs);
  sweeper.unref?.();

  return function rateLimit(req: Request, res: Response, next: NextFunction) {
    const key = req.ip ?? 'unknown';
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count += 1;
    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      const body: CompileErrorBody = {
        ok: false,
        code: 'rate_limited',
        error: `Too many compile requests. Try again in ${retryAfter}s.`,
      };
      return res.status(429).json(body);
    }

    return next();
  };
}

class RequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'RequestError';
  }
}

interface CompileRequest {
  imageData: string;
  mimeType: string;
  promptHint: string;
}

const BASE64_RE = /^[A-Za-z0-9+/\s]*={0,2}$/;

function parseCompileRequest(body: unknown): CompileRequest {
  if (typeof body !== 'object' || body === null) {
    throw new RequestError(400, 'invalid_body', 'Request body must be a JSON object.');
  }

  const { imageBase64, mimeType, promptHint } = body as Record<string, unknown>;

  if (typeof imageBase64 !== 'string' || imageBase64.length === 0) {
    throw new RequestError(400, 'missing_image', "Field 'imageBase64' is required and must be a string.");
  }

  // Accept either a bare base64 payload or a full data: URL, and take the mime
  // type from the URL when it carries one.
  const dataUrlMatch = /^data:([\w.+-]+\/[\w.+-]+);base64,/.exec(imageBase64);
  const imageData = dataUrlMatch ? imageBase64.slice(dataUrlMatch[0].length) : imageBase64;
  const declaredMime = dataUrlMatch?.[1] ?? (typeof mimeType === 'string' ? mimeType : 'image/png');
  const resolvedMime = declaredMime.trim().toLowerCase();

  if (!(SUPPORTED_IMAGE_MIME_TYPES as readonly string[]).includes(resolvedMime)) {
    throw new RequestError(
      415,
      'unsupported_media_type',
      `Unsupported image type '${resolvedMime}'. Supported: ${SUPPORTED_IMAGE_MIME_TYPES.join(', ')}.`,
    );
  }

  if (!BASE64_RE.test(imageData)) {
    throw new RequestError(400, 'invalid_image', "Field 'imageBase64' is not valid base64 data.");
  }

  // 4 base64 chars encode 3 bytes; avoids decoding an oversized payload to measure it.
  const approxBytes = Math.floor((imageData.length * 3) / 4);
  if (approxBytes > MAX_IMAGE_BYTES) {
    throw new RequestError(
      413,
      'image_too_large',
      `Image is ~${Math.round(approxBytes / 1024 / 1024)}MB; the limit is ${MAX_IMAGE_BYTES / 1024 / 1024}MB.`,
    );
  }
  if (approxBytes < 100) {
    throw new RequestError(400, 'invalid_image', 'Image payload is too small to be a photo.');
  }

  if (promptHint !== undefined && typeof promptHint !== 'string') {
    throw new RequestError(400, 'invalid_hint', "Field 'promptHint' must be a string.");
  }

  return {
    imageData,
    mimeType: resolvedMime,
    promptHint: (promptHint ?? '').slice(0, MAX_PROMPT_HINT_LENGTH),
  };
}

async function startServer(): Promise<void> {
  const app: Express = express();

  // Cloud Run and most PaaS proxies front the app; without this, every request
  // shares one rate-limit bucket because req.ip is the proxy address.
  if (process.env.TRUST_PROXY === 'true' || process.env.K_SERVICE) {
    app.set('trust proxy', 1);
  }

  app.use(express.json({ limit: JSON_BODY_LIMIT }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      app: `${APP_NAME} - Paper Compiler`,
      version: APP_VERSION,
      model: GEMINI_MODEL,
      gemini_configured: Boolean(process.env.GEMINI_API_KEY),
      mode: IS_DEV ? 'development' : 'production',
    });
  });

  app.post(
    '/api/compile-sketch',
    createRateLimiter(RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX),
    async (req: Request, res: Response) => {
      const startedAt = Date.now();

      let parsed: CompileRequest;
      try {
        parsed = parseCompileRequest(req.body);
      } catch (err) {
        if (err instanceof RequestError) {
          const body: CompileErrorBody = { ok: false, code: err.code, error: err.message };
          return res.status(err.status).json(body);
        }
        throw err;
      }

      const apiKey = process.env.GEMINI_API_KEY;

      // No key: serve a mock, but say so explicitly. The client renders a banner
      // off `source`, so a misconfigured server can never masquerade as a working one.
      if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
        console.warn('[compile-sketch] GEMINI_API_KEY is not set; serving labelled mock.');
        const body: CompileSuccessBody = {
          ok: true,
          source: 'mock',
          reason: 'GEMINI_API_KEY is not configured on the server, so no analysis was performed.',
          model: GEMINI_MODEL,
          elapsedMs: Date.now() - startedAt,
          result: buildMockAnalysis(),
        };
        return res.json(body);
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

      try {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
        });

        const response = await ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: {
            parts: [
              { inlineData: { mimeType: parsed.mimeType, data: parsed.imageData } },
              { text: buildUserPrompt(parsed.promptHint) },
            ],
          },
          config: {
            systemInstruction: SYSTEM_PROMPT,
            temperature: 0.2,
            responseMimeType: 'application/json',
            responseSchema: RESPONSE_SCHEMA as unknown as Schema,
            abortSignal: controller.signal,
          },
        });

        const responseText = response.text;
        if (!responseText) {
          throw new Error('Gemini returned an empty response body.');
        }

        // Guaranteed-shape output: the schema is a strong hint, not a contract.
        const result = normalizeAnalysis(JSON.parse(responseText));

        const body: CompileSuccessBody = {
          ok: true,
          source: 'gemini',
          model: GEMINI_MODEL,
          elapsedMs: Date.now() - startedAt,
          result,
        };
        return res.json(body);
      } catch (err) {
        const aborted = controller.signal.aborted;
        // Full detail to the server log, generic message to the client: SDK errors
        // can carry request URLs and key fragments.
        console.error('[compile-sketch] compilation failed:', err);

        const body: CompileErrorBody = {
          ok: false,
          code: aborted ? 'upstream_timeout' : 'upstream_error',
          error: aborted
            ? `Gemini did not respond within ${Math.round(GEMINI_TIMEOUT_MS / 1000)}s.`
            : 'Gemini could not compile this sketch. Check the server logs for details.',
          source: 'mock',
          result: buildMockAnalysis(),
        };
        return res.status(aborted ? 504 : 502).json(body);
      } finally {
        clearTimeout(timeout);
      }
    },
  );

  if (IS_DEV) {
    // Imported dynamically so Vite stays a devDependency and is never loaded in production.
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // `app.use` rather than `app.get('*')`: the wildcard string is invalid path
    // syntax in Express 5, and this form works on both 4 and 5.
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
      console.log(`[${APP_NAME}] v${APP_VERSION} listening on http://${HOST}:${PORT} (${IS_DEV ? 'development' : 'production'})`);
      console.log(`[${APP_NAME}] model: ${GEMINI_MODEL} | key configured: ${Boolean(process.env.GEMINI_API_KEY)}`);
      resolve();
    });
    server.on('error', reject);
  });
}

/**
 * Deterministic placeholder used when the server cannot reach Gemini. Deliberately
 * carries confidence 0 and a summary that states it is not a real analysis — the
 * previous version claimed 0.94 confidence and "successfully recognized", which made
 * an outage indistinguishable from a working system.
 */
function buildMockAnalysis(): SketchAnalysisResult {
  return normalizeAnalysis({
    title: 'Sample Architecture (not a real analysis)',
    summary:
      'Placeholder topology shown because the sketch could not be compiled. Nothing in this view was read from your drawing.',
    nodes: [
      {
        id: 'react_client',
        label: 'React Client',
        type: 'frontend',
        tech: 'React 19 + Vite',
        details: { port: '3000', status: '[ MOCK ]', framework: 'vite' },
        x: 60,
        y: 60,
      },
      {
        id: 'api_gateway',
        label: 'API Gateway',
        type: 'gateway',
        tech: 'NGINX Gateway',
        details: { routes: '/v1/*', auth: 'jwt', port: '8080', status: '[ MOCK ]' },
        x: 358,
        y: 60,
      },
      {
        id: 'postgres_db',
        label: 'Postgres DB',
        type: 'database',
        tech: 'PostgreSQL 16',
        details: { pool: '10/20', latency: '12ms', port: '5432' },
        x: 656,
        y: 60,
      },
    ],
    edges: [
      { from: 'react_client', to: 'api_gateway', label: 'REST / HTTPS', protocol: 'TLS 1.3', style: 'animated', status: 'ok' },
      { from: 'api_gateway', to: 'postgres_db', label: 'SQL', protocol: 'TCP :5432', style: 'animated', status: 'ok' },
    ],
    mermaid: `graph LR\n    ReactClient["React Client :3000"] -->|HTTPS| APIGateway["API Gateway :8080"]\n    APIGateway -->|TCP| PostgresDB[("Postgres DB :5432")]`,
    architecture_review: {
      strengths: ['Placeholder data — no review was performed on your sketch.'],
      issues: ['Placeholder data — no review was performed on your sketch.'],
      recommendations: ['Configure GEMINI_API_KEY and recompile to get a real architecture review.'],
    },
    implementation_plan: [
      {
        step: 1,
        task: 'Configure Gemini access',
        description: 'Set GEMINI_API_KEY in the environment, then recompile the sketch.',
        file_affected: '.env',
      },
    ],
    generated_code_snippets: {
      infrastructure_yaml: `# Placeholder — not generated from your sketch.\nversion: "3.8"\nservices:\n  client:\n    image: "react-app:latest"\n    ports:\n      - "3000:3000"\n  gateway:\n    image: "api-gateway:v1"\n    ports:\n      - "8080:8080"\n    depends_on:\n      - db\n  db:\n    image: "postgres:16-alpine"\n    ports:\n      - "5432:5432"`,
      docker_compose: `# Placeholder — not generated from your sketch.\nversion: "3.8"\nservices:\n  client:\n    build: .\n    ports:\n      - "3000:3000"`,
    },
    confidence: 0,
    handwriting_clarity: 'ambiguous',
    retry_suggestion: 'This is placeholder output. Configure the server API key and compile again for a real analysis.',
  });
}

startServer().catch((err) => {
  console.error('[server] failed to start:', err);
  process.exitCode = 1;
});
