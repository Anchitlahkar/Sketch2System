import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen, Check, Code2, Copy, ShieldAlert, Terminal, X, Zap } from 'lucide-react';

import { LOW_CONFIDENCE_THRESHOLD, RESPONSE_SCHEMA, SYSTEM_PROMPT, buildUserPrompt } from '../shared/aiSpec';

interface MentorDocsModalProps {
  isOpen: boolean;
  onClose: () => void;
  model: string;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export const MentorDocsModal: React.FC<MentorDocsModalProps> = ({ isOpen, onClose, model }) => {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Escape to close, Tab cycles inside the dialog, focus returns where it came from.
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!isOpen) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused.current?.focus();
    };
  }, [handleKeyDown, isOpen]);

  if (!isOpen) return null;

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard?.writeText(text);
      setCopiedSection(label);
      window.setTimeout(() => setCopiedSection(null), 2000);
    } catch {
      setCopiedSection(null);
    }
  };

  // Rendered from the same constants the server sends to Gemini, so the documented
  // spec cannot drift from the live one the way the old hardcoded copies did.
  const schemaSnippet = `import { Type } from "@google/genai";\n\nexport const RESPONSE_SCHEMA = ${JSON.stringify(
    RESPONSE_SCHEMA,
    null,
    2,
  )};`;

  const requestSnippet = `// server.ts — the live request this app makes
const response = await ai.models.generateContent({
  model: ${JSON.stringify(model)},
  contents: {
    parts: [
      { inlineData: { mimeType, data: imageData } },
      { text: userPrompt },
    ],
  },
  config: {
    systemInstruction: SYSTEM_PROMPT,
    temperature: 0.2,
    responseMimeType: 'application/json',
    responseSchema: RESPONSE_SCHEMA,
    abortSignal: controller.signal,
  },
});

const result = normalizeAnalysis(JSON.parse(response.text));`;

  const sections: Array<{ id: string; title: string; icon: React.ReactNode; body: string; tone: string }> = [
    { id: 'sysPrompt', title: '2. System prompt', icon: <Terminal className="w-4 h-4" />, body: SYSTEM_PROMPT, tone: 'text-blue-400' },
    { id: 'userPrompt', title: '3. User turn template', icon: <Terminal className="w-4 h-4" />, body: buildUserPrompt('Add Redis cache & API gateway'), tone: 'text-blue-400' },
    { id: 'schema', title: '4. Structured response schema', icon: <Code2 className="w-4 h-4" />, body: schemaSnippet, tone: 'text-sky-400' },
    { id: 'request', title: '5. Backend request', icon: <Terminal className="w-4 h-4" />, body: requestSnippet, tone: 'text-indigo-300' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-lg p-4 md:p-8 overflow-y-auto font-sans"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mentor-modal-title"
        onClick={(event) => event.stopPropagation()}
        className="bg-[#15181E] border border-blue-500/30 rounded-lg w-full max-w-5xl max-h-[90vh] flex flex-col shadow-[0_0_50px_rgba(59,130,246,0.2)] overflow-hidden"
      >
        <div className="bg-[#1A1D24] border-b border-white/10 px-6 py-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-blue-600/20 border border-blue-500/50 flex items-center justify-center text-blue-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 id="mentor-modal-title" className="text-base font-bold text-white flex items-center gap-2 flex-wrap">
                <span>Prompt &amp; schema specification</span>
                <span className="text-[10px] bg-blue-500/10 border border-blue-500/30 text-blue-400 px-2 py-0.5 rounded font-mono">
                  {model}
                </span>
              </h2>
              <p className="text-xs font-mono text-white/50">Rendered live from the constants the server actually sends</p>
            </div>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close specification"
            className="text-white/40 hover:text-white p-1.5 rounded border border-transparent hover:border-white/10 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 font-mono text-xs text-white/80 leading-relaxed">
          <section className="space-y-3 bg-[#0F1115] p-5 rounded border border-white/10">
            <h3 className="text-sm font-bold text-blue-400 flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              <span>1. Model selection &amp; prompt architecture</span>
            </h3>
            <div className="text-white/70 space-y-2">
              <p>
                <strong className="text-blue-300">Model:</strong>{' '}
                <code className="bg-black/50 text-blue-400 px-1.5 py-0.5 rounded">{model}</code>{' '}
                <span className="text-white/40">(set via the GEMINI_MODEL environment variable)</span>
              </p>
              <p>
                A Flash-tier multimodal model keeps latency low for live capture while still handling vision
                spatial reasoning and structured JSON output.
              </p>
              <div className="mt-3 bg-black/40 p-3 rounded border border-white/10 text-[11px]">
                <strong className="text-blue-400 block mb-1">Why each prompt section exists:</strong>
                <ul className="list-disc list-inside space-y-1 text-white/50">
                  <li>
                    <span className="text-white font-bold">Role definition:</span> sets an architect persona so the model
                    infers topology rather than captioning an image.
                  </li>
                  <li>
                    <span className="text-white font-bold">Reasoning over OCR:</span> mandates inferring implicit layers —
                    ports, protocols, TLS, pools, caches.
                  </li>
                  <li>
                    <span className="text-white font-bold">Spatial coordinates:</span> the canvas renders cards at the
                    returned (x, y), so the prompt states the exact card size and minimum spacing.
                  </li>
                  <li>
                    <span className="text-white font-bold">Untrusted input rule:</span> the image and the user hint are
                    data, not instructions — this is the prompt-injection guard.
                  </li>
                  <li>
                    <span className="text-white font-bold">Confidence &amp; retry:</span> anything below{' '}
                    {LOW_CONFIDENCE_THRESHOLD * 100}% is surfaced to the user as a warning rather than shown as fact.
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {sections.map((section) => (
            <section key={section.id} className="space-y-3 bg-[#0F1115] p-5 rounded border border-white/10">
              <div className="flex items-center justify-between gap-3">
                <h3 className={`text-sm font-bold flex items-center gap-2 ${section.tone}`}>
                  {section.icon}
                  <span>{section.title}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => void handleCopy(section.body, section.id)}
                  className={`hover:text-white text-[11px] flex items-center gap-1 cursor-pointer shrink-0 ${section.tone}`}
                >
                  {copiedSection === section.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSection === section.id ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className={`bg-black/50 p-4 rounded text-[11px] whitespace-pre-wrap overflow-x-auto border border-white/10 font-mono max-h-72 overflow-y-auto ${section.tone}`}>
                {section.body}
              </pre>
            </section>
          ))}

          <section className="space-y-3 bg-[#0F1115] p-5 rounded border border-white/10">
            <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" />
              <span>6. Guardrails in this implementation</span>
            </h3>
            <ul className="list-disc list-inside space-y-2 text-white/70">
              <li>
                <strong className="text-white">Schema + mime type:</strong> <code className="text-blue-400">responseMimeType</code>{' '}
                and <code className="text-blue-400">responseSchema</code> constrain the shape; every response is still
                re-validated server-side and client-side before it reaches the UI.
              </li>
              <li>
                <strong className="text-white">Low temperature (0.2):</strong> deterministic structure without flattening
                architectural inference.
              </li>
              <li>
                <strong className="text-white">Injection containment:</strong> the hint is JSON-encoded inside a delimiter
                and the system prompt marks image text and hints as untrusted data.
              </li>
              <li>
                <strong className="text-white">Output sanitation:</strong> Mermaid is stripped of{' '}
                <code className="text-blue-400">click</code>/script directives and rendered with{' '}
                <code className="text-blue-400">securityLevel: 'strict'</code>.
              </li>
              <li>
                <strong className="text-white">Honest degradation:</strong> if the key is missing or Gemini fails, the
                response is labelled <code className="text-blue-400">source: "mock"</code> and the UI shows a banner —
                placeholder output is never presented as a real analysis.
              </li>
            </ul>
          </section>
        </div>

        <div className="bg-[#1A1D24] border-t border-white/10 px-6 py-3 flex justify-between items-center shrink-0">
          <span className="text-[10px] text-white/40">Built with the @google/genai TypeScript SDK</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold font-mono text-xs rounded transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
