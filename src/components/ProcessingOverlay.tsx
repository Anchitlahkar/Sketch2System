import React, { useState, useEffect } from 'react';
import { Cpu } from 'lucide-react';

interface ProcessingOverlayProps {
  isVisible: boolean;
}

export const ProcessingOverlay: React.FC<ProcessingOverlayProps> = ({ isVisible }) => {
  const [stepIndex, setStepIndex] = useState<number>(0);

  const steps = [
    'Parsing paper handwriting & shapes...',
    'Extracting architectural nodes & ports...',
    'Synthesizing network protocol paths...',
    'Evaluating security & scale vulnerabilities...',
    'Generating Docker Compose & Mermaid code...'
  ];

  useEffect(() => {
    if (!isVisible) {
      setStepIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setStepIndex((prev) => (prev + 1) % steps.length);
    }, 1800);
    return () => clearInterval(interval);
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md transition-all duration-300 select-none">
      <div className="bg-[#15181E] border border-blue-500/30 rounded-lg p-8 flex flex-col items-center justify-center gap-6 min-w-[340px] max-w-[420px] relative overflow-hidden shadow-[0_0_40px_rgba(59,130,246,0.25)]">
        {/* Glow Accent Circles */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Spinner */}
        <div className="relative w-20 h-20 flex items-center justify-center">
          <div className="absolute inset-0 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          <div className="absolute inset-2 border-2 border-dashed border-sky-400/40 rounded-full animate-[spin_3s_linear_reverse_infinite]" />
          <Cpu className="w-8 h-8 text-blue-400 animate-pulse" />
        </div>

        {/* Dynamic Status Text */}
        <div className="flex flex-col items-center gap-2 text-center z-10">
          <span className="font-mono text-[10px] text-blue-400 uppercase tracking-widest font-bold">
            Gemini Vision Processing
          </span>
          <span className="font-mono text-sm text-white animate-pulse font-bold">
            {steps[stepIndex]}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1.5 bg-black/50 rounded-full overflow-hidden z-10 border border-white/10">
          <div
            className="h-full bg-gradient-to-r from-blue-600 to-sky-400 rounded-full transition-all duration-500 shadow-[0_0_12px_#3B82F6]"
            style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
};
