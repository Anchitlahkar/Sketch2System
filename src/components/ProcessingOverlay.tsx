import React, { useEffect, useState } from 'react';
import { Cpu } from 'lucide-react';

interface ProcessingOverlayProps {
  isVisible: boolean;
}

// Module scope: recreating this each render made it an unstable effect dependency.
const STEPS = [
  'Parsing paper handwriting & shapes…',
  'Extracting architectural nodes & ports…',
  'Synthesizing network protocol paths…',
  'Evaluating security & scale considerations…',
  'Generating Docker Compose & Mermaid output…',
] as const;

export const ProcessingOverlay: React.FC<ProcessingOverlayProps> = ({ isVisible }) => {
  const [stepIndex, setStepIndex] = useState<number>(0);

  useEffect(() => {
    if (!isVisible) {
      setStepIndex(0);
      return;
    }
    const interval = window.setInterval(() => {
      // Hold on the last step instead of looping: the model does not restart.
      setStepIndex((prev) => Math.min(prev + 1, STEPS.length - 1));
    }, 1800);
    return () => window.clearInterval(interval);
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md"
    >
      <div className="bg-[#15181E] border border-blue-500/30 rounded-lg p-8 flex flex-col items-center justify-center gap-6 min-w-[340px] max-w-[420px] relative overflow-hidden shadow-[0_0_40px_rgba(59,130,246,0.25)]">
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative w-20 h-20 flex items-center justify-center">
          <div className="absolute inset-0 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          <Cpu className="w-8 h-8 text-blue-400" />
        </div>

        <div className="flex flex-col items-center gap-2 text-center z-10">
          <span className="font-mono text-[10px] text-blue-400 uppercase tracking-widest font-bold">
            Compiling sketch
          </span>
          <span className="font-mono text-sm text-white font-bold">{STEPS[stepIndex]}</span>
        </div>

        {/*
          Indeterminate by design. The previous bar mapped a fixed timer to a
          percentage, which implied progress the app cannot actually measure.
        */}
        <div className="w-full h-1.5 bg-black/50 rounded-full overflow-hidden z-10 border border-white/10">
          <div className="h-full w-1/3 bg-gradient-to-r from-blue-600 to-sky-400 rounded-full indeterminate-bar" />
        </div>
      </div>
    </div>
  );
};
