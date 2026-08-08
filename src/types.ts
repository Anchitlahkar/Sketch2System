export interface NodeDetails {
  port?: string;
  status?: string;
  latency?: string;
  routes?: string;
  auth?: string;
  pool?: string;
  framework?: string;
  image?: string;
  cpu?: string;
  memory?: string;
  env?: Record<string, string>;
  [key: string]: unknown;
}

export const NODE_TYPES = [
  'frontend',
  'backend',
  'database',
  'gateway',
  'cache',
  'queue',
  'auth',
  'external',
  'service',
] as const;

export type NodeType = (typeof NODE_TYPES)[number];

export interface ArchitectureNode {
  id: string;
  label: string;
  type: NodeType;
  tech: string;
  details: NodeDetails;
  /** Logical canvas coordinates. Always present after validation. */
  x: number;
  y: number;
}

export interface ArchitectureEdge {
  from: string;
  to: string;
  label?: string;
  protocol?: string;
  style?: 'solid' | 'dashed' | 'animated';
  status?: 'ok' | 'error' | 'warning';
}

export interface ArchitectureReview {
  strengths: string[];
  issues: string[];
  recommendations: string[];
}

export interface ImplementationStep {
  step: number;
  task: string;
  description: string;
  file_affected?: string;
}

export interface GeneratedCodeSnippets {
  infrastructure_yaml: string;
  docker_compose: string;
  api_schema?: string;
}

export interface SketchAnalysisResult {
  title: string;
  summary: string;
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
  mermaid: string;
  architecture_review: ArchitectureReview;
  implementation_plan: ImplementationStep[];
  generated_code_snippets: GeneratedCodeSnippets;
  confidence: number;
  handwriting_clarity: 'clear' | 'ambiguous' | 'low_contrast';
  retry_suggestion?: string | null;
}

export interface SampleSketch {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  data: SketchAnalysisResult;
}

/** Where the currently displayed analysis came from. Drives the honesty banner. */
export type AnalysisSource = 'gemini' | 'mock' | 'sample';

export interface AnalysisMeta {
  source: AnalysisSource;
  /** Why a mock was served, when source === 'mock'. */
  reason?: string;
  model?: string;
  /** Real measured round-trip, never fabricated. */
  elapsedMs?: number;
}

/** Successful compile: the server reached Gemini, or knowingly served a mock. */
export interface CompileSuccessBody {
  ok: true;
  source: 'gemini' | 'mock';
  reason?: string;
  model: string;
  elapsedMs: number;
  result: SketchAnalysisResult;
}

/**
 * Failed compile. `result` may still carry a mock so the UI can degrade
 * gracefully — but the non-2xx status and `source: 'mock'` keep it labelled.
 */
export interface CompileErrorBody {
  ok: false;
  code: string;
  error: string;
  source?: 'mock';
  result?: SketchAnalysisResult;
}

export type CompileResponseBody = CompileSuccessBody | CompileErrorBody;
