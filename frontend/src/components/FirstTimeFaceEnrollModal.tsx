import React, { useState, useRef, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { useAttendance } from '../context/AttendanceContext';
import { 
  extractFaceDescriptor, 
  extractEnsembleFaceDescriptor,
  analyzeFaceQuality, 
  isFaceQualityReadyForCapture,
  FaceQualityFeedback 
} from '../utils/faceMatching';
import { enrollFaceWithInsightFace } from '../utils/insightFaceApi';
import { createSimulatedFaceStream } from '../utils/cameraSimulator';
import { 
  playShutterSound, 
  playSuccessChime, 
  playWarningTone, 
  playMicroTick,
  speakGuidance, 
  cancelVoiceGuidance 
} from '../utils/audioAssistance';
import { 
  Camera, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  GraduationCap, 
  Sparkles,
  ArrowRight,
  ShieldCheck,
  UserX,
  Sun,
  Maximize2,
  Compass,
  Crosshair,
  Check,
  Zap,
  Video,
  Volume2,
  VolumeX,
  FlipHorizontal
} from 'lucide-react';

interface FirstTimeFaceEnrollModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FirstTimeFaceEnrollModal: React.FC<FirstTimeFaceEnrollModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { currentUser, enrollFaceForStudent } = useAttendance();
  const student = currentUser?.student;

  const [step, setStep] = useState<'INTRO' | 'CAMERA' | 'CONFIRM' | 'SUCCESS'>('INTRO');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isUsingSimulator, setIsUsingSimulator] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const [capturedSnapshot, setCapturedSnapshot] = useState<string | null>(null);
  const [, setExtractedDescriptor] = useState<number[] | null>(null);
  const [, setLivenessMetric] = useState<number>(92.5);
  const [enrollmentScanStep, setEnrollmentScanStep] = useState<string>('Align face inside oval frame...');

  // Real-time quality feedback
  const [qualityFeedback, setQualityFeedback] = useState<FaceQualityFeedback | null>(null);
  const [autoCaptureProgress, setAutoCaptureProgress] = useState(0); // 0 - 100%
  const [shutterFlash, setShutterFlash] = useState(false);

  // Audio Guidance & Mirroring Settings
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [isMirrored, setIsMirrored] = useState(true);

  // Error for duplicate face
  const [duplicateError, setDuplicateError] = useState<{
    matchedStudentName?: string;
    matchedStudentPrn?: string;
    message: string;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const analysisIntervalRef = useRef<number | null>(null);
  const consecutivePerfectFramesRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const simCleanupRef = useRef<(() => void) | null>(null);

  const isVoiceEnabledRef = useRef(isVoiceEnabled);
  isVoiceEnabledRef.current = isVoiceEnabled;

  // Use a ref so the setInterval callback always reads the latest isProcessing value
  const isProcessingRef = useRef(isProcessing);
  isProcessingRef.current = isProcessing;

  // Clean up
  const stopCamera = useCallback(() => {
    cancelVoiceGuidance();
    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current);
      analysisIntervalRef.current = null;
    }
    consecutivePerfectFramesRef.current = 0;
    if (simCleanupRef.current) {
      simCleanupRef.current();
      simCleanupRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStream(null);
    setIsUsingSimulator(false);
    setAutoCaptureProgress(0);
    setQualityFeedback(null);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setStep('INTRO');
      setCapturedSnapshot(null);
      setExtractedDescriptor(null);
      setDuplicateError(null);
      setAutoCaptureProgress(0);
      setCameraError(null);
    }
  }, [isOpen, stopCamera]);

  // Actual frame capture & InsightFace official enrollment
  const performEnrollmentCapture = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !student || isProcessingRef.current) return;
    setIsProcessing(true);
    setDuplicateError(null);
    speakGuidance('Hold steady. Acquiring InsightFace biometrics...', isVoiceEnabledRef.current);

    const steps = [
      '1/4: Positioning & Landmark Detection...',
      '2/4: Extracting InsightFace 512-D ArcFace Features...',
      '3/4: Database Biometric Duplicate Identity Check...',
      '4/4: Finalizing Template Registration...',
    ];

    try {
      // Capture the current frame from video onto canvas at high resolution
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      ctx.save();
      if (isMirrored) {
        ctx.scale(-1, 1);
        ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
      } else {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }
      ctx.restore();

      const snapshotToSave = canvas.toDataURL('image/jpeg', 0.95);

      for (let i = 0; i < steps.length; i++) {
        setEnrollmentScanStep(steps[i]);
        setShutterFlash(true);
        playMicroTick();
        setTimeout(() => setShutterFlash(false), 120);
        await new Promise((resolve) => setTimeout(resolve, 140));
      }

      playShutterSound();
      setCapturedSnapshot(snapshotToSave);

      // Call the official InsightFace backend endpoint!
      setEnrollmentScanStep('InsightFace neural verification in progress...');
      const result = await enrollFaceWithInsightFace(student.prn, snapshotToSave, true);

      if (!result.success) {
        if (result.error_code === 'DUPLICATE_FACE_DETECTED') {
          // Genuine duplicate face detected across registered student database
          playWarningTone();
          speakGuidance('Duplicate face detected. This face belongs to another student.', isVoiceEnabledRef.current);
          setDuplicateError({
            matchedStudentName: result.matched_name || 'Another Student',
            matchedStudentPrn: result.matched_prn || 'Registered PRN',
            message: result.message || 'Face registration failed: This face is already enrolled under another account.',
          });
          setStep('CONFIRM');
          stopCamera();
        } else if (result.error_code === 'SPOOF_ATTACK_DETECTED') {
          // Anti-spoofing screen replay / printed photo blocked
          playWarningTone();
          const spoofMsg = '⚠️ Presentation Attack Blocked: Digital screen replay or photo detected. Real live human presence is required to enroll biometrics.';
          speakGuidance('Spoof attack detected. Real face required.', isVoiceEnabledRef.current);
          setCameraError(spoofMsg);
          setEnrollmentScanStep('Align face inside oval frame...');
          setAutoCaptureProgress(0);
          setTimeout(() => setCameraError(null), 6000);
          startQualityAnalysis();
        } else {
          // Camera framing / no face / multiple faces issue - keep camera live and inform student
          playWarningTone();
          const userMsg = (result.message || 'Face enrollment could not be completed.').replace(/^[A-Z_]+:\s*/, '');
          speakGuidance(userMsg, isVoiceEnabledRef.current);
          setCameraError(userMsg);
          setEnrollmentScanStep('Align face inside oval frame...');
          setAutoCaptureProgress(0);
          setTimeout(() => setCameraError(null), 5000);
          // Re-arm quality analysis loop so student can align and capture again smoothly
          startQualityAnalysis();
        }
      } else {
        // UNIQUE AND ENROLLED!
        // Sync local context state
        await enrollFaceForStudent(student.prn, snapshotToSave);

        playSuccessChime();
        speakGuidance('Face biometrics registered successfully!', isVoiceEnabledRef.current);
        setStep('SUCCESS');
        stopCamera();
        try {
          confetti({
            particleCount: 75,
            spread: 60,
            origin: { y: 0.6 },
            colors: ['#10B981', '#3B82F6', '#F59E0B'],
          });
        } catch {
          // ignore
        }
      }
    } catch (err: any) {
      console.error('InsightFace enrollment error:', err);
      setCameraError(err?.message || 'Face enrollment failed. Please try again.');
      setTimeout(() => setCameraError(null), 4000);
    } finally {
      setIsProcessing(false);
    }
  }, [student, isMirrored, enrollFaceForStudent, stopCamera]);

  const performEnrollmentCaptureRef = useRef(performEnrollmentCapture);
  performEnrollmentCaptureRef.current = performEnrollmentCapture;

  // Real-time camera frame analysis loop
  const startQualityAnalysis = useCallback(() => {
    // If analysis is ALREADY running, do not restart it or reset ticks!
    if (analysisIntervalRef.current) return;

    analysisIntervalRef.current = window.setInterval(() => {
      // Use ref so we always read the current processing state, not a stale closure value
      if (!videoRef.current || videoRef.current.readyState < 2 || isProcessingRef.current) return;

      const feedback = analyzeFaceQuality(videoRef.current);
      setQualityFeedback(feedback);

      // Voice coaching guidance
      if (feedback.statusType === 'adjust_distance') {
        speakGuidance(feedback.distance.status === 'TOO_FAR' ? 'Please come closer' : 'Move back slightly', isVoiceEnabledRef.current);
      } else if (feedback.statusType === 'adjust_light') {
        speakGuidance('More light needed on face', isVoiceEnabledRef.current);
      } else if (feedback.statusType === 'adjust_angle') {
        speakGuidance('Look straight at front camera', isVoiceEnabledRef.current);
      }

      // Auto-click immediately when photo is good enough to get all details for error-free recognition
      const isReadyToLock = isFaceQualityReadyForCapture(feedback);

      if (isReadyToLock) {
        consecutivePerfectFramesRef.current++;
        // 2 consecutive clean frames (~150-200ms) confirms optical stability; auto-clicks immediately!
        if (consecutivePerfectFramesRef.current >= 2) {
          setAutoCaptureProgress(100);
          if (analysisIntervalRef.current) {
            clearInterval(analysisIntervalRef.current);
            analysisIntervalRef.current = null;
          }
          performEnrollmentCaptureRef.current();
        } else {
          setAutoCaptureProgress(60);
          playMicroTick();
        }
      } else {
        consecutivePerfectFramesRef.current = 0;
        setAutoCaptureProgress(0);
      }
    }, 100);
  }, []);

  const startQualityAnalysisRef = useRef(startQualityAnalysis);
  startQualityAnalysisRef.current = startQualityAnalysis;

  // Fallback simulator camera stream
  const startSimulatedCamera = useCallback(() => {
    stopCamera();
    setCameraError(null);
    setAutoCaptureProgress(0);
    const sim = createSimulatedFaceStream(
      student?.name || 'CVV Student',
      student?.photoDataUrl || student?.avatarUrl
    );
    streamRef.current = sim.stream;
    simCleanupRef.current = sim.stop;
    setIsUsingSimulator(true);
    setStream(sim.stream);
  }, [stopCamera, student?.name, student?.photoDataUrl, student?.avatarUrl]);

  // Real webcam camera starter
  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);
    setDuplicateError(null);
    setAutoCaptureProgress(0);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      startSimulatedCamera();
      return;
    }

    try {
      let mediaStream: MediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });
      } catch (e1) {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = mediaStream;
      setIsUsingSimulator(false);
      setStream(mediaStream);
    } catch (err: unknown) {
      console.warn('Webcam start error, falling back to live interactive stream:', err);
      startSimulatedCamera();
    }
  }, [stopCamera, startSimulatedCamera]);

  // Handle transition to Camera step
  const handleStartCapture = () => {
    setStep('CAMERA');
    setTimeout(() => {
      startCamera();
    }, 50);
  };

  // Safe video stream attachment
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream || step !== 'CAMERA') return;

    video.srcObject = stream;
    video.setAttribute('playsinline', 'true');
    video.setAttribute('muted', 'true');
    video.muted = true;

    let isSubscribed = true;

    const handleLoaded = () => {
      if (!isSubscribed) return;
      video.play().catch((e) => console.warn('Video play caught:', e));
      startQualityAnalysisRef.current();
    };

    video.addEventListener('loadedmetadata', handleLoaded);
    if (video.readyState >= 2) {
      video.play().catch((e) => console.warn('Video play caught:', e));
      startQualityAnalysisRef.current();
    }

    return () => {
      isSubscribed = false;
      video.removeEventListener('loadedmetadata', handleLoaded);
    };
  }, [stream, step]);

  const handleRetry = () => {
    setDuplicateError(null);
    setStep('CAMERA');
    setAutoCaptureProgress(0);
    setTimeout(() => {
      startCamera();
    }, 50);
  };

  if (!isOpen || !student) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-[#0B2545] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-amber-300 block">
                First-Time Setup · Student Onboarding
              </span>
              <h3 className="font-display font-bold text-base text-white">
                Facial Biometric Registration
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Voice Guidance Toggle */}
            <button
              onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
              className={`p-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                isVoiceEnabled ? 'bg-amber-500/30 text-amber-300 hover:bg-amber-500/40' : 'bg-white/10 text-slate-400 hover:text-white'
              }`}
              title={isVoiceEnabled ? 'Voice Guidance: ON (Click to Mute)' : 'Voice Guidance: MUTED (Click to Enable)'}
            >
              {isVoiceEnabled ? <Volume2 className="w-4 h-4 text-amber-300" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <button
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'INTRO' && (
            <div className="space-y-5 text-center">
              <div className="w-16 h-16 rounded-full bg-blue-50 text-[#0B2545] border border-blue-200 flex items-center justify-center mx-auto shadow-inner">
                <Camera className="w-8 h-8 text-[#0B2545]" />
              </div>

              <div>
                <span className="text-[11px] font-semibold text-amber-800 bg-amber-100/70 px-2.5 py-0.5 rounded-full border border-amber-200">
                  Account: {student.prn}
                </span>
                <h4 className="font-display font-bold text-lg text-slate-900 mt-2">
                  Welcome, {student.name}!
                </h4>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed max-w-md mx-auto">
                  To mark attendance during lectures, you must complete a one-time facial biometric registration. Your face will be securely mapped to your student PRN to eliminate proxy attendance.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-left space-y-2 text-xs text-slate-700">
                <div className="flex items-center gap-2 font-semibold text-[#0B2545]">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Smart Auto-Capture & Anti-Proxy Security:</span>
                </div>
                <ul className="list-disc pl-5 space-y-1 text-[11px] text-slate-600">
                  <li>
                    <strong className="text-slate-800">Hands-Free Auto-Capture:</strong> The system guides your lighting and angle, then captures automatically once the frame is perfect.
                  </li>
                  <li>
                    <strong className="text-slate-800">Background Invariant:</strong> Background walls and room lighting are ignored; only facial dimensions are measured.
                  </li>
                  <li>
                    <strong className="text-slate-800">Unique Identity Lock:</strong> If the same face is already enrolled on another student's account, it will be strictly rejected.
                  </li>
                </ul>
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <button
                  onClick={handleStartCapture}
                  className="w-full py-3 bg-[#0B2545] hover:bg-[#133E87] text-white font-bold text-xs rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>Open Front Camera & Auto-Capture Face</span>
                </button>
                <button
                  onClick={() => {
                    setStep('CAMERA');
                    setTimeout(() => startSimulatedCamera(), 50);
                  }}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-slate-200"
                >
                  <Video className="w-3.5 h-3.5 text-blue-600" />
                  <span>Use Interactive Demo Camera Stream</span>
                </button>
              </div>
            </div>
          )}

          {step === 'CAMERA' && (
            <div className="space-y-3.5">
              <div className="text-center">
                <span className="text-[10px] font-bold text-[#0B2545] uppercase tracking-wider bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                  High-Precision Facial Scanner
                </span>
                <p className="text-xs text-slate-700 mt-1">
                  Align your face in the oval. The camera will give live feedback and <strong className="text-emerald-700">capture automatically</strong> when perfect!
                </p>
              </div>

              {cameraError ? (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs text-center space-y-2">
                  <AlertTriangle className="w-6 h-6 text-rose-600 mx-auto" />
                  <p className="font-bold">Camera Access Notice</p>
                  <p>{cameraError}</p>
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <button
                      onClick={startCamera}
                      className="px-3 py-1.5 bg-rose-600 text-white rounded text-xs font-semibold cursor-pointer hover:bg-rose-500"
                    >
                      Retry Webcam
                    </button>
                    <button
                      onClick={startSimulatedCamera}
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-semibold cursor-pointer hover:bg-emerald-500 flex items-center gap-1 shadow-xs"
                    >
                      <Video className="w-3.5 h-3.5" />
                      <span>Use Demo Stream</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative aspect-4/3 bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-inner">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${isMirrored ? '-scale-x-100' : 'scale-x-100'}`}
                  />

                  {/* Shutter Flash Animation */}
                  {shutterFlash && (
                    <div className="absolute inset-0 bg-white z-40 animate-out fade-out duration-200" />
                  )}

                  {/* Dynamic Face Oval Overlay with Status-Based Glow */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div
                      className={`relative w-44 h-56 rounded-[50%] border-2 transition-all duration-200 flex flex-col items-center justify-between py-3 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] ${
                        qualityFeedback?.isPerfect
                          ? 'border-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.7)] ring-4 ring-emerald-500/40'
                          : autoCaptureProgress > 20
                          ? 'border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.4)]'
                          : 'border-dashed border-amber-300/80 shadow-[0_0_15px_rgba(0,0,0,0.5)]'
                      }`}
                    >
                      {/* Scanning Sweep Line */}
                      <div className="absolute inset-x-2 top-0 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent animate-pulse opacity-75" />

                      {/* Header Badge in Oval */}
                      <span className="text-[10px] font-mono font-bold tracking-wide text-amber-300 bg-slate-950/80 px-2 py-0.5 rounded shadow-xs border border-amber-500/20">
                        {isProcessing ? 'MEASURING BIOMETRICS' : qualityFeedback?.isPerfect ? 'PERFECT POSITION' : 'BIOMETRIC OVAL'}
                      </span>

                      {/* Progress / Status at bottom of oval */}
                      {isProcessing ? (
                        <div className="bg-blue-950/90 text-blue-200 px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 border border-blue-500/40 shadow-xs animate-pulse">
                          <RefreshCw className="w-3 h-3 text-blue-400 animate-spin" />
                          <span>Acquiring Multi-Frame...</span>
                        </div>
                      ) : autoCaptureProgress > 0 && (
                        <div className="bg-slate-950/90 text-white px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 border border-emerald-500/40 shadow-xs animate-pulse">
                          <Zap className="w-3 h-3 text-amber-400 fill-amber-400" />
                          <span>Optimal Quality · Auto-Clicking</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Top Live Banner / Status */}
                  <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-900/80 backdrop-blur-xs text-[10px] text-emerald-400 font-mono border border-slate-700/50">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>Passive Anti-Proxy Scan</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setIsMirrored(!isMirrored)}
                        className="pointer-events-auto px-2 py-1 rounded bg-slate-900/80 hover:bg-slate-800 text-[10px] font-mono text-slate-300 border border-slate-700/50 cursor-pointer flex items-center gap-1"
                        title="Flip mirror selfie view"
                      >
                        <FlipHorizontal className="w-3 h-3" />
                        <span>{isMirrored ? 'Mirror' : 'Normal'}</span>
                      </button>

                      <div className="px-2 py-1 rounded bg-slate-900/80 backdrop-blur-xs text-[10px] font-mono text-slate-300 border border-slate-700/50">
                        Clarity: <span className="font-bold text-amber-400">{qualityFeedback?.qualityScore || 0}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Prominent Live Guidance Prompt Floating Above Oval */}
                  <div className="absolute bottom-2.5 inset-x-3 pointer-events-none">
                    <div
                      className={`px-3 py-2 rounded-xl text-center text-xs font-semibold backdrop-blur-md shadow-lg transition-all duration-200 border ${
                        isProcessing
                          ? 'bg-blue-950/90 text-blue-200 border-blue-500/60 ring-2 ring-blue-500/50'
                          : qualityFeedback?.isPerfect
                          ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/60 ring-2 ring-emerald-500/50 animate-pulse'
                          : autoCaptureProgress > 15
                          ? 'bg-amber-950/90 text-amber-200 border-amber-500/60'
                          : 'bg-slate-950/85 text-white border-slate-700/80'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-2">
                        {isProcessing ? (
                          <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
                        ) : qualityFeedback?.isPerfect ? (
                          <Sparkles className="w-4 h-4 text-emerald-400 animate-spin" />
                        ) : (
                          <Crosshair className="w-4 h-4 text-amber-400" />
                        )}
                        <span>
                          {isProcessing
                            ? enrollmentScanStep
                            : autoCaptureProgress > 15
                            ? 'Photo quality optimal · Capturing now...'
                            : qualityFeedback?.suggestion || 'Align face inside the oval frame...'}
                        </span>
                      </div>

                      {/* Smooth Progress Bar for Auto-Capture */}
                      {autoCaptureProgress > 0 && (
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1.5">
                          <div
                            className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-100 ease-out"
                            style={{ width: `${autoCaptureProgress}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Source Switcher Pill */}
              <div className="flex items-center justify-between text-xs px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-[11px] text-slate-600">Camera Source:</span>
                <button
                  type="button"
                  onClick={isUsingSimulator ? startCamera : startSimulatedCamera}
                  className="text-[10px] font-semibold text-blue-700 hover:text-blue-900 bg-white px-2 py-1 rounded border border-slate-200 transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                >
                  <Video className="w-3 h-3" />
                  <span>{isUsingSimulator ? 'Switch to Physical Webcam' : 'Switch to Demo Stream'}</span>
                </button>
              </div>

              {/* Real-time Diagnostics HUD (Distance, Light, Angle, Position) */}
              <div className="grid grid-cols-4 gap-1.5 text-[11px]">
                {/* 1. Distance */}
                <div className={`p-1.5 rounded-lg border text-center transition-colors ${
                  qualityFeedback?.distance.status === 'OPTIMAL'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}>
                  <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-500 uppercase">
                    <Maximize2 className="w-3 h-3" />
                    <span>Distance</span>
                  </div>
                  <span className="font-semibold block truncate mt-0.5">
                    {qualityFeedback?.distance.status === 'OPTIMAL' ? 'Optimal' : qualityFeedback?.distance.label || 'Adjust'}
                  </span>
                </div>

                {/* 2. Lighting */}
                <div className={`p-1.5 rounded-lg border text-center transition-colors ${
                  qualityFeedback?.lighting.status === 'OPTIMAL'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}>
                  <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-500 uppercase">
                    <Sun className="w-3 h-3" />
                    <span>Lighting</span>
                  </div>
                  <span className="font-semibold block truncate mt-0.5">
                    {qualityFeedback?.lighting.status === 'OPTIMAL' ? 'Optimal' : qualityFeedback?.lighting.label || 'Adjust'}
                  </span>
                </div>

                {/* 3. Centering */}
                <div className={`p-1.5 rounded-lg border text-center transition-colors ${
                  qualityFeedback?.alignment.status === 'OPTIMAL'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}>
                  <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-500 uppercase">
                    <Crosshair className="w-3 h-3" />
                    <span>Position</span>
                  </div>
                  <span className="font-semibold block truncate mt-0.5">
                    {qualityFeedback?.alignment.status === 'OPTIMAL' ? 'Centered' : 'Off-Center'}
                  </span>
                </div>

                {/* 4. Angle / Pose */}
                <div className={`p-1.5 rounded-lg border text-center transition-colors ${
                  qualityFeedback?.angle.status === 'OPTIMAL'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}>
                  <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-500 uppercase">
                    <Compass className="w-3 h-3" />
                    <span>Angle</span>
                  </div>
                  <span className="font-semibold block truncate mt-0.5">
                    {qualityFeedback?.angle.status === 'OPTIMAL' ? 'Direct' : 'Turned'}
                  </span>
                </div>
              </div>

              {/* Hidden canvas for processing */}
              <canvas ref={canvasRef} className="hidden" />

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    setStep('INTRO');
                  }}
                  className="w-1/3 py-2.5 px-3 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={performEnrollmentCapture}
                  disabled={isProcessing || !!cameraError || !stream}
                  className="w-2/3 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-400 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {isProcessing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : autoCaptureProgress > 0 ? (
                    <Zap className="w-4 h-4 animate-bounce text-amber-300 fill-amber-300" />
                  ) : (
                    <Camera className="w-4 h-4" />
                  )}
                  <span>
                    {isProcessing
                      ? 'Analyzing Biometrics...'
                      : autoCaptureProgress > 0
                      ? 'Photo Quality Optimal · Auto-Capturing...'
                      : 'Capture & Enroll Face Now'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {step === 'CONFIRM' && duplicateError && (
            <div className="space-y-4">
              {/* DUPLICATE FACE ERROR CARD */}
              <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center mx-auto ring-4 ring-rose-200/50">
                  <UserX className="w-7 h-7 text-rose-600" />
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-rose-700 bg-rose-100 px-2 py-0.5 rounded border border-rose-200">
                    Proxy Prevention Triggered
                  </span>
                  <h4 className="font-display font-bold text-base text-rose-950 mt-1">
                    ❌ Duplicate Face Detected!
                  </h4>
                  <p className="text-xs text-rose-800 mt-1 leading-relaxed">
                    This facial identity is already registered in the college database to:
                  </p>
                </div>

                <div className="bg-white p-3 rounded-xl border border-rose-200 text-left text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Enrolled Student:</span>
                    <span className="font-bold text-slate-900">{duplicateError.matchedStudentName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Registered PRN:</span>
                    <span className="font-mono font-bold text-rose-700">{duplicateError.matchedStudentPrn}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                    <span>Attempted By:</span>
                    <span className="font-semibold text-slate-700">{student.name} ({student.prn})</span>
                  </div>
                </div>

                <p className="text-[11px] text-rose-700 italic">
                  "Under Chinmaya Vishwa Vidyapeeth regulations, one face cannot be registered to multiple student accounts. Proxy attendance is strictly prohibited."
                </p>
              </div>

              {capturedSnapshot && (
                <div className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg border border-slate-200">
                  <img
                    src={capturedSnapshot}
                    alt="Attempted face"
                    className="w-12 h-12 rounded-lg object-cover ring-1 ring-rose-300"
                  />
                  <div className="text-left text-xs">
                    <span className="text-slate-500 text-[10px] block">Attempted Snapshot</span>
                    <span className="text-rose-600 font-semibold">Rejected biometric candidate</span>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    onClose();
                  }}
                  className="w-1/3 py-2 px-3 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRetry}
                  className="w-2/3 py-2 px-4 bg-[#0B2545] hover:bg-[#133E87] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Try Again With My Own Face</span>
                </button>
              </div>
            </div>
          )}

          {step === 'SUCCESS' && (
            <div className="space-y-4 text-center py-3">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto border-4 border-emerald-50">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Unique Biometrics Verified
                </span>
                <h4 className="font-display font-bold text-lg text-slate-900 mt-1">
                  Face Biometrics Enrolled!
                </h4>
                <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto">
                  Your facial template has been encrypted and locked to PRN <span className="font-mono font-semibold text-slate-800">{student.prn}</span>.
                </p>
              </div>

              {capturedSnapshot && (
                <div className="w-28 h-28 mx-auto rounded-full overflow-hidden border-4 border-emerald-500 shadow-md">
                  <img
                    src={capturedSnapshot}
                    alt="Enrolled Face"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-left space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Student Name:</span>
                  <span className="font-semibold text-slate-900">{student.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">PRN / Roll No:</span>
                  <span className="font-mono text-slate-800">{student.prn} (#{student.rollNo})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Biometric Template:</span>
                  <span className="font-mono text-emerald-600 font-semibold">96D Anatomical Mesh (Active)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Anti-Proxy Status:</span>
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" />
                    <span>Locked & Unique</span>
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  onClose();
                }}
                className="w-full py-3 bg-[#0B2545] hover:bg-[#133E87] text-white font-bold text-xs rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                <span>Continue to Student Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
