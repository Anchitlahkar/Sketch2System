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
  env?: Record<string, string>;
  [key: string]: any;
}

export interface ArchitectureNode {
  id: string;
  label: string;
  type: 'frontend' | 'backend' | 'database' | 'gateway' | 'cache' | 'queue' | 'auth' | 'external' | 'service';
  tech: string;
  details: NodeDetails;
  x?: number;
  y?: number;
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
