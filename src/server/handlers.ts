/**
 * Platform-independent request handling.
 *
 * The local Express server and the Vercel functions both call into here, so the
 * validation, rate limiting, prompt, and fallback behaviour cannot drift between
 * "works on my machine" and "works in production".
 */

import { GoogleGenAI, type Schema } from '@google/genai';

import {
  APP_NAME,
  APP_VERSION,
  DEFAULT_GEMINI_MODEL,
  MAX_PROMPT_HINT_LENGTH,
  RESPONSE_SCHEMA,
  SUPPORTED_IMAGE_MIME_TYPES,
  SYSTEM_PROMPT,
  buildUserPrompt,
} from '../shared/aiSpec.js';
import { normalizeAnalysis } from '../shared/validate.js';
import type { CompileErrorBody, CompileSuccessBody, SketchAnalysisResult } from '../types.js';

export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL;

/**
 * Decoded image ceiling. Kept at 3MB because Vercel caps a serverless request body at
 * 4.5MB and base64 inflates by ~33% — a larger image cannot reach the function at all.
 * The client downscales before upload, so real payloads land far below this.
 */
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
export const JSON_BODY_LIMIT = '6mb';

export const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS ?? 50_000);

const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 5 * 60_000);
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX ?? 20);
/** Bounds memory if a lot of distinct clients appear between cleanups. */
const RATE_LIMIT_MAX_KEYS = 5_000;

const hits = new Map<string, { count: number; resetAt: number }>();

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

/**
 * Fixed-window limiter with lazy expiry — no background timer, so it behaves the same
 * in a long-lived container and in a serverless invocation.
 *
 * On serverless this is per-instance and resets on cold start, making it best-effort
 * rather than a guarantee. Put a real limit at the edge (Vercel WAF / Cloud Armor) if
 * the endpoint is exposed publicly with a funded API key.
 */
export function checkRateLimit(key: string, now = Date.now()): RateLimitResult {
  const entry = hits.get(key);

  if (!entry || entry.resetAt <= now) {
    if (hits.size > RATE_LIMIT_MAX_KEYS) {
      for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
      if (hits.size > RATE_LIMIT_MAX_KEYS) hits.clear();
    }
    hits.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  entry.count += 1;
  if (entry.count > RATE_LIMIT_MAX) {
    return { allowed: false, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

export function healthPayload(mode: string) {
  const key = process.env.GEMINI_API_KEY;
  return {
    status: 'ok',
    app: `${APP_NAME} - Paper Compiler`,
    version: APP_VERSION,
    model: GEMINI_MODEL,
    // Reports a usable-looking key, not merely a present one: the placeholder from
    // .env.example is treated as unconfigured.
    gemini_configured: Boolean(key) && key !== 'MY_GEMINI_API_KEY',
    mode,
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

  const approxBytes = Math.floor((imageData.length * 3) / 4);
  if (approxBytes > MAX_IMAGE_BYTES) {
    throw new RequestError(
      413,
      'image_too_large',
      `Image is ~${(approxBytes / 1024 / 1024).toFixed(1)}MB after decoding; the limit is ${MAX_IMAGE_BYTES / 1024 / 1024}MB.`,
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

export interface HandlerResult {
  status: number;
  body: CompileSuccessBody | CompileErrorBody;
  headers?: Record<string, string>;
}

/**
 * Runs a compile end to end. Never throws: every failure path returns a labelled
 * result, so callers can respond without their own try/catch.
 */
export async function compileSketch(rawBody: unknown, clientKey: string): Promise<HandlerResult> {
  const startedAt = Date.now();

  const limit = checkRateLimit(clientKey);
  if (!limit.allowed) {
    return {
      status: 429,
      headers: { 'Retry-After': String(limit.retryAfterSeconds) },
      body: {
        ok: false,
        code: 'rate_limited',
        error: `Too many compile requests. Try again in ${limit.retryAfterSeconds}s.`,
      },
    };
  }

  let parsed: CompileRequest;
  try {
    parsed = parseCompileRequest(rawBody);
  } catch (err) {
    if (err instanceof RequestError) {
      return { status: err.status, body: { ok: false, code: err.code, error: err.message } };
    }
    throw err;
  }

  const apiKey = process.env.GEMINI_API_KEY;

  // No usable key: serve a mock, but say so. The client renders a banner off `source`,
  // so a misconfigured deployment can never masquerade as a working one.
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    console.warn('[compile-sketch] GEMINI_API_KEY is not configured; serving labelled mock.');
    return {
      status: 200,
      body: {
        ok: true,
        source: 'mock',
        reason: 'GEMINI_API_KEY is not configured on the server, so no analysis was performed.',
        model: GEMINI_MODEL,
        elapsedMs: Date.now() - startedAt,
        result: buildMockAnalysis(),
      },
    };
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
    if (!responseText) throw new Error('Gemini returned an empty response body.');

    return {
      status: 200,
      body: {
        ok: true,
        source: 'gemini',
        model: GEMINI_MODEL,
        elapsedMs: Date.now() - startedAt,
        // A schema is a strong hint to the model, not a contract.
        result: normalizeAnalysis(JSON.parse(responseText)),
      },
    };
  } catch (err) {
    const aborted = controller.signal.aborted;
    // Full detail to the log, generic message to the client: SDK errors can carry
    // request URLs and key fragments.
    console.error('[compile-sketch] compilation failed:', err);

    return {
      status: aborted ? 504 : 502,
      body: {
        ok: false,
        code: aborted ? 'upstream_timeout' : 'upstream_error',
        error: aborted
          ? `Gemini did not respond within ${Math.round(GEMINI_TIMEOUT_MS / 1000)}s.`
          : 'Gemini could not compile this sketch. Check the server logs for details.',
        source: 'mock',
        result: buildMockAnalysis(),
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Deterministic placeholder for when Gemini cannot be reached. Deliberately carries
 * confidence 0 and a summary stating it is not a real analysis.
 */
export function buildMockAnalysis(): SketchAnalysisResult {
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
