import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Mic, MicOff, RefreshCw, Sparkles, Upload, VideoOff } from 'lucide-react';

import { SAMPLE_SKETCHES } from '../data/sampleDiagrams';
import { SampleSketch } from '../types';
import { MAX_PROMPT_HINT_LENGTH, SUPPORTED_IMAGE_MIME_TYPES } from '../shared/aiSpec';

interface CameraPaneProps {
  onCompile: (imageBase64: string, mimeType: string, promptHint: string) => void;
  onSelectSample: (sample: SampleSketch) => void;
  isCompiling: boolean;
}

/** Matches the server's MAX_IMAGE_BYTES so oversized files fail fast, before upload. */
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const CAPTURE_MIME = 'image/jpeg';
const CAPTURE_QUALITY = 0.9;

/** Minimal shape of the Web Speech API; it has no lib.dom typing in TS 5.8. */
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const CameraPane: React.FC<CameraPaneProps> = ({ onCompile, onSelectSample, isCompiling }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const [isCameraLive, setIsCameraLive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [promptHint, setPromptHint] = useState<string>('');
  const [preview, setPreview] = useState<{ dataUrl: string; mimeType: string } | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('IDLE — NO FRAME CAPTURED');

  const speechSupported = typeof window !== 'undefined' && getSpeechRecognition() !== null;

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsCameraLive(false);
  }, []);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('This browser has no camera API, or the page is not on HTTPS/localhost. Upload a photo instead.');
      return;
    }

    // Release any previous stream first; retrying otherwise leaks the old tracks
    // and leaves the camera indicator on.
    stopCamera();
    setCameraError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'environment' },
      });
      streamRef.current = stream;

      // The <video> element is always mounted, so the ref is guaranteed here.
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        return;
      }

      video.srcObject = stream;
      await video.play().catch(() => {
        /* autoplay rejection is non-fatal; the stream still renders once visible */
      });
      setIsCameraLive(true);
      setStatusMessage('LIVE — READY TO CAPTURE');
    } catch (err) {
      console.warn('Camera access not granted or unavailable:', err);
      stopCamera();
      setCameraError('Camera stream unavailable. Upload a photo or select a sample sketch below.');
    }
  }, [stopCamera]);

  // The camera runs only while the live feed is actually on screen. Holding a
  // captured still or waiting on a compile hides the video, so leaving the stream
  // open just kept the recording indicator lit and drained battery for a feed
  // nobody could see. Permission is remembered per origin, so resuming does not
  // re-prompt.
  const shouldStream = preview === null && !isCompiling;

  useEffect(() => {
    if (shouldStream) {
      void startCamera();
    } else {
      stopCamera();
    }
  }, [shouldStream, startCamera, stopCamera]);

  useEffect(() => stopCamera, [stopCamera]);

  const compilePreview = useCallback(
    (dataUrl: string, mimeType: string) => {
      setPreview({ dataUrl, mimeType });
      onCompile(dataUrl, mimeType, promptHint);
    },
    [onCompile, promptHint],
  );

  const handleCapture = useCallback(() => {
    // A held still frame takes priority: the button reads "COMPILE CURRENT FRAME"
    // in that state, so re-grabbing from the live feed would contradict the UI.
    if (preview) {
      onCompile(preview.dataUrl, preview.mimeType, promptHint);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (isCameraLive && video && canvas && video.videoWidth > 0) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        // JPEG rather than PNG: a 1280x720 photo is ~10x smaller, which matters
        // against the 8MB server limit.
        const dataUrl = canvas.toDataURL(CAPTURE_MIME, CAPTURE_QUALITY);
        setStatusMessage('CAPTURED — COMPILING');
        compilePreview(dataUrl, CAPTURE_MIME);
        return;
      }
    }

    const sample = SAMPLE_SKETCHES[0];
    if (sample) {
      setPreview({ dataUrl: sample.imageUrl, mimeType: 'image/svg+xml' });
      setStatusMessage(`SAMPLE: ${sample.title.toUpperCase()}`);
      onSelectSample(sample);
    }
  }, [compilePreview, isCameraLive, onCompile, onSelectSample, preview, promptHint]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow re-selecting the same file
    if (!file) return;

    if (!(SUPPORTED_IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) {
      setCameraError(`Unsupported file type "${file.type || 'unknown'}". Use PNG, JPEG, WebP, or HEIC.`);
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setCameraError(`That image is ${(file.size / 1024 / 1024).toFixed(1)}MB; the limit is 8MB.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const result = evt.target?.result;
      if (typeof result !== 'string') {
        setCameraError('Could not read that file.');
        return;
      }
      setCameraError(null);
      setStatusMessage(`LOADED: ${file.name.toUpperCase()}`);
      compilePreview(result, file.type);
    };
    reader.onerror = () => setCameraError('Could not read that file.');
    reader.readAsDataURL(file);
  };

  // Voice trigger: real Web Speech recognition, off by default. When the browser
  // has no support the control says so rather than animating a fake indicator.
  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    const Recognition = getSpeechRecognition();
    if (!Recognition) {
      setVoiceError('Voice commands need Chrome or Edge.');
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      const last = event.results[event.results.length - 1];
      const transcript = last?.[0]?.transcript?.toLowerCase() ?? '';
      if (transcript.includes('compile')) handleCapture();
    };
    recognition.onerror = (event) => {
      setVoiceError(event.error === 'not-allowed' ? 'Microphone permission denied.' : `Voice error: ${event.error}`);
      stopListening();
    };
    recognition.onend = () => setIsListening(false);

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setVoiceError(null);
      setIsListening(true);
    } catch (err) {
      console.warn('Speech recognition failed to start:', err);
      setVoiceError('Could not start voice recognition.');
    }
  }, [handleCapture, stopListening]);

  useEffect(() => stopListening, [stopListening]);

  const captureLabel = preview ? 'COMPILE CURRENT FRAME' : isCameraLive ? 'CAPTURE & COMPILE' : 'LOAD SAMPLE SKETCH';

  return (
    <section className="flex-1 bg-[#15181E] relative flex flex-col p-4 overflow-y-auto border-r border-white/10">
      <canvas ref={canvasRef} className="hidden" />

      <div className="font-mono text-xs text-white/50 flex items-center justify-between mb-3 select-none">
        <div className="flex items-center gap-2">
          <span className="text-blue-400 font-bold">INPUT: PAPER CAPTURE</span>
          <span className="text-white/20">|</span>
          <span className="text-white/40">Camera / Upload</span>
        </div>
        <span
          className={`text-[10px] px-2 py-0.5 rounded border font-mono ${
            isCameraLive
              ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
              : 'bg-white/5 text-white/40 border-white/10'
          }`}
          title={!shouldStream ? 'Camera released while a frame is held' : undefined}
        >
          {isCameraLive ? 'SCAN_READY' : shouldStream ? 'NO_FEED' : 'CAM_IDLE'}
        </span>
      </div>

      <div className="flex-1 relative border border-white/10 bg-[#0F1115] flex items-center justify-center overflow-hidden rounded min-h-[220px]">
        <div className="absolute left-0 w-full h-[2px] bg-blue-500 scan-line z-20 shadow-[0_0_12px_#3B82F6]" />
        <div className="bracket-tl absolute top-0 left-0 w-5 h-5 z-20 pointer-events-none" />
        <div className="bracket-tr absolute top-0 right-0 w-5 h-5 z-20 pointer-events-none" />
        <div className="bracket-bl absolute bottom-0 left-0 w-5 h-5 z-20 pointer-events-none" />
        <div className="bracket-br absolute bottom-0 right-0 w-5 h-5 z-20 pointer-events-none" />

        {/*
          The video element stays mounted at all times. Rendering it conditionally on
          camera state was a deadlock: the ref was null when the stream arrived, so
          the stream was never attached and the camera never went live.
          Not mirrored — this camera points at handwriting, and a mirrored preview
          would not match the frame that gets captured.
        */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${isCameraLive && !preview ? '' : 'hidden'}`}
        />

        {preview && (
          <div className="relative w-full h-full">
            <img src={preview.dataUrl} alt="Captured paper sketch" className="w-full h-full object-contain p-2" />
            <button
              type="button"
              onClick={() => {
                setPreview(null);
                setStatusMessage(isCameraLive ? 'LIVE — READY TO CAPTURE' : 'IDLE — NO FRAME CAPTURED');
              }}
              className="absolute top-3 right-3 bg-[#0F1115]/90 border border-blue-500/40 text-blue-400 text-[10px] font-mono px-2.5 py-1 rounded hover:bg-blue-600 hover:text-white transition-all cursor-pointer"
            >
              Clear frame
            </button>
          </div>
        )}

        {!preview && !isCameraLive && (
          <div className="font-mono text-xs text-white/50 text-center flex flex-col items-center gap-3 p-6">
            <VideoOff className="w-9 h-9 text-white/20" />
            <span className="text-white font-bold">NO CAMERA FEED</span>
            <p className="text-[11px] text-white/40 max-w-xs">
              {cameraError ?? (shouldStream ? 'Requesting camera access…' : 'Camera released while compiling.')}
            </p>
            <button
              type="button"
              onClick={() => void startCamera()}
              className="mt-1 px-3 py-1.5 bg-white/5 border border-blue-500/40 text-blue-400 rounded hover:bg-blue-600 hover:text-white transition-all flex items-center gap-1.5 text-[11px] cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry camera</span>
            </button>
          </div>
        )}

        <div className="absolute bottom-3 left-3 font-mono text-[10px] text-blue-400 bg-[#0F1115]/80 px-2.5 py-1 rounded border border-blue-500/30 backdrop-blur-md z-30">
          {statusMessage}
        </div>
      </div>

      <div className="mt-3 space-y-3 font-mono">
        <div className="flex items-center gap-2 bg-[#0F1115] border border-white/10 rounded px-3 py-2 focus-within:border-blue-500/50 transition-colors">
          <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
          <input
            type="text"
            value={promptHint}
            maxLength={MAX_PROMPT_HINT_LENGTH}
            onChange={(e) => setPromptHint(e.target.value)}
            placeholder="Prompt hint e.g. 'Add Redis cache & API gateway'…"
            aria-label="Prompt hint"
            className="w-full bg-transparent text-xs text-white focus:outline-none placeholder:text-white/30"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCapture}
            disabled={isCompiling}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs font-bold rounded transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(59,130,246,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Camera className="w-4 h-4" />
            <span>{isCompiling ? 'COMPILING…' : captureLabel}</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isCompiling}
            className="px-3.5 py-2.5 bg-white/5 border border-white/10 text-white/80 hover:text-white hover:border-blue-500/50 text-xs font-bold rounded transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Upload sketch photo"
          >
            <Upload className="w-4 h-4 text-blue-400" />
            <span className="hidden sm:inline">Upload</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={SUPPORTED_IMAGE_MIME_TYPES.join(',')}
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>

        {cameraError && preview === null && isCameraLive && (
          <p className="text-[11px] text-red-300 bg-red-900/20 border border-red-500/30 rounded px-2.5 py-1.5">{cameraError}</p>
        )}

        <div className="pt-2 border-t border-white/10">
          <div className="text-[11px] text-white/50 mb-2 flex items-center justify-between">
            <span>Demo samples:</span>
            <span className="text-blue-400 text-[10px]">Pre-analyzed diagrams</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {SAMPLE_SKETCHES.map((sample) => (
              <button
                type="button"
                key={sample.id}
                onClick={() => {
                  setPreview({ dataUrl: sample.imageUrl, mimeType: 'image/svg+xml' });
                  setStatusMessage(`SAMPLE: ${sample.title.toUpperCase()}`);
                  onSelectSample(sample);
                }}
                className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-500/50 p-2 rounded text-left transition-all group cursor-pointer"
              >
                <div className="text-[11px] font-bold text-white group-hover:text-blue-400 truncate">{sample.title}</div>
                <div className="text-[9px] text-white/40 truncate mt-0.5">{sample.description}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between p-2.5 bg-white/5 border border-white/10 rounded">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              disabled={!speechSupported}
              onClick={() => (isListening ? stopListening() : startListening())}
              aria-pressed={isListening}
              aria-label={isListening ? 'Stop listening for voice commands' : 'Listen for voice commands'}
              className={`w-6 h-6 rounded flex items-center justify-center border transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${
                isListening
                  ? 'bg-blue-600/20 border-blue-500 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.3)]'
                  : 'bg-white/5 border-white/10 text-white/40'
              }`}
            >
              {isListening ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
            </button>
            <span className="text-xs text-blue-400 truncate">
              {!speechSupported
                ? 'Voice commands unsupported in this browser'
                : voiceError
                  ? voiceError
                  : isListening
                    ? 'Listening — say "compile"'
                    : 'Voice trigger off'}
            </span>
          </div>
          <span className="text-[9px] text-white/30 shrink-0">WebSpeech</span>
        </div>
      </div>
    </section>
  );
};
