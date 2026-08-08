import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, CheckCircle2, Copy, FileCode, Lightbulb, MapPin, Play } from 'lucide-react';
import mermaid from 'mermaid';

import { ArchitectureReview, GeneratedCodeSnippets, ImplementationStep } from '../types';

export type EditorTab = 'yaml' | 'review' | 'mermaid' | 'roadmap';

interface CodeEditorPaneProps {
  snippets: GeneratedCodeSnippets;
  review: ArchitectureReview;
  roadmap: ImplementationStep[];
  mermaidSyntax: string;
  activeTab: EditorTab;
  onTabChange: (tab: EditorTab) => void;
}

const TABS: Array<{ id: EditorTab; label: string; icon: React.ReactNode }> = [
  { id: 'yaml', label: 'infrastructure.yaml', icon: <FileCode className="w-3.5 h-3.5" /> },
  { id: 'review', label: 'Architecture Review', icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> },
  { id: 'mermaid', label: 'Mermaid Diagram', icon: <Play className="w-3.5 h-3.5 text-blue-400" /> },
  { id: 'roadmap', label: 'Implementation Plan', icon: <MapPin className="w-3.5 h-3.5 text-blue-400" /> },
];

// `securityLevel: 'strict'` (the default) sanitizes labels and disables click
// bindings. This content is model-generated from an untrusted image, so 'loose'
// would be a direct script-injection path.
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'strict',
  fontFamily: 'JetBrains Mono, monospace',
});

