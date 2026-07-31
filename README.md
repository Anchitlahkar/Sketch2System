# Sketch2System

Compile a handwritten architecture sketch into a working system spec.

Point a camera at a whiteboard photo or a napkin drawing, and Sketch2System uses
Gemini's vision model to infer the topology — not just transcribe it. It returns an
interactive node graph, a Mermaid diagram, a design review, `infrastructure.yaml` /
`docker-compose.yml`, and a step-by-step implementation plan, all downloadable as a zip.

The emphasis is on *reasoning over OCR*: a box with an arrow to a cylinder becomes a
service talking to Postgres on `:5432` over TCP, with the missing cache, gateway, and
auth layers called out in the review.

---

## Quick start

**Requirements:** Node 20+ and a [Gemini API key](https://aistudio.google.com/apikey).

```bash
git clone git@github.com:Anchitlahkar/Sketch2System.git
cd Sketch2System
npm install

cp .env.example .env        # then set GEMINI_API_KEY
npm run dev
```

Open <http://localhost:3000>. The Express server hosts both the API and the Vite dev
middleware, so there is only one port to think about.

> **Without an API key the app still runs.** It serves clearly-labelled placeholder
> output and shows a banner saying nothing was read from your sketch. It will never
> present mock data as a real analysis.

### Camera access

`getUserMedia` requires a secure context. `http://localhost` counts as secure, so the
camera works in local development. If you serve the app over plain HTTP from another
host the camera will be unavailable — use the **Upload** button instead.

The camera is released whenever the live feed is not on screen — while a captured frame
is held and while a compile is running — so the recording indicator goes out instead of
staying lit for a feed nobody can see. Clearing the frame resumes it, without
re-prompting for permission.

### Editing the graph

The canvas is editable — every change flows into the exported zip and `architecture.json`.

| Action | How |
| --- | --- |
| Move a node | Drag it |
| Add a component | Toolbar `+` |
| Delete a node or edge | Select it, then the toolbar bin or <kbd>Delete</kbd> |
| Connect two components | Toolbar link icon, then click source and target |
| Select an edge | Click the line |
| Rename a component | Edit the name field in the selection bar |
| Re-arrange | Toolbar grid icon — re-runs the automatic layout |
| Zoom | Toolbar buttons, or <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + scroll |
| Full screen | Toolbar — gives the graph the whole work area |

Layout is computed by the app, not the model: nodes are layered by pipeline depth and
ordered to minimise edge crossings, so graphs stay readable at any size. The model only
supplies relative ordering. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#why-the-model-does-not-place-nodes).

### Reading the confidence score

`CONFIDENCE` and `Clarity` are the **model's own self-report** about how well it could
read your sketch. They show `N/A` for bundled samples and placeholder output, because
nothing was analyzed. Under 70% the app raises a warning banner with the model's retry
suggestion. Treat it as a caution signal, not a calibrated probability.

---

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Express + Vite middleware with HMR, on `PORT` (default 3000) |
| `npm run build` | Builds the client (`vite build`) and bundles the server (`dist/server.cjs`) |
| `npm start` | Runs the production build |
| `npm run lint` | `tsc --noEmit` — full strict type check |
| `npm run clean` | Removes `dist/` |

---

## Configuration

All variables are optional except `GEMINI_API_KEY`. See [`.env.example`](.env.example).

| Variable | Default | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | — | Required for real analysis. Missing ⇒ labelled placeholder output. |
| `GEMINI_MODEL` | `gemini-3.6-flash` | Vision model used to compile sketches. |
| `PORT` | `3000` | Listen port. Cloud Run and most PaaS inject this — never hardcode it. |
| `HOST` | `0.0.0.0` | Bind address. |
| `TRUST_PROXY` | off | Set `true` behind a reverse proxy so rate limiting sees real client IPs. Auto-enabled when `K_SERVICE` is present (Cloud Run). |
| `RATE_LIMIT_WINDOW_MS` | `300000` | Rate limit window for `/api/compile-sketch`. |
| `RATE_LIMIT_MAX` | `20` | Max compiles per window per IP. |
| `GEMINI_TIMEOUT_MS` | `50000` | Aborts a hung upstream request, below the Vercel function ceiling. |

`.env` is gitignored (`.env*` with a `!.env.example` exception). Keep real keys out of
version control.

---

## API

### `GET /api/health`

```json
{
  "status": "ok",
  "app": "Sketch2System - Paper Compiler",
  "version": "1.0.4",
  "model": "gemini-3.6-flash",
  "gemini_configured": true,
  "mode": "production"
}
```

> `gemini_configured` reports that a non-placeholder key is set. It does not validate it against Gemini.

### `POST /api/compile-sketch`

```jsonc
// request
{
  "imageBase64": "data:image/jpeg;base64,…",  // or a bare base64 payload
  "mimeType": "image/jpeg",                    // optional if a data: URL is supplied
  "promptHint": "add a Redis cache"            // optional, max 500 chars
}
```

Limits: 3 MB decoded image (the client downscales before upload, so this is rarely hit); `image/png`, `image/jpeg`, `image/webp`, `image/heic`,
`image/heif`.

**Success (200)** — `source` tells you whether this is real:

```jsonc
{
  "ok": true,
  "source": "gemini",   // or "mock" when the server knowingly served placeholder data
  "reason": "…",        // present only for mock
  "model": "gemini-3.6-flash",
  "elapsedMs": 18589,
  "result": { /* SketchAnalysisResult — see src/types.ts */ }
}
```

**Failure** — the body still carries a labelled fallback so the UI can degrade:

```jsonc
{
  "ok": false,
  "code": "upstream_error",
  "error": "Gemini could not compile this sketch. …",
  "source": "mock",
  "result": { /* placeholder, confidence: 0 */ }
}
```

| Code | Status | Meaning |
| --- | --- | --- |
| `invalid_body` / `missing_image` / `invalid_image` / `invalid_hint` | 400 | Malformed request |
| `unsupported_media_type` | 415 | Image type not in the allowlist |
| `image_too_large` | 413 | Over 3 MB decoded |
| `rate_limited` | 429 | Includes a `Retry-After` header |
| `upstream_error` | 502 | Gemini rejected or failed the request |
| `upstream_timeout` | 504 | Exceeded `GEMINI_TIMEOUT_MS` |

Clients should read the response body regardless of status code.

---

## Project structure

```
server.ts                     Local / container entry: Express, static + SPA serving
api/                          Vercel functions (health, compile-sketch)
Dockerfile                    Container image for Cloud Run
src/
  server/handlers.ts          Shared request handling — used by both deploy targets
  App.tsx                     Top-level state: analysis, meta, toasts, tab routing
  types.ts                    SketchAnalysisResult and the API envelope types
  components/
    CameraPane.tsx            Webcam capture, upload, voice trigger, samples
    NodeCanvas.tsx            Editable node graph: drag, connect, zoom, full screen
    CodeEditorPane.tsx        YAML / review / Mermaid / roadmap tabs
    MentorDocsModal.tsx       Prompt + schema spec, rendered from the live constants
    Header.tsx SideNav.tsx ProcessingOverlay.tsx ErrorBoundary.tsx
  shared/
    aiSpec.ts                 System prompt, response schema, model — single source
    validate.ts               Runtime validation and sanitation of model output
    graphLayout.ts            Card size, edge geometry, collision-free label placement
    autoLayout.ts             Layered graph layout — the app places nodes, not the model
  lib/
    downscaleImage.ts         Client-side resize before upload (body-size limits)
    zip.ts                    Dependency-free ZIP writer (store method)
    exportBundle.ts           Builds README/YAML/Mermaid/JSON and triggers download
  data/
    sampleDiagrams.ts         Bundled example analyses
    thumbnails.ts             Locally generated SVG thumbnails (no remote assets)
```

For the design rationale — the validation boundary, the canvas coordinate contract,
and the security model — see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## How it works

1. The browser captures a frame (JPEG, quality 0.9) or reads an uploaded file.
2. `POST /api/compile-sketch` validates size, mime type, and base64 shape.
3. The server calls Gemini with a system prompt, a JSON response schema, and
   `temperature: 0.2`, under an abort-signal timeout.
4. The response is validated and sanitized before it is trusted — duplicate node ids
   dropped, dangling edges removed, coordinates filled in, confidence clamped, Mermaid
   stripped of `click`/script directives.
5. The client re-validates the same payload and renders the graph, diagram, review,
   and generated code.

### Prompt and schema

`src/shared/aiSpec.ts` is the only definition of the system prompt, the response
schema, and the model id. The in-app **Prompt & schema spec** modal renders those same
constants, so the documentation cannot drift from what is actually sent.

---

## Security

- **Prompt injection** — the user hint is JSON-encoded inside a delimiter, and the
  system prompt declares image text and hints to be untrusted data, never instructions.
- **XSS** — Mermaid renders with `securityLevel: 'strict'`, and model output is stripped
  of `click`/`callback` directives, script-ish tags, `javascript:` URLs, and inline
  event handlers before rendering.
- **Abuse** — per-IP fixed-window rate limiting on the compile endpoint, plus image
  size and mime allowlists.
- **Error handling** — upstream errors are logged server-side; clients get a generic
  message with a stable error code, never a stack trace.
- **Resilience** — a React error boundary keeps a render failure from white-screening
  the app.

The rate limiter is in-memory and therefore per-instance. For a multi-instance
deployment, move it to Redis or enforce limits at the edge.

---

## Deployment

Request handling lives in `src/server/handlers.ts` and is shared by the Express server
and the Vercel functions in `api/`, so the two targets cannot drift apart.

### Vercel

Live at **https://sketch2system.vercel.app**.

```bash
vercel deploy --prod
```

`vercel.json` builds the client with Vite, serves `dist/`, routes `/api/*` to the
functions, and rewrites everything else to `index.html`. The compile function gets
`maxDuration: 60` because Gemini vision calls on a full-page sketch take 18-28s.

**Set the API key yourself** — never commit it, and do not paste it into a shell that
gets logged:

```bash
vercel env add GEMINI_API_KEY production
```

Then redeploy. Until it is set, the deployment serves clearly-labelled placeholder
output rather than pretending to work.

> **Before pointing a funded key at a public URL:** `/api/compile-sketch` is
> unauthenticated and each call costs money. The built-in rate limiter is in-memory, so
> on serverless it is per-instance and resets on cold start — best-effort, not a
> guarantee. Turn on
> [Deployment Protection](https://vercel.com/docs/deployment-protection) or a WAF rule
> for anything beyond a demo.

### Cloud Run

The Express server is already container-shaped: it reads `PORT`, binds `0.0.0.0`, and
enables trust-proxy automatically when `K_SERVICE` is present. A `Dockerfile` is
included.

```bash
gcloud run deploy sketch2system \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated \
  --set-secrets GEMINI_API_KEY=gemini-api-key:latest
```

Store the key in Secret Manager (`--set-secrets`) rather than passing `--set-env-vars`.
Cloud Run suits this workload better than serverless functions: no request body ceiling,
a 300s default timeout against Gemini's 18-28s calls, and a single long-lived instance
where the in-memory rate limiter actually holds.

### Self-hosted

```bash
npm run build
npm start
```

`npm run build` emits a static client into `dist/` and a bundled CommonJS server at
`dist/server.cjs`. The server is built with `--packages=external`, so production
dependencies must be installed alongside it.

---

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| Amber "Placeholder output" banner | No `GEMINI_API_KEY`, or Gemini rejected the request. Check the server log. |
| "No camera feed" | Page is not on HTTPS/localhost, or permission was denied. Use Upload. |
| Compile returns 429 | Rate limit hit. Tune `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS`. |
| "Voice commands unsupported" | Web Speech API needs Chrome or Edge. |
| Low-confidence warning | The model was unsure. Better lighting, darker pen, camera square to the page. |

---

## Tech stack

React 19 · TypeScript (strict) · Vite 6 · Tailwind CSS 4 · Express 4 ·
`@google/genai` · Mermaid 11
