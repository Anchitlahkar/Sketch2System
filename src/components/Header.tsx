import React from 'react';
import { Download, Sparkles, Folder } from 'lucide-react';

interface HeaderProps {
  onOpenMentorModal: () => void;
  onExportGithub: () => void;
  confidenceScore?: number;
}

export const Header: React.FC<HeaderProps> = ({ onOpenMentorModal, onExportGithub, confidenceScore }) => {
  return (
    <header className="bg-[#15181E] text-[#E0E0E0] font-sans fixed top-0 left-0 w-full h-16 z-50 border-b border-white/10 flex justify-between items-center px-6 select-none shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-600 rounded-sm flex items-center justify-center font-bold text-white text-xs shadow-[0_0_10px_rgba(59,130,246,0.4)]">
          S2S
        </div>
        <div>
          <div className="flex items-center">
            <h1 className="text-base font-bold tracking-tight text-white flex items-center">
              Sketch2System
            </h1>
            <span className="text-blue-500 font-mono text-xs ml-2 border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.5 rounded">
              v1.0.4-PROMPT_WARS
            </span>
          </div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">
            AI-Driven Architecture Compiler
          </p>
        </div>

        {/* Breadcrumbs */}
        <div className="hidden lg:flex text-white/50 gap-2 items-center text-xs ml-6 pl-6 border-l border-white/10 font-mono">
          <Folder className="w-3.5 h-3.5 opacity-60 text-blue-400" />
          <span className="hover:text-blue-400 transition-colors cursor-pointer">dashboard</span>
          <span className="text-white/20">/</span>
          <span className="text-blue-400 font-bold">main_canvas</span>
          {confidenceScore !== undefined && (
            <span className="ml-3 text-[10px] bg-blue-500/10 border border-blue-500/30 text-blue-400 px-2 py-0.5 rounded font-mono">
              CONFIDENCE: {(confidenceScore * 100).toFixed(0)}%
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Model telemetry */}
        <div className="hidden md:flex flex-col items-end">
          <span className="text-[10px] text-white/40 uppercase tracking-wider font-mono">Target Model</span>
          <span className="text-xs font-mono text-blue-400 font-semibold">gemini-3.6-flash</span>
        </div>

        <div className="hidden md:block w-px h-8 bg-white/10"></div>

        <button
          onClick={onOpenMentorModal}
          className="flex items-center gap-2 px-3.5 py-1.5 bg-blue-600/10 border border-blue-500/30 rounded text-blue-400 text-xs font-semibold hover:bg-blue-600/20 hover:border-blue-500 transition-all font-mono cursor-pointer shadow-[0_0_12px_rgba(59,130,246,0.15)]"
        >
          <Sparkles className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
          <span>Pitch Specs & Prompt Blueprint</span>
        </button>

        <button
          onClick={onExportGithub}
          className="border border-white/20 text-white/90 px-3.5 py-1.5 rounded font-mono text-xs hover:border-blue-500 hover:text-blue-400 hover:bg-blue-500/10 transition-all uppercase tracking-wider flex items-center gap-1.5 cursor-pointer font-bold"
        >
          <Download className="w-3.5 h-3.5 text-blue-400" />
          <span>Export Repository</span>
        </button>
      </div>
    </header>
  );
};

