import React, { useRef, useState, useEffect } from 'react';
import { Camera, Upload, Mic, MicOff, RefreshCw, Sparkles, Image as ImageIcon, VideoOff } from 'lucide-react';
import { SAMPLE_SKETCHES } from '../data/sampleDiagrams';
import { SampleSketch } from '../types';

interface CameraPaneProps {
  onCompile: (imageBase64: string, promptHint?: string) => void;
  onSelectSample: (sample: SampleSketch) => void;
  isCompiling: boolean;
}

export const CameraPane: React.FC<CameraPaneProps> = ({ onCompile, onSelectSample, isCompiling }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [hasCamera, setHasCamera] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState<boolean>(true);
  const [promptHint, setPromptHint] = useState<string>('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('DETECTED: SYSTEM_ARCHITECTURE_V2');

  // Start WebCam
  const startCamera = async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'environment' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setHasCamera(true);
      }
    } catch (err: any) {
      console.warn('Camera access not granted or unavailable:', err);
      setHasCamera(false);
      setCameraError('Camera stream unavailable. Upload a photo or select a sample sketch below.');
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Capture frame from webcam
  const handleCapture = () => {
    if (videoRef.current && canvasRef.current && hasCamera) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        setPreviewImage(dataUrl);
        onCompile(dataUrl, promptHint);
      }
    } else if (previewImage) {
      onCompile(previewImage, promptHint);
    } else {
      // Default to sample sketch 0
      const sample = SAMPLE_SKETCHES[0];
      onSelectSample(sample);
    }
  };

  // File Upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const base64 = evt.target?.result as string;
        setPreviewImage(base64);
        setStatusMessage(`LOADED: ${file.name.toUpperCase()}`);
        onCompile(base64, promptHint);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <section className="flex-1 bg-[#15181E] relative flex flex-col p-4 overflow-hidden border-r border-white/10">
      {/* Hidden Canvas for Video Capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Terminal Top Line */}
      <div className="font-mono text-xs text-white/50 flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-blue-400 font-bold">INPUT: PAPER CAPTURE</span>
          <span className="text-white/20">|</span>
          <span className="text-white/40">Gemini 3.6 Lens</span>
        </div>
        <span className="text-[10px] bg-blue-500/10 px-2 py-0.5 rounded text-blue-400 border border-blue-500/30 font-mono">
          SCAN_READY
        </span>
      </div>

      {/* Camera / Image Preview Box */}
      <div className="flex-1 relative border border-white/10 bg-[#0F1115] flex items-center justify-center overflow-hidden rounded group min-h-[220px]">
        {/* Animated Scanner Laser Line */}
        <div className="absolute left-0 w-full h-[2px] bg-blue-500 scan-line z-20 shadow-[0_0_12px_#3B82F6]" />

        {/* Reticles / Grid Overlay */}
        <div className="absolute top-1/4 left-1/4 w-20 h-20 border border-blue-500/20 z-10 pointer-events-none" />
        <div className="absolute bottom-1/3 right-1/4 w-28 h-24 border border-blue-500/20 z-10 pointer-events-none" />

        {/* Corner Brackets */}
        <div className="bracket-tl absolute top-0 left-0 w-5 h-5 z-20 pointer-events-none" />
        <div className="bracket-tr absolute top-0 right-0 w-5 h-5 z-20 pointer-events-none" />
        <div className="bracket-bl absolute bottom-0 left-0 w-5 h-5 z-20 pointer-events-none" />
        <div className="bracket-br absolute bottom-0 right-0 w-5 h-5 z-20 pointer-events-none" />

        {/* Live Video or Image Preview */}
        {previewImage ? (
          <div className="relative w-full h-full">
            <img src={previewImage} alt="Paper Sketch Preview" className="w-full h-full object-contain p-2" />
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-3 right-3 bg-[#0F1115]/90 border border-blue-500/40 text-blue-400 text-[10px] font-mono px-2.5 py-1 rounded hover:bg-blue-600 hover:text-white transition-all cursor-pointer shadow-sm"
            >
              Reset Lens
            </button>
          </div>
        ) : hasCamera ? (
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1]" />
        ) : (
          <div className="font-mono text-xs text-white/50 text-center flex flex-col items-center gap-3 p-6 z-0">
            <VideoOff className="w-9 h-9 text-white/20" />
            <span className="text-white font-bold">NO HARDWARE CAMERA FEED</span>
            <p className="text-[11px] text-white/40 max-w-xs">{cameraError}</p>
            <button
              onClick={startCamera}
              className="mt-1 px-3 py-1.5 bg-white/5 border border-blue-500/40 text-blue-400 rounded hover:bg-blue-600 hover:text-white transition-all flex items-center gap-1.5 text-[11px] cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry WebCam Connection</span>
            </button>
          </div>
        )}

        {/* HUD Overlay Label */}
        <div className="absolute bottom-3 left-3 font-mono text-[10px] text-blue-400 bg-[#0F1115]/80 px-2.5 py-1 rounded border border-blue-500/30 backdrop-blur-md z-30">
          {statusMessage}
        </div>
      </div>

      {/* Main Action Bar */}
      <div className="mt-3 space-y-3 font-mono">
        {/* User Prompt Hint Input */}
        <div className="flex items-center gap-2 bg-[#0F1115] border border-white/10 rounded px-3 py-2 focus-within:border-blue-500/50 transition-colors">
          <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
          <input
            type="text"
            value={promptHint}
            onChange={(e) => setPromptHint(e.target.value)}
            placeholder="Prompt Hint e.g. 'Add Redis cache & API gateway'..."
            className="w-full bg-transparent text-xs text-white focus:outline-none placeholder:text-white/30"
          />
        </div>

        {/* Action Buttons Row */}
        <div className="flex gap-2">
          <button
            onClick={handleCapture}
            disabled={isCompiling}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs font-bold rounded transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(59,130,246,0.3)] disabled:opacity-50"
          >
            <Camera className="w-4 h-4" />
            <span>{hasCamera ? 'CAPTURE & COMPILE' : 'COMPILE CURRENT LENS'}</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isCompiling}
            className="px-3.5 py-2.5 bg-white/5 border border-white/10 text-white/80 hover:text-white hover:border-blue-500/50 text-xs font-bold rounded transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Upload Sketch Photo"
          >
            <Upload className="w-4 h-4 text-blue-400" />
            <span className="hidden sm:inline">Upload</span>
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
        </div>

        {/* Demo Samples Picker */}
        <div className="pt-2 border-t border-white/10">
          <div className="text-[11px] text-white/50 mb-2 flex items-center justify-between">
            <span>Instant Demo Samples (1-Click Pitch):</span>
            <span className="text-blue-400 text-[10px]">Pre-analyzed Diagrams</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {SAMPLE_SKETCHES.map((sample) => (
              <button
                key={sample.id}
                onClick={() => {
                  setPreviewImage(sample.imageUrl);
                  setStatusMessage(`SAMPLE: ${sample.title.toUpperCase()}`);
                  onSelectSample(sample);
                }}
                className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-500/50 p-2 rounded text-left transition-all group cursor-pointer"
              >
                <div className="text-[11px] font-bold text-white group-hover:text-blue-400 truncate">
                  {sample.title}
                </div>
                <div className="text-[9px] text-white/40 truncate mt-0.5">{sample.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Voice Trigger simulation indicator */}
        <div className="flex items-center justify-between p-2.5 bg-white/5 border border-white/10 rounded backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsListening(!isListening)}
              className={`w-6 h-6 rounded flex items-center justify-center border transition-all cursor-pointer ${
                isListening
                  ? 'bg-blue-600/20 border-blue-500 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.3)]'
                  : 'bg-white/5 border-white/10 text-white/40'
              }`}
            >
              {isListening ? <Mic className="w-3.5 h-3.5 animate-pulse" /> : <MicOff className="w-3.5 h-3.5" />}
            </button>
            <span className="text-xs text-blue-400">
              {isListening ? (
                <span className="animate-pulse">Listening for voice command 'Compile'...</span>
              ) : (
                'Voice Trigger Standby'
              )}
            </span>
          </div>
          <span className="text-[9px] text-white/30">WebSpeech</span>
        </div>
      </div>
    </section>
  );
};
