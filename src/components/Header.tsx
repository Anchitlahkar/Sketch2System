import React from 'react';
import { Download, Folder, Sparkles } from 'lucide-react';

import { APP_VERSION, LOW_CONFIDENCE_THRESHOLD } from '../shared/aiSpec';

interface HeaderProps {
  onOpenMentorModal: () => void;
  onExport: () => void;
  confidenceScore: number;
  /**
   * False for bundled samples and placeholder output. The score is the model's own
   * self-report about a sketch it read — with no sketch there is nothing to report,
   * and rendering the sample's canned 96% implied a measurement that never happened.
   */
  isConfidenceMeasured: boolean;
  /** Model reported by /api/health; falls back to the default until that resolves. */
  model: string;
  canExport: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenMentorModal,
  onExport,
  confidenceScore,
  isConfidenceMeasured,
  model,
  canExport,
}) => {
  const confidencePct = Math.round(confidenceScore * 100);
  const lowConfidence = confidenceScore < LOW_CONFIDENCE_THRESHOLD;

  return (
    <header className="bg-[#15181E] text-[#E0E0E0] font-sans fixed top-0 left-0 w-full h-16 z-50 border-b border-white/10 flex justify-between items-center px-6 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-600 rounded-sm flex items-center justify-center font-bold text-white text-xs shadow-[0_0_10px_rgba(59,130,246,0.4)] select-none">
          S2S
        </div>
        <div>
          <div className="flex items-center">
            <h1 className="text-base font-bold tracking-tight text-white">Sketch2System</h1>
            <span className="text-blue-500 font-mono text-xs ml-2 border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.5 rounded">
              v{APP_VERSION}
            </span>
          </div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">AI-Driven Architecture Compiler</p>
        </div>

        <div className="hidden lg:flex text-white/50 gap-2 items-center text-xs ml-6 pl-6 border-l border-white/10 font-mono">
          <Folder className="w-3.5 h-3.5 opacity-60 text-blue-400" />
          <span>dashboard</span>
          <span className="text-white/20">/</span>
          <span className="text-blue-400 font-bold">main_canvas</span>
          <span
            className={`ml-3 text-[10px] px-2 py-0.5 rounded font-mono border ${
              !isConfidenceMeasured
                ? 'bg-white/5 border-white/10 text-white/40'
                : lowConfidence
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                  : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
            }`}
            title={
              !isConfidenceMeasured
                ? 'No sketch was analyzed, so there is no confidence score'
                : lowConfidence
                  ? "Below the threshold — this is the model's own confidence in reading your sketch"
                  : "The model's self-reported confidence in reading your sketch"
            }
          >
            CONFIDENCE: {isConfidenceMeasured ? `${confidencePct}%` : 'N/A'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden md:flex flex-col items-end">
          <span className="text-[10px] text-white/40 uppercase tracking-wider font-mono">Target model</span>
          <span className="text-xs font-mono text-blue-400 font-semibold">{model}</span>
        </div>

        <div className="hidden md:block w-px h-8 bg-white/10" />

        <button
          type="button"
          onClick={onOpenMentorModal}
          className="flex items-center gap-2 px-3.5 py-1.5 bg-blue-600/10 border border-blue-500/30 rounded text-blue-400 text-xs font-semibold hover:bg-blue-600/20 hover:border-blue-500 transition-all font-mono cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Prompt & schema spec</span>
        </button>

        <button
          type="button"
          onClick={onExport}
          disabled={!canExport}
          title={canExport ? 'Download infrastructure.yaml, docker-compose.yml, Mermaid and JSON as a zip' : 'Compile a sketch first'}
          className="border border-white/20 text-white/90 px-3.5 py-1.5 rounded font-mono text-xs hover:border-blue-500 hover:text-blue-400 hover:bg-blue-500/10 transition-all uppercase tracking-wider flex items-center gap-1.5 cursor-pointer font-bold disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-white/20 disabled:hover:text-white/90 disabled:hover:bg-transparent"
        >
          <Download className="w-3.5 h-3.5 text-blue-400" />
          <span>Export .zip</span>
        </button>
      </div>
    </header>
  );
};
