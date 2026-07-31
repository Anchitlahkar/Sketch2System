import React, { useState, useEffect, useRef } from 'react';
import { ArchitectureReview, ImplementationStep, GeneratedCodeSnippets } from '../types';
import { FileCode, CheckCircle2, AlertTriangle, Lightbulb, Copy, Check, Play, MapPin } from 'lucide-react';
import mermaid from 'mermaid';

interface CodeEditorPaneProps {
  snippets: GeneratedCodeSnippets;
  review: ArchitectureReview;
  roadmap: ImplementationStep[];
  mermaidSyntax: string;
}

export const CodeEditorPane: React.FC<CodeEditorPaneProps> = ({ snippets, review, roadmap, mermaidSyntax }) => {
  const [activeTab, setActiveTab] = useState<'yaml' | 'review' | 'mermaid' | 'roadmap'>('yaml');
  const [copied, setCopied] = useState<boolean>(false);
  const mermaidRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: true,
      theme: 'dark',
      securityLevel: 'loose',
      fontFamily: 'JetBrains Mono, monospace'
    });
  }, []);

  useEffect(() => {
    if (activeTab === 'mermaid' && mermaidRef.current && mermaidSyntax) {
      mermaidRef.current.innerHTML = '';
      const id = `mermaid-svg-${Date.now()}`;
      mermaid
        .render(id, mermaidSyntax)
        .then(({ svg }) => {
          if (mermaidRef.current) {
            mermaidRef.current.innerHTML = svg;
          }
        })
        .catch((err) => {
          console.warn('Mermaid render warning:', err);
          if (mermaidRef.current) {
            mermaidRef.current.innerText = mermaidSyntax;
          }
        });
    }
  }, [activeTab, mermaidSyntax]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getActiveCodeText = () => {
    switch (activeTab) {
      case 'yaml':
        return snippets.infrastructure_yaml || snippets.docker_compose || '# No YAML snippet generated';
      case 'mermaid':
        return mermaidSyntax;
      case 'review':
        return `STRENGTHS:\n${review.strengths.map((s) => `- ${s}`).join('\n')}\n\nISSUES:\n${review.issues.map((i) => `- ${i}`).join('\n')}\n\nRECOMMENDATIONS:\n${review.recommendations.map((r) => `- ${r}`).join('\n')}`;
      case 'roadmap':
        return roadmap.map((s) => `Step ${s.step}: ${s.task}\n${s.description}\nFile: ${s.file_affected || 'N/A'}`).join('\n\n');
      default:
        return '';
    }
  };

  const lineCount = getActiveCodeText().split('\n').length;

  return (
    <div className="flex-1 bg-[#0A0C10] flex flex-col min-h-[260px] max-h-[380px] border-t border-white/10">
      {/* Editor Header Bar with Tabs */}
      <div className="h-9 bg-[#15181E] border-b border-white/10 flex items-center justify-between px-4 select-none">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('yaml')}
            className={`font-mono text-[11px] px-3 py-1 rounded-t flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'yaml'
                ? 'bg-[#0A0C10] text-blue-400 border-t-2 border-blue-500 font-bold'
                : 'text-white/50 hover:text-white'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>infrastructure.yaml</span>
          </button>

          <button
            onClick={() => setActiveTab('review')}
            className={`font-mono text-[11px] px-3 py-1 rounded-t flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'review'
                ? 'bg-[#0A0C10] text-blue-400 border-t-2 border-blue-500 font-bold'
                : 'text-white/50 hover:text-white'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>Architecture Review</span>
          </button>

          <button
            onClick={() => setActiveTab('mermaid')}
            className={`font-mono text-[11px] px-3 py-1 rounded-t flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'mermaid'
                ? 'bg-[#0A0C10] text-blue-400 border-t-2 border-blue-500 font-bold'
                : 'text-white/50 hover:text-white'
            }`}
          >
            <Play className="w-3.5 h-3.5 text-blue-400" />
            <span>Mermaid Diagram</span>
          </button>

          <button
            onClick={() => setActiveTab('roadmap')}
            className={`font-mono text-[11px] px-3 py-1 rounded-t flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'roadmap'
                ? 'bg-[#0A0C10] text-blue-400 border-t-2 border-blue-500 font-bold'
                : 'text-white/50 hover:text-white'
            }`}
          >
            <MapPin className="w-3.5 h-3.5 text-blue-400" />
            <span>Implementation Plan</span>
          </button>
        </div>

        <button
          onClick={() => handleCopy(getActiveCodeText())}
          className="text-white/50 hover:text-blue-400 transition-colors flex items-center gap-1 text-[10px] font-mono cursor-pointer"
          title="Copy tab content"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-blue-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Editor Content Viewport */}
      <div className="flex-1 overflow-auto p-4 font-mono text-xs text-[#E0E0E0] leading-relaxed relative bg-[#0A0C10]">
        {activeTab === 'yaml' && (
          <div className="flex">
            {/* Line Numbers */}
            <div className="w-10 text-right pr-3 text-white/20 select-none border-r border-white/10 mr-4 font-mono text-xs">
              {Array.from({ length: Math.max(lineCount, 12) }, (_, i) => i + 1).map((n) => (
                <div key={n}>{n}</div>
              ))}
            </div>
            {/* Code Highlighted */}
            <pre className="m-0 text-blue-400 whitespace-pre font-mono text-xs">
              <code>{snippets.infrastructure_yaml || snippets.docker_compose}</code>
            </pre>
          </div>
        )}

        {activeTab === 'review' && (
          <div className="space-y-4 max-w-4xl p-2 font-mono">
            {/* Strengths */}
            <div className="bg-[#15181E] border border-blue-500/30 p-3.5 rounded">
              <div className="flex items-center gap-2 text-blue-400 font-bold text-xs mb-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>ARCHITECTURAL STRENGTHS</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-xs text-white/80">
                {review.strengths.map((s, idx) => (
                  <li key={idx}>{s}</li>
                ))}
              </ul>
            </div>

            {/* Issues */}
            <div className="bg-[#15181E] border border-red-500/30 p-3.5 rounded">
              <div className="flex items-center gap-2 text-red-400 font-bold text-xs mb-2">
                <AlertTriangle className="w-4 h-4" />
                <span>POTENTIAL BOTTLENECK & SECURITY RISKS</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-xs text-red-300">
                {review.issues.map((i, idx) => (
                  <li key={idx}>{i}</li>
                ))}
              </ul>
            </div>

            {/* Recommendations */}
            <div className="bg-[#15181E] border border-sky-500/30 p-3.5 rounded">
              <div className="flex items-center gap-2 text-sky-400 font-bold text-xs mb-2">
                <Lightbulb className="w-4 h-4" />
                <span>RECOMMENDED IMPROVEMENTS</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-xs text-white/80">
                {review.recommendations.map((r, idx) => (
                  <li key={idx}>{r}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'mermaid' && (
          <div className="flex flex-col gap-4">
            <div ref={mermaidRef} className="p-4 bg-[#15181E] border border-white/10 rounded flex justify-center items-center min-h-[160px]" />
            <div className="p-3 bg-[#15181E] rounded border border-white/10">
              <div className="text-[10px] text-white/40 mb-1 font-bold">RAW MERMAID CODE:</div>
              <pre className="text-xs text-blue-400 font-mono whitespace-pre-wrap">{mermaidSyntax}</pre>
            </div>
          </div>
        )}

        {activeTab === 'roadmap' && (
          <div className="space-y-3 font-mono text-xs max-w-4xl">
            {roadmap.map((step) => (
              <div key={step.step} className="p-3 bg-[#15181E] border border-white/10 rounded flex gap-3 items-start">
                <div className="w-6 h-6 rounded-full bg-blue-600/20 border border-blue-500 text-blue-400 font-bold flex items-center justify-center shrink-0">
                  {step.step}
                </div>
                <div>
                  <div className="font-bold text-white text-xs flex items-center gap-2">
                    <span>{step.task}</span>
                    {step.file_affected && (
                      <span className="text-[10px] text-blue-400 bg-blue-500/10 border border-blue-500/30 px-1.5 py-0.5 rounded">
                        {step.file_affected}
                      </span>
                    )}
                  </div>
                  <p className="text-white/50 text-xs mt-1">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
