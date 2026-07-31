import React, { useState } from 'react';
import { X, BookOpen, Code2, ShieldAlert, Zap, Terminal, Copy, Check } from 'lucide-react';

interface MentorDocsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MentorDocsModal: React.FC<MentorDocsModalProps> = ({ isOpen, onClose }) => {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(label);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const systemPromptText = `You are a Senior Google Principal Cloud Architect and Paper Compiler AI for "Sketch2System (PaperOps)".
Your role is to analyze handwritten paper architecture sketches, flowcharts, system designs, API diagrams, or database layouts and convert them into a structured digital architecture graph, Mermaid diagram, architecture code, design review, and implementation roadmap.

CRITICAL INSTRUCTIONS:
1. REASONING OVER OCR: Do NOT simply transcribe handwriting letters. Analyze visual shapes, arrows, labels, and architectural topology to infer missing technical details (e.g. standard ports, protocols like HTTP/gRPC, database types, security boundaries, authentication layers, caching, queues).
2. SPATIAL POSITIONING: Assign logical 2D canvas coordinates (x: 50-900, y: 50-400) for clean grid layout.
3. ARCHITECTURE REVIEW: Perform a realistic design review detailing strengths, single points of failure, missing caches/auth/load-balancers, and concrete recommendations.
4. INFRASTRUCTURE CODE: Auto-generate valid Docker Compose / infrastructure.yaml code based on discovered services.
5. MERMAID DIAGRAM: Provide valid Mermaid flowchart syntax (e.g. graph LR).
6. CONFIDENCE & HANDWRITING: Provide confidence score (0.0 to 1.0), rate handwriting_clarity ("clear", "ambiguous", "low_contrast"), and suggest retry tips if needed.`;

  const expressCodeSnippet = `// Backend Express Route (server.ts) using @google/genai SDK
import express from 'express';
import { GoogleGenAI, Type } from '@google/genai';

const app = express();
app.use(express.json({ limit: '20mb' }));

app.post('/api/compile-sketch', async (req, res) => {
  const { imageBase64, promptHint } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: { 'User-Agent': 'aistudio-build' }
    }
  });

  const response = await ai.models.generateContent({
    model: 'gemini-3.6-flash',
    contents: {
      parts: [
        { inlineData: { mimeType: 'image/png', data: imageBase64.replace(/^data:image\\/\\w+;base64,/, '') } },
        { text: \`Analyze handwritten architecture sketch. User hint: \${promptHint || 'None'}\` }
      ]
    },
    config: {
      systemInstruction: SYSTEM_PROMPT,
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA
    }
  });

  const result = JSON.parse(response.text);
  res.json(result);
});`;

  const nextJsRouteSnippet = `// Next.js App Router API Route (app/api/compile-sketch/route.ts)
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';

export async function POST(req: NextRequest) {
  const { imageBase64, promptHint } = await req.json();
  const apiKey = process.env.GEMINI_API_KEY;

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
  });

  const response = await ai.models.generateContent({
    model: 'gemini-3.6-flash',
    contents: {
      parts: [
        { inlineData: { mimeType: 'image/png', data: imageBase64 } },
        { text: \`Analyze handwritten paper diagram. Hint: \${promptHint}\` }
      ]
    },
    config: {
      systemInstruction: SYSTEM_PROMPT,
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA
    }
  });

  return NextResponse.json(JSON.parse(response.text));
}`;

