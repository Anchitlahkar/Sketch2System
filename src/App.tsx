import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, FlaskConical, Sparkles } from 'lucide-react';

import { CameraPane } from './components/CameraPane';
import { CodeEditorPane, type EditorTab } from './components/CodeEditorPane';
import { Header } from './components/Header';
import { MentorDocsModal } from './components/MentorDocsModal';
import { NodeCanvas } from './components/NodeCanvas';
import { ProcessingOverlay } from './components/ProcessingOverlay';
import { SideNav } from './components/SideNav';
import { SAMPLE_SKETCHES } from './data/sampleDiagrams';
import { exportAnalysis } from './lib/exportBundle';
import { DEFAULT_GEMINI_MODEL, LOW_CONFIDENCE_THRESHOLD } from './shared/aiSpec';
import { emptyAnalysis, normalizeAnalysis } from './shared/validate';
import {
  AnalysisMeta,
  ArchitectureNode,
  CompileResponseBody,
  SampleSketch,
  SketchAnalysisResult,
} from './types';

const INITIAL_SAMPLE = SAMPLE_SKETCHES[0];

export default function App() {
  const [analysisResult, setAnalysisResult] = useState<SketchAnalysisResult>(() =>
    INITIAL_SAMPLE ? normalizeAnalysis(INITIAL_SAMPLE.data) : emptyAnalysis(),
  );
  const [meta, setMeta] = useState<AnalysisMeta>({ source: 'sample' });
  const [isCompiling, setIsCompiling] = useState<boolean>(false);
  const [editorTab, setEditorTab] = useState<EditorTab>('yaml');
  const [isMentorModalOpen, setIsMentorModalOpen] = useState<boolean>(false);
  const [selectedNode, setSelectedNode] = useState<ArchitectureNode | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: 'info' | 'error' } | null>(null);
  const [model, setModel] = useState<string>(DEFAULT_GEMINI_MODEL);

  const toastTimer = useRef<number | null>(null);

  const showToast = useCallback((message: string, tone: 'info' | 'error' = 'info') => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    setToast({ message, tone });
    toastTimer.current = window.setTimeout(() => setToast(null), 5000);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
  }, []);

  // Report the model the server is really configured with, rather than a hardcoded label.
  useEffect(() => {
    let cancelled = false;
    void fetch('/api/health')
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { model?: string } | null) => {
        if (!cancelled && body?.model) setModel(body.model);
      })
      .catch(() => {
        /* health is advisory; the default label stands */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const applyResult = useCallback((result: SketchAnalysisResult, nextMeta: AnalysisMeta) => {
    setAnalysisResult(result);
    setMeta(nextMeta);
    setSelectedNode(null);
  }, []);

  const handleCompileSketch = useCallback(
    async (imageBase64: string, mimeType: string, promptHint: string) => {
      setIsCompiling(true);
      const startedAt = performance.now();

      try {
        const response = await fetch('/api/compile-sketch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64, mimeType, promptHint }),
        });

        // Read the body regardless of status: error responses carry a labelled
        // fallback. The old code threw on !response.ok first, which made the
        // server's entire fallback path unreachable.
        const body = (await response.json().catch(() => null)) as CompileResponseBody | null;

        if (!body) {
          throw new Error(`Server returned ${response.status} with an unreadable body.`);
        }

        const elapsedMs = Math.round(performance.now() - startedAt);

        if (body.ok) {
          applyResult(normalizeAnalysis(body.result), {
            source: body.source,
            reason: body.reason,
            model: body.model,
            elapsedMs,
          });
          if (body.source === 'mock') {
            showToast('Server returned placeholder data — see the banner above the canvas.', 'error');
          } else {
            showToast(`Compiled with ${body.model} in ${(elapsedMs / 1000).toFixed(2)}s`);
          }
          return;
        }

        if (body.result) {
          applyResult(normalizeAnalysis(body.result), {
            source: 'mock',
            reason: body.error,
            elapsedMs,
          });
        }
        showToast(body.error, 'error');
      } catch (err) {
        console.error('Compilation request failed:', err);
        const sample = INITIAL_SAMPLE;
        if (sample) {
          applyResult(normalizeAnalysis(sample.data), {
            source: 'sample',
            reason: 'The compile request never reached the server, so a bundled sample is shown instead.',
            elapsedMs: Math.round(performance.now() - startedAt),
          });
        }
        showToast('Could not reach the compile server. Showing a bundled sample.', 'error');
      } finally {
        setIsCompiling(false);
      }
    },
    [applyResult, showToast],
  );

  const handleSelectSample = useCallback(
    (sample: SampleSketch) => {
      applyResult(normalizeAnalysis(sample.data), {
        source: 'sample',
        reason: 'bundled example topology, nothing was analyzed.',
      });
      showToast(`Loaded sample: ${sample.title}`);
    },
    [applyResult, showToast],
  );

  const handleExport = useCallback(() => {
    try {
      const filename = exportAnalysis(analysisResult);
      showToast(`Downloaded ${filename}`);
    } catch (err) {
      console.error('Export failed:', err);
      showToast('Export failed — see the browser console.', 'error');
    }
  }, [analysisResult, showToast]);

  const handleNewPipeline = useCallback(() => {
    applyResult(emptyAnalysis(), {
      source: 'sample',
      reason: 'empty canvas. Capture, upload, or load a sample to begin.',
    });
    showToast('Cleared the canvas.');
  }, [applyResult, showToast]);

  const isPlaceholder = meta.source !== 'gemini';
  const lowConfidence = meta.source === 'gemini' && analysisResult.confidence < LOW_CONFIDENCE_THRESHOLD;
  const hasContent = analysisResult.nodes.length > 0;

  return (
    <div className="bg-[#0F1115] text-[#E0E0E0] font-sans h-screen w-screen overflow-hidden flex flex-col selection:bg-blue-600 selection:text-white">
      <Header
        onOpenMentorModal={() => setIsMentorModalOpen(true)}
        onExport={handleExport}
        confidenceScore={analysisResult.confidence}
        isConfidenceMeasured={meta.source === 'gemini'}
        model={model}
        canExport={hasContent}
      />

      <div className="flex-1 mt-16 flex w-full h-[calc(100vh-64px)] relative overflow-hidden">
        <SideNav
          activeTab={editorTab}
          onSelectTab={setEditorTab}
          onNewPipeline={handleNewPipeline}
          onOpenDocs={() => setIsMentorModalOpen(true)}
          nodeCount={analysisResult.nodes.length}
          edgeCount={analysisResult.edges.length}
        />

        {/*
          min-w-0 + overflow-hidden at every level of this flex chain: without it,
          `min-width: auto` lets the canvas's intrinsic width (bounds + padding)
          push `main` wider than the viewport, which both clipped the right-hand
          nodes and made fit-to-view measure a viewport wider than the screen.
        */}
        <main className="flex-1 min-w-0 ml-60 flex flex-col md:flex-row h-full relative bg-[#0F1115] border-t border-white/10 overflow-hidden">
          {toast && (
            <div
              role="status"
              aria-live="polite"
              // Bottom-right: at the top it covered the persistent node/edge counters.
              className={`absolute bottom-4 right-4 z-50 bg-[#15181E]/95 border rounded px-4 py-2 font-mono text-xs flex items-center gap-2.5 shadow-lg animate-[slideInDown_0.3s_ease-out_forwards] max-w-md ${
                toast.tone === 'error' ? 'border-red-500/50 text-red-200' : 'border-blue-500/50 text-white'
              }`}
            >
              {toast.tone === 'error' ? (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
              )}
              <span>{toast.message}</span>
            </div>
          )}

          <div className="flex flex-col h-full w-full md:w-[400px] md:shrink-0 border-b md:border-b-0 border-white/10">
            <CameraPane onCompile={handleCompileSketch} onSelectSample={handleSelectSample} isCompiling={isCompiling} />
          </div>

          <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0A0C10] min-w-0">
            <div className="h-10 bg-[#15181E] border-b border-white/10 px-5 flex items-center justify-between font-mono text-xs shrink-0 gap-4">
              <div className="flex items-center gap-2 text-white font-bold min-w-0">
                <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="text-blue-400 truncate">{analysisResult.title}</span>
              </div>
              <div className="flex items-center gap-3 text-[10px] shrink-0">
                <span className="text-white/40">Clarity:</span>
                {/* Like confidence, this is only meaningful when a sketch was read. */}
                <span className={`font-bold uppercase ${isPlaceholder ? 'text-white/40' : 'text-sky-400'}`}>
                  {isPlaceholder ? 'N/A' : analysisResult.handwriting_clarity}
                </span>
                <span className="text-white/40">Nodes:</span>
                <span className="text-blue-400 font-bold">{analysisResult.nodes.length}</span>
                <span className="text-white/40">Edges:</span>
                <span className="text-blue-400 font-bold">{analysisResult.edges.length}</span>
                {meta.elapsedMs !== undefined && meta.source === 'gemini' && (
                  <>
                    <span className="text-white/40">Time:</span>
                    <span className="text-blue-400 font-bold">{(meta.elapsedMs / 1000).toFixed(2)}s</span>
                  </>
                )}
              </div>
            </div>

            {/*
              Placeholder banner. A misconfigured or failing server used to be
              indistinguishable from a working one; now every non-Gemini result
              says exactly what it is.
            */}
            {isPlaceholder && (
              <div className="bg-amber-900/20 border-b border-amber-500/40 px-4 py-2 font-mono text-[11px] text-amber-200 flex items-start gap-2">
                <FlaskConical className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                <span>
                  <strong className="font-bold">
                    {meta.source === 'mock' ? 'Placeholder output' : 'Bundled sample'}
                  </strong>{' '}
                  — {meta.reason ?? 'this was not read from a sketch.'}
                </span>
              </div>
            )}

            {lowConfidence && (
              <div className="bg-amber-900/20 border-b border-amber-500/40 px-4 py-2 font-mono text-[11px] text-amber-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                <span>
                  Low confidence ({Math.round(analysisResult.confidence * 100)}%). Treat this topology as a draft.
                  {analysisResult.retry_suggestion ? ` ${analysisResult.retry_suggestion}` : ''}
                </span>
              </div>
            )}

            <NodeCanvas
              nodes={analysisResult.nodes}
              edges={analysisResult.edges}
              selectedNodeId={selectedNode?.id ?? null}
              onSelectNode={setSelectedNode}
            />

            {selectedNode && (
              <div className="bg-[#15181E] border-t border-white/10 px-5 py-2 flex items-center justify-between font-mono text-xs text-white/80 shrink-0 gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-blue-400 font-bold truncate">{selectedNode.label}</span>
                  <span className="text-white/50 truncate">({selectedNode.tech})</span>
                </div>
                <div className="flex items-center gap-4 text-[10px] shrink-0">
                  <span>Port: {selectedNode.details.port ?? 'N/A'}</span>
                  <span>Status: {selectedNode.details.status ?? 'unknown'}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedNode(null)}
                    className="text-white/40 hover:text-blue-400 underline cursor-pointer"
                  >
                    Clear selection
                  </button>
                </div>
              </div>
            )}

            {!isPlaceholder && !lowConfidence && analysisResult.retry_suggestion && (
              <div className="bg-red-900/20 border-t border-red-500/30 px-4 py-2 font-mono text-xs text-red-300 flex items-center gap-2 shrink-0">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{analysisResult.retry_suggestion}</span>
              </div>
            )}

            <CodeEditorPane
              snippets={analysisResult.generated_code_snippets}
              review={analysisResult.architecture_review}
              roadmap={analysisResult.implementation_plan}
              mermaidSyntax={analysisResult.mermaid}
              activeTab={editorTab}
              onTabChange={setEditorTab}
            />
          </div>
        </main>
      </div>

      <ProcessingOverlay isVisible={isCompiling} />

      <MentorDocsModal isOpen={isMentorModalOpen} onClose={() => setIsMentorModalOpen(false)} model={model} />
    </div>
  );
}
