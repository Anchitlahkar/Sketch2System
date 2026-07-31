/**
 * Runtime validation for model output.
 *
 * The server runs this before responding, and the client runs it again on whatever
 * comes back over the wire. Nothing downstream may assume a field exists just
 * because the TypeScript interface says so — a `responseSchema` is a strong hint
 * to the model, not a guarantee.
 *
 * The contract: `normalizeAnalysis` either throws `ValidationError` or returns a
 * fully-populated `SketchAnalysisResult` with no missing required fields, no
 * duplicate node ids, no dangling edges, and coordinates on every node.
 */

import {
  ArchitectureEdge,
  ArchitectureNode,
  ArchitectureReview,
  GeneratedCodeSnippets,
  ImplementationStep,
  NODE_TYPES,
  NodeDetails,
  NodeType,
  SketchAnalysisResult,
} from '../types';
import { autoPosition } from './graphLayout';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

const CLARITY_VALUES = ['clear', 'ambiguous', 'low_contrast'] as const;
const EDGE_STYLES = ['solid', 'dashed', 'animated'] as const;
const EDGE_STATUSES = ['ok', 'error', 'warning'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asString(item)).filter((item) => item.length > 0);
}

function asFiniteNumber(value: unknown): number | undefined {
  const num = typeof value === 'string' ? Number(value) : value;
  return typeof num === 'number' && Number.isFinite(num) ? num : undefined;
}

function asEnum<T extends readonly string[]>(value: unknown, allowed: T): T[number] | undefined {
  const str = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return (allowed as readonly string[]).includes(str) ? (str as T[number]) : undefined;
}

/**
 * Mermaid is rendered into the DOM. `securityLevel: 'strict'` in CodeEditorPane is
 * the primary control; this strips the directives that turn a diagram into an
 * script vector before they ever reach the renderer.
 */
export function sanitizeMermaid(source: string): string {
  return source
    .split('\n')
    .filter((line) => !/^\s*(click|callback)\b/i.test(line))
    .join('\n')
    .replace(/<\s*\/?\s*(script|iframe|object|embed|style|link)\b[^>]*>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/\son\w+\s*=/gi, ' data-blocked=');
}

function normalizeDetails(value: unknown): NodeDetails {
  if (!isRecord(value)) return {};
  const details: NodeDetails = {};
  for (const [key, raw] of Object.entries(value)) {
    if (raw === null || raw === undefined) continue;
    if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
      const str = String(raw);
      if (str.length > 0) details[key] = str;
    }
  }
  return details;
}

function normalizeNodes(value: unknown): ArchitectureNode[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const nodes: ArchitectureNode[] = [];

  for (const raw of value) {
    if (!isRecord(raw)) continue;

    const id = asString(raw.id).trim();
    if (!id || seen.has(id)) continue; // drop unusable and duplicate ids
    seen.add(id);

    const index = nodes.length;
    const auto = autoPosition(index);
    const type = asEnum(raw.type, NODE_TYPES) ?? ('service' as NodeType);

    nodes.push({
      id,
      label: asString(raw.label).trim() || id,
      type,
      tech: asString(raw.tech).trim() || 'unspecified',
      details: normalizeDetails(raw.details),
      x: asFiniteNumber(raw.x) ?? auto.x,
      y: asFiniteNumber(raw.y) ?? auto.y,
    });
  }

  return nodes;
}

function normalizeEdges(value: unknown, nodes: ArchitectureNode[]): ArchitectureEdge[] {
  if (!Array.isArray(value)) return [];

  const nodeIds = new Set(nodes.map((node) => node.id));
  const seen = new Set<string>();
  const edges: ArchitectureEdge[] = [];

  for (const raw of value) {
    if (!isRecord(raw)) continue;

    const from = asString(raw.from).trim();
    const to = asString(raw.to).trim();

    // Dangling edges are the model's most common structural mistake and would
    // otherwise render as an arrow pointing at nothing.
    if (!nodeIds.has(from) || !nodeIds.has(to)) continue;

    const key = `${from}->${to}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const edge: ArchitectureEdge = { from, to };
    const label = asString(raw.label).trim();
    const protocol = asString(raw.protocol).trim();
    const style = asEnum(raw.style, EDGE_STYLES);
    const status = asEnum(raw.status, EDGE_STATUSES);

    if (label) edge.label = label;
    if (protocol) edge.protocol = protocol;
    if (style) edge.style = style;
    if (status) edge.status = status;

    edges.push(edge);
  }

  return edges;
}

function normalizeReview(value: unknown): ArchitectureReview {
  const raw = isRecord(value) ? value : {};
  return {
    strengths: asStringArray(raw.strengths),
    issues: asStringArray(raw.issues),
    recommendations: asStringArray(raw.recommendations),
  };
}

function normalizePlan(value: unknown): ImplementationStep[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isRecord)
    .map((raw, index) => {
      const step: ImplementationStep = {
        step: asFiniteNumber(raw.step) ?? index + 1,
        task: asString(raw.task).trim() || `Step ${index + 1}`,
        description: asString(raw.description).trim(),
      };
      const file = asString(raw.file_affected).trim();
      if (file) step.file_affected = file;
      return step;
    })
    .sort((a, b) => a.step - b.step);
}

function normalizeSnippets(value: unknown): GeneratedCodeSnippets {
  const raw = isRecord(value) ? value : {};
  const snippets: GeneratedCodeSnippets = {
    infrastructure_yaml: asString(raw.infrastructure_yaml).trim(),
    docker_compose: asString(raw.docker_compose).trim(),
  };
  const apiSchema = asString(raw.api_schema).trim();
  if (apiSchema) snippets.api_schema = apiSchema;
  return snippets;
}

export function normalizeAnalysis(value: unknown): SketchAnalysisResult {
  if (!isRecord(value)) {
    throw new ValidationError('Analysis payload was not a JSON object.');
  }

  const nodes = normalizeNodes(value.nodes);
  const rawConfidence = asFiniteNumber(value.confidence) ?? 0;
  const retry = asString(value.retry_suggestion).trim();

  return {
    title: asString(value.title).trim() || 'Untitled Architecture',
    summary: asString(value.summary).trim(),
    nodes,
    edges: normalizeEdges(value.edges, nodes),
    mermaid: sanitizeMermaid(asString(value.mermaid)),
    architecture_review: normalizeReview(value.architecture_review),
    implementation_plan: normalizePlan(value.implementation_plan),
    generated_code_snippets: normalizeSnippets(value.generated_code_snippets),
    confidence: Math.min(1, Math.max(0, rawConfidence)),
    handwriting_clarity: asEnum(value.handwriting_clarity, CLARITY_VALUES) ?? 'ambiguous',
    retry_suggestion: retry || null,
  };
}

/** Empty-but-valid analysis, used for "New Pipeline". */
export function emptyAnalysis(): SketchAnalysisResult {
  return {
    title: 'Empty Pipeline',
    summary: 'No sketch compiled yet. Capture a drawing, upload a photo, or load a sample to begin.',
    nodes: [],
    edges: [],
    mermaid: '',
    architecture_review: { strengths: [], issues: [], recommendations: [] },
    implementation_plan: [],
    generated_code_snippets: { infrastructure_yaml: '', docker_compose: '' },
    confidence: 0,
    handwriting_clarity: 'ambiguous',
    retry_suggestion: null,
  };
}