  const jsonSchemaSnippet = `import { Type } from "@google/genai";

export const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    summary: { type: Type.STRING },
    nodes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          label: { type: Type.STRING },
          type: { type: Type.STRING },
          tech: { type: Type.STRING },
          details: { type: Type.OBJECT },
          x: { type: Type.INTEGER },
          y: { type: Type.INTEGER }
        },
        required: ["id", "label", "type", "tech", "x", "y"]
      }
    },
    edges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          from: { type: Type.STRING },
          to: { type: Type.STRING },
          label: { type: Type.STRING },
          protocol: { type: Type.STRING },
          style: { type: Type.STRING },
          status: { type: Type.STRING }
        },
        required: ["from", "to"]
      }
    },
    mermaid: { type: Type.STRING },
    architecture_review: {
      type: Type.OBJECT,
      properties: {
        strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
        issues: { type: Type.ARRAY, items: { type: Type.STRING } },
        recommendations: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      required: ["strengths", "issues", "recommendations"]
    },
    implementation_plan: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          step: { type: Type.INTEGER },
          task: { type: Type.STRING },
          description: { type: Type.STRING },
          file_affected: { type: Type.STRING }
        },
        required: ["step", "task", "description"]
      }
    },
    generated_code_snippets: {
      type: Type.OBJECT,
      properties: {
        infrastructure_yaml: { type: Type.STRING },
        docker_compose: { type: Type.STRING }
      },
      required: ["infrastructure_yaml", "docker_compose"]
    },
    confidence: { type: Type.NUMBER },
    handwriting_clarity: { type: Type.STRING },
    retry_suggestion: { type: Type.STRING }
  },
  required: [
    "title", "summary", "nodes", "edges", "mermaid",
    "architecture_review", "implementation_plan",
    "generated_code_snippets", "confidence", "handwriting_clarity"
  ]
};`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-lg p-4 md:p-8 select-none overflow-y-auto font-sans">
      <div className="bg-[#15181E] border border-blue-500/30 rounded-lg w-full max-w-5xl max-h-[90vh] flex flex-col shadow-[0_0_50px_rgba(59,130,246,0.2)] overflow-hidden">
        {/* Modal Header */}
        <div className="bg-[#1A1D24] border-b border-white/10 px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-blue-600/20 border border-blue-500/50 flex items-center justify-center text-blue-400">
              <Zap className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Google Hackathon Pitch & AI Behavior Specs</span>
                <span className="text-[10px] bg-blue-500/10 border border-blue-500/30 text-blue-400 px-2 py-0.5 rounded font-mono">
                  Gemini 3.6 Flash
                </span>
              </h2>
              <p className="text-xs font-mono text-white/50">
                Sketch2System — Paper Compiler Engineering Breakdown
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-white/40 hover:text-white p-1.5 rounded border border-transparent hover:border-white/10 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body Scrollable */}
        <div className="p-6 overflow-y-auto space-y-8 font-mono text-xs text-white/80 leading-relaxed">
          {/* Section 0: Optimal Model Choice & Prompt Breakdown */}
          <div className="space-y-3 bg-[#0F1115] p-5 rounded border border-white/10">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-blue-400 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-400" />
                <span>1. Model Selection & Prompt Architecture Strategy</span>
              </h3>
            </div>
            <div className="text-white/70 space-y-2">
              <p>
                <strong className="text-blue-300">Recommended Model:</strong>{' '}
                <code className="bg-black/50 text-blue-400 px-1.5 py-0.5 rounded">gemini-3.6-flash</code>
              </p>
              <p>
                <strong className="text-blue-300">Why this model?</strong> Gemini 3.6 Flash provides ultra-fast sub-second latency, state-of-the-art vision spatial reasoning for paper drawings, and reliable 100% adherence to strict structured JSON outputs (`responseSchema`).
              </p>
              <div className="mt-3 bg-black/40 p-3 rounded border border-white/10 text-[11px]">
                <strong className="text-blue-400 block mb-1">Why Each Prompt Section Exists:</strong>
                <ul className="list-disc list-inside space-y-1 text-white/50">
                  <li><span className="text-white font-bold">Role Definition:</span> Sets persona to Principal Cloud Solutions Architect to trigger deep architectural inference rather than naive image captioning.</li>
                  <li><span className="text-white font-bold">Reasoning over OCR:</span> Mandates inferring implicit layers (ports, protocols, SSL, DB pools, caches) even if user handwriting only drew a simple cylinder or box.</li>
                  <li><span className="text-white font-bold">Spatial 2D Coordinates:</span> Forces assigning (x, y) grid coordinates so frontend canvas renders nodes cleanly without overlap.</li>
                  <li><span className="text-white font-bold">Architectural Review:</span> Generates real-world security vulnerabilities, SPOF warnings, and scale recommendations.</li>
                  <li><span className="text-white font-bold">Confidence & Retry:</span> Provides feedback when paper sketches are blurry or low-contrast.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Section 1: System Prompt */}
          <div className="space-y-3 bg-[#0F1115] p-5 rounded border border-white/10">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-blue-400 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-blue-400" />
                <span>2. System Prompt</span>
              </h3>
              <button
                onClick={() => handleCopy(systemPromptText, 'sysPrompt')}
                className="text-blue-400 hover:text-white text-[11px] flex items-center gap-1 cursor-pointer"
              >
                {copiedSection === 'sysPrompt' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSection === 'sysPrompt' ? 'Copied' : 'Copy Prompt'}</span>
              </button>
            </div>
            <pre className="bg-black/50 p-4 rounded text-blue-400 text-[11px] whitespace-pre-wrap overflow-x-auto border border-white/10 font-mono">
              {systemPromptText}
            </pre>
          </div>

          {/* Section 2: Response Schema */}
          <div className="space-y-3 bg-[#0F1115] p-5 rounded border border-white/10">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-sky-400 flex items-center gap-2">
                <Code2 className="w-4 h-4 text-sky-400" />
                <span>3. Structured JSON Response Schema (@google/genai Type)</span>
              </h3>
              <button
                onClick={() => handleCopy(jsonSchemaSnippet, 'schema')}
                className="text-sky-400 hover:text-white text-[11px] flex items-center gap-1 cursor-pointer"
              >
                {copiedSection === 'schema' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSection === 'schema' ? 'Copied' : 'Copy Schema'}</span>
              </button>
            </div>
            <pre className="bg-black/50 p-4 rounded text-sky-400 text-[11px] whitespace-pre overflow-x-auto border border-white/10 font-mono">
              {jsonSchemaSnippet}
            </pre>
          </div>

          {/* Section 3: Express & Next.js Backend Code */}
          <div className="space-y-3 bg-[#0F1115] p-5 rounded border border-white/10">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-indigo-300 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-indigo-300" />
                <span>4. Backend Implementation Logic (Express & Next.js)</span>
              </h3>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center text-[11px] text-white/50 mb-1 font-bold">
                  <span>EXPRESS SERVER (server.ts):</span>
                  <button
                    onClick={() => handleCopy(expressCodeSnippet, 'express')}
                    className="text-blue-400 hover:text-white text-[10px] flex items-center gap-1 cursor-pointer"
                  >
                    {copiedSection === 'express' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>Copy Express</span>
                  </button>
                </div>
                <pre className="bg-black/50 p-3 rounded text-white/80 text-[11px] whitespace-pre overflow-x-auto border border-white/10 font-mono">
                  {expressCodeSnippet}
                </pre>
              </div>

              <div>
                <div className="flex justify-between items-center text-[11px] text-white/50 mb-1 font-bold">
                  <span>NEXT.JS API ROUTE (app/api/compile-sketch/route.ts):</span>
                  <button
                    onClick={() => handleCopy(nextJsRouteSnippet, 'nextjs')}
                    className="text-blue-400 hover:text-white text-[10px] flex items-center gap-1 cursor-pointer"
                  >
                    {copiedSection === 'nextjs' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>Copy Next.js</span>
                  </button>
                </div>
                <pre className="bg-black/50 p-3 rounded text-white/80 text-[11px] whitespace-pre overflow-x-auto border border-white/10 font-mono">
                  {nextJsRouteSnippet}
                </pre>
              </div>
            </div>
          </div>

          {/* Section 4: Best Practices & Hallucination Guardrails */}
          <div className="space-y-3 bg-[#0F1115] p-5 rounded border border-white/10">
            <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>5. Best Practices for Reducing Hallucinations</span>
            </h3>
            <ul className="list-disc list-inside space-y-2 text-white/70">
              <li>
                <strong className="text-white">Strict Response Mime Type & Schema:</strong> Pass <code className="text-blue-400">responseMimeType: "application/json"</code> and define exact property types using <code className="text-blue-400">Type.OBJECT</code> and <code className="text-blue-400">Type.ARRAY</code> to eliminate malformed JSON strings or conversational markdown wrappers.
              </li>
              <li>
                <strong className="text-white">Low Temperature Tuning (0.2):</strong> Keep temperature low for deterministic JSON schema mapping while preserving architectural reasoning creativity.
              </li>
              <li>
                <strong className="text-white">User-Agent Telemetry Header:</strong> Always supply <code className="text-blue-400">headers: &#123; 'User-Agent': 'aistudio-build' &#125;</code> in <code className="text-blue-400">httpOptions</code> when initializing <code className="text-blue-400">GoogleGenAI</code>.
              </li>
              <li>
                <strong className="text-white">Confidence Thresholding:</strong> Evaluate <code className="text-blue-400">confidence</code> output score. If below 0.70, display retry suggestions to the user to capture paper sketch with clearer lighting or pen contrast.
              </li>
            </ul>
          </div>

          {/* Section 5: 2-Minute Live Demo Pitch Blueprint */}
          <div className="space-y-3 bg-[#0F1115] p-5 rounded border border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.1)]">
            <h3 className="text-sm font-bold text-blue-400 flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-400" />
              <span>6. Hackathon Demo Blueprint (2-Minute Pitch Strategy for Google Prompt Wars)</span>
            </h3>
            <div className="space-y-3 text-white/70">
              <div className="p-2.5 bg-black/40 rounded border border-white/10">
                <span className="text-blue-400 font-bold">0:00 - 0:30 (The Hook):</span> "Every developer starts on a paper napkin or notebook. But turning paper drawings into working Docker setups takes hours. Meet Sketch2System — paper compiler powered by Gemini 3.6 Flash."
              </div>
              <div className="p-2.5 bg-black/40 rounded border border-white/10">
                <span className="text-blue-400 font-bold">0:30 - 1:15 (Live Capture & Reasoning):</span> Show camera lens or click a pre-analyzed sample drawing. Hit 'Capture & Compile'. Point out how Gemini doesn't just read letters — it infers implicit ports, NGINX gateways, Postgres DBs, and Redis cache layers.
              </div>
              <div className="p-2.5 bg-black/40 rounded border border-white/10">
                <span className="text-blue-400 font-bold">1:15 - 1:45 (Architecture Review & Code):</span> Reveal the generated interactive node graph, animated flow lines, security audit recommendations, and ready-to-run <code className="text-blue-400">infrastructure.yaml</code>.
              </div>
              <div className="p-2.5 bg-black/40 rounded border border-white/10">
                <span className="text-blue-400 font-bold">1:45 - 2:00 (Export & Impact):</span> Hit 'Export to GitHub'. "Paper to production infrastructure in under 2 seconds. Thank you!"
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-[#1A1D24] border-t border-white/10 px-6 py-3 flex justify-between items-center">
          <span className="text-[10px] text-white/40">
            Built with @google/genai TypeScript SDK & Gemini 3.6 Flash
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold font-mono text-xs rounded transition-all cursor-pointer"
          >
            Close Spec View
          </button>
        </div>
      </div>
    </div>
  );
};