export const CodeEditorPane: React.FC<CodeEditorPaneProps> = ({
  snippets,
  review,
  roadmap,
  mermaidSyntax,
  activeTab,
  onTabChange,
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [mermaidSvg, setMermaidSvg] = useState<string | null>(null);
  const [mermaidError, setMermaidError] = useState<string | null>(null);
  const renderSeq = useRef(0);

  useEffect(() => {
    if (activeTab !== 'mermaid') return;

    if (!mermaidSyntax.trim()) {
      setMermaidSvg(null);
      setMermaidError(null);
      return;
    }

    // Monotonic id plus a cancellation flag: two renders in the same millisecond
    // used to collide, and a slow render could overwrite a newer diagram.
    renderSeq.current += 1;
    const seq = renderSeq.current;
    let cancelled = false;

    void (async () => {
      try {
        const { svg } = await mermaid.render(`mermaid-graph-${seq}`, mermaidSyntax);
        if (cancelled || seq !== renderSeq.current) return;
        setMermaidSvg(svg);
        setMermaidError(null);
      } catch (err) {
        if (cancelled || seq !== renderSeq.current) return;
        console.warn('Mermaid render failed:', err);
        setMermaidSvg(null);
        setMermaidError('This diagram is not valid Mermaid syntax. The raw source is shown below.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTab, mermaidSyntax]);

  const activeText = useCallback((): string => {
    switch (activeTab) {
      case 'yaml':
        return snippets.infrastructure_yaml || snippets.docker_compose || '# No YAML generated yet.';
      case 'mermaid':
        return mermaidSyntax || '%% No diagram generated yet.';
      case 'review':
        return [
          `STRENGTHS:\n${review.strengths.map((s) => `- ${s}`).join('\n')}`,
          `ISSUES:\n${review.issues.map((i) => `- ${i}`).join('\n')}`,
          `RECOMMENDATIONS:\n${review.recommendations.map((r) => `- ${r}`).join('\n')}`,
        ].join('\n\n');
      case 'roadmap':
        return roadmap
          .map((s) => `Step ${s.step}: ${s.task}\n${s.description}\nFile: ${s.file_affected ?? 'N/A'}`)
          .join('\n\n');
    }
  }, [activeTab, mermaidSyntax, review, roadmap, snippets]);

  const handleCopy = async () => {
    setCopyError(null);
    try {
      if (!navigator.clipboard) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(activeText());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError('Copy failed — select the text manually.');
      window.setTimeout(() => setCopyError(null), 3000);
    }
  };

  const yamlText = snippets.infrastructure_yaml || snippets.docker_compose;
  const yamlLines = yamlText ? yamlText.split('\n') : [];

  return (
    <div className="flex-1 bg-[#0A0C10] flex flex-col min-h-[260px] max-h-[380px] border-t border-white/10">
      <div className="h-9 bg-[#15181E] border-b border-white/10 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2" role="tablist" aria-label="Generated artifacts">
          {TABS.map((tab) => (
            <button
              type="button"
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`font-mono text-[11px] px-3 py-1 rounded-t flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-[#0A0C10] text-blue-400 border-t-2 border-blue-500 font-bold'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => void handleCopy()}
          className="text-white/50 hover:text-blue-400 transition-colors flex items-center gap-1 text-[10px] font-mono cursor-pointer"
          title="Copy tab content"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-blue-400">Copied!</span>
            </>
          ) : copyError ? (
            <span className="text-red-300">{copyError}</span>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 font-mono text-xs text-[#E0E0E0] leading-relaxed bg-[#0A0C10]">
        {activeTab === 'yaml' &&
          (yamlLines.length > 0 ? (
            <div className="flex">
              <div
                aria-hidden="true"
                className="w-10 text-right pr-3 text-white/20 select-none border-r border-white/10 mr-4 font-mono text-xs leading-relaxed"
              >
                {yamlLines.map((_, index) => (
                  <div key={index}>{index + 1}</div>
                ))}
              </div>
              <pre className="m-0 text-blue-400 whitespace-pre font-mono text-xs leading-relaxed">
                <code>{yamlText}</code>
              </pre>
            </div>
          ) : (
            <p className="text-white/40">No infrastructure code generated yet.</p>
          ))}

        {activeTab === 'review' && (
          <div className="space-y-4 max-w-4xl p-2 font-mono">
            <ReviewBlock
              title="ARCHITECTURAL STRENGTHS"
              items={review.strengths}
              tone="border-blue-500/30 text-blue-400"
              body="text-white/80"
              icon={<CheckCircle2 className="w-4 h-4" />}
            />
            <ReviewBlock
              title="POTENTIAL BOTTLENECKS & SECURITY RISKS"
              items={review.issues}
              tone="border-red-500/30 text-red-400"
              body="text-red-300"
              icon={<AlertTriangle className="w-4 h-4" />}
            />
            <ReviewBlock
              title="RECOMMENDED IMPROVEMENTS"
              items={review.recommendations}
              tone="border-sky-500/30 text-sky-400"
              body="text-white/80"
              icon={<Lightbulb className="w-4 h-4" />}
            />
          </div>
        )}

        {activeTab === 'mermaid' && (
          <div className="flex flex-col gap-4">
            <div className="p-4 bg-[#15181E] border border-white/10 rounded flex justify-center items-center min-h-[160px] overflow-x-auto">
              {mermaidSvg ? (
                // Sanitized by mermaid's strict security level, and the source was
                // additionally stripped of click/script directives during validation.
                <div dangerouslySetInnerHTML={{ __html: mermaidSvg }} />
              ) : (
                <span className="text-white/40 text-xs">{mermaidError ?? 'No diagram generated yet.'}</span>
              )}
            </div>
            {mermaidSyntax && (
              <div className="p-3 bg-[#15181E] rounded border border-white/10">
                <div className="text-[10px] text-white/40 mb-1 font-bold">RAW MERMAID SOURCE:</div>
                <pre className="text-xs text-blue-400 font-mono whitespace-pre-wrap">{mermaidSyntax}</pre>
              </div>
            )}
          </div>
        )}

        {activeTab === 'roadmap' &&
          (roadmap.length > 0 ? (
            <ol className="space-y-3 font-mono text-xs max-w-4xl">
              {roadmap.map((step, index) => (
                <li key={`${step.step}-${index}`} className="p-3 bg-[#15181E] border border-white/10 rounded flex gap-3 items-start">
                  <div className="w-6 h-6 rounded-full bg-blue-600/20 border border-blue-500 text-blue-400 font-bold flex items-center justify-center shrink-0">
                    {step.step}
                  </div>
                  <div>
                    <div className="font-bold text-white text-xs flex items-center gap-2 flex-wrap">
                      <span>{step.task}</span>
                      {step.file_affected && (
                        <span className="text-[10px] text-blue-400 bg-blue-500/10 border border-blue-500/30 px-1.5 py-0.5 rounded">
                          {step.file_affected}
                        </span>
                      )}
                    </div>
                    <p className="text-white/50 text-xs mt-1">{step.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-white/40">No implementation plan generated yet.</p>
          ))}
      </div>
    </div>
  );
};

const ReviewBlock: React.FC<{
  title: string;
  items: string[];
  tone: string;
  body: string;
  icon: React.ReactNode;
}> = ({ title, items, tone, body, icon }) => (
  <div className={`bg-[#15181E] border p-3.5 rounded ${tone.split(' ')[0]}`}>
    <div className={`flex items-center gap-2 font-bold text-xs mb-2 ${tone.split(' ')[1]}`}>
      {icon}
      <span>{title}</span>
    </div>
    {items.length > 0 ? (
      <ul className={`list-disc list-inside space-y-1 text-xs ${body}`}>
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    ) : (
      <p className="text-white/30 text-xs">Nothing reported.</p>
    )}
  </div>
);
