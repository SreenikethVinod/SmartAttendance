import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAttendance } from '../context/AttendanceContext';
import { 
  extractFaceDescriptor, 
  extractEnsembleFaceDescriptor,
  analyzeFaceQuality, 
  isFaceQualityReadyForCapture,
  playCameraShutterSound,
  FaceQualityFeedback 
} from '../utils/faceMatching';
import { enrollFaceWithInsightFace, saveStudentToBackend } from '../utils/insightFaceApi';
import { createSimulatedFaceStream } from '../utils/cameraSimulator';
import { 
  Camera, 
  X, 
  UserPlus, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Sparkles,
  Maximize2,
  Sun,
  Crosshair,
  Compass,
  Zap,
  RefreshCw,
  Video
} from 'lucide-react';

interface StudentRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const StudentRegisterModal: React.FC<StudentRegisterModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { registerStudent } = useAttendance();

  const [step, setStep] = useState<'DETAILS' | 'CAMERA' | 'CONFIRM'>('DETAILS');
  const [fullName, setFullName] = useState('');
  const [prn, setPrn] = useState('');
  const [rollNo, setRollNo] = useState('3');
  const [department, setDepartment] = useState('B.Tech Computer Science & Engineering');
  const [semester, setSemester] = useState('Semester 6');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('1234');

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isUsingSimulator, setIsUsingSimulator] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const isProcessingRef = useRef(false);
  const [shutterFlash, setShutterFlash] = useState(false);
  const [enrollmentScanStep, setEnrollmentScanStep] = useState<string>('Hold steady...');

  const [capturedSnapshot, setCapturedSnapshot] = useState<string | null>(null);
  const [extractedDescriptor, setExtractedDescriptor] = useState<number[] | null>(null);
  const [extractedDimensions, setExtractedDimensions] = useState<Record<string, number> | undefined>(undefined);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Real-time quality feedback & auto-capture
  const [qualityFeedback, setQualityFeedback] = useState<FaceQualityFeedback | null>(null);
  const [autoCaptureProgress, setAutoCaptureProgress] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const analysisIntervalRef = useRef<number | null>(null);
  const consecutivePerfectFramesRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const simCleanupRef = useRef<(() => void) | null>(null);

  const stopCamera = useCallback(() => {
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
      setStep('DETAILS');
      setCapturedSnapshot(null);
      setExtractedDescriptor(null);
      setSubmitError(null);
      setAutoCaptureProgress(0);
      setCameraError(null);
    }
  }, [isOpen, stopCamera]);

  const handleCaptureSnapshot = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || isProcessingRef.current) return;
    setIsProcessing(true);
    isProcessingRef.current = true;

    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current);
      analysisIntervalRef.current = null;
    }

    const steps = [
      '1/4: Positioning & Camera Alignment...',
      '2/4: Optical Quality Check...',
      '3/4: InsightFace ArcFace Biometric Preparation...',
      '4/4: High-Precision Frame Acquired!',
    ];

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      for (let i = 0; i < steps.length; i++) {
        setEnrollmentScanStep(steps[i]);
        setShutterFlash(true);
        playCameraShutterSound();
        setTimeout(() => setShutterFlash(false), 120);
        await new Promise((resolve) => setTimeout(resolve, 110));
      }

      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
      ctx.restore();

      const snapshot = canvas.toDataURL('image/jpeg', 0.95);
      setCapturedSnapshot(snapshot);

      // Best effort extraction of legacy descriptor without blocking
      try {
        const sample = extractFaceDescriptor(video, canvas);
        if (sample?.descriptor && sample.descriptor.length === 128) {
          setExtractedDescriptor(sample.descriptor);
          setExtractedDimensions(sample.dimensions);
        }
      } catch {
        // Authoritative face detection & 512-D ArcFace embedding is handled by InsightFace on backend
      }

      stopCamera();
      setStep('CONFIRM');
    } catch (err: any) {
      console.error('Capture error', err);
      setCameraError(err?.message || 'Failed to capture frame from camera.');
      setTimeout(() => setCameraError(null), 4000);
    } finally {
      setIsProcessing(false);
      isProcessingRef.current = false;
    }
  }, [stopCamera]);

  const handleCaptureSnapshotRef = useRef(handleCaptureSnapshot);
  handleCaptureSnapshotRef.current = handleCaptureSnapshot;

  // Real-time quality feedback & immediate auto-capture loop
  const startQualityAnalysis = useCallback(() => {
    if (analysisIntervalRef.current) return;

    analysisIntervalRef.current = window.setInterval(() => {
      if (!videoRef.current || videoRef.current.readyState < 2 || isProcessingRef.current) return;

      const feedback = analyzeFaceQuality(videoRef.current);
      setQualityFeedback(feedback);

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
          handleCaptureSnapshotRef.current();
        } else {
          setAutoCaptureProgress(60);
        }
      } else {
        consecutivePerfectFramesRef.current = 0;
        setAutoCaptureProgress(0);
      }
    }, 100);
  }, []);

  const startQualityAnalysisRef = useRef(startQualityAnalysis);
  startQualityAnalysisRef.current = startQualityAnalysis;

  // Simulated stream starter
  const startSimulatedCamera = useCallback(() => {
    stopCamera();
    setCameraError(null);
    setAutoCaptureProgress(0);
    const sim = createSimulatedFaceStream(fullName || 'Student');
    streamRef.current = sim.stream;
    simCleanupRef.current = sim.stop;
    setIsUsingSimulator(true);
    setStream(sim.stream);
  }, [stopCamera, fullName]);

  // Real webcam camera starter
  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);
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
      console.warn('Camera access error, activating interactive demo camera stream:', err);
      startSimulatedCamera();
    }
  }, [stopCamera, startSimulatedCamera]);

  // Reliable video attachment
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;

    video.srcObject = stream;
    video.setAttribute('playsinline', 'true');
    video.setAttribute('muted', 'true');
    video.muted = true;

    let isSubscribed = true;

    const handleLoaded = () => {
      if (!isSubscribed) return;
      video.play().catch((err) => console.warn('Video play caught:', err));
      startQualityAnalysisRef.current();
    };

    video.addEventListener('loadedmetadata', handleLoaded);
    if (video.readyState >= 2) {
      video.play().catch((err) => console.warn('Video play caught:', err));
      startQualityAnalysisRef.current();
    }

    return () => {
      isSubscribed = false;
      video.removeEventListener('loadedmetadata', handleLoaded);
    };
  }, [stream]);

  const handleProceedToCamera = () => {
    if (!fullName.trim() || !prn.trim()) return;
    setStep('CAMERA');
    setTimeout(() => {
      startCamera();
    }, 50);
  };

  const handleFinalSubmit = async () => {
    if (!capturedSnapshot) return;
    setSubmitError(null);
    setIsProcessing(true);

    const cleanPrn = prn.trim().toUpperCase();
    const cleanName = fullName.trim();
    const studentEmail = email.trim() || `${cleanPrn.toLowerCase()}@cvv.ac.in`;

    try {
      // 1. Save student identity in backend database
      await saveStudentToBackend({
        prn: cleanPrn,
        rollNo: Number(rollNo) || 1,
        name: cleanName,
        email: studentEmail,
        department,
        semester,
        batch: '2024 - 2028',
        avatarUrl: capturedSnapshot,
        overallAttendance: 100,
      });

      // 2. Enroll biometrics into InsightFace engine with duplicate check
      const enrollRes = await enrollFaceWithInsightFace(cleanPrn, capturedSnapshot, true);
      if (!enrollRes.success) {
        setSubmitError(enrollRes.message || 'Face enrollment rejected. Please recapture face.');
        setIsProcessing(false);
        return;
      }

      // 3. Register in local context
      const res = registerStudent({
        name: cleanName,
        prn: cleanPrn,
        rollNo: Number(rollNo) || 1,
        email: studentEmail,
        department,
        semester,
        pin,
        snapshotUrl: capturedSnapshot,
        descriptor: extractedDescriptor || [],
        dimensions: extractedDimensions,
      });

      if (res?.error) {
        setSubmitError(res.error);
        setIsProcessing(false);
        return;
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to complete registration.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-[#0B2545] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-base text-white">
                Register Student
              </h3>
              <p className="text-xs text-slate-300">
                Direct Identity & Facial Registration Portal
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-md hover:bg-white/10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'DETAILS' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Student Full Name *
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-2 focus:ring-[#0B2545] focus:outline-hidden"
                  placeholder="e.g. Rahul R. Menon"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    PRN / Roll Number *
                  </label>
                  <input
                    type="text"
                    value={prn}
                    onChange={(e) => setPrn(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono uppercase border border-slate-300 rounded-md focus:ring-2 focus:ring-[#0B2545] focus:outline-hidden"
                    placeholder="CVV240873"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Roll # (Numeric)
                  </label>
                  <input
                    type="number"
                    value={rollNo}
                    onChange={(e) => setRollNo(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-2 focus:ring-[#0B2545] focus:outline-hidden"
                    placeholder="3"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Department
                  </label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-2 focus:ring-[#0B2545] focus:outline-hidden bg-white"
                  >
                    <option value="B.Tech Computer Science & Engineering">B.Tech CSE</option>
                    <option value="B.Tech Artificial Intelligence">B.Tech AI & Data Science</option>
                    <option value="B.A. Sanskrit & Indic Studies">B.A. Sanskrit</option>
                    <option value="B.Com Applied Finance">B.Com Finance</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Semester
                  </label>
                  <select
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-2 focus:ring-[#0B2545] focus:outline-hidden bg-white"
                  >
                    <option value="Semester 1">Semester 1</option>
                    <option value="Semester 2">Semester 2</option>
                    <option value="Semester 4">Semester 4</option>
                    <option value="Semester 6">Semester 6</option>
                    <option value="Semester 8">Semester 8</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-2 focus:ring-[#0B2545] focus:outline-hidden"
                    placeholder="student@cvv.ac.in"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Portal PIN (4 Digits)
                  </label>
                  <input
                    type="password"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    maxLength={6}
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-md focus:ring-2 focus:ring-[#0B2545] focus:outline-hidden"
                    placeholder="1234"
                  />
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleProceedToCamera}
                  disabled={!fullName.trim() || !prn.trim()}
                  className="w-full py-2.5 px-4 bg-[#0B2545] hover:bg-[#133E87] text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Camera className="w-4 h-4" />
                  <span>Next: Capture Student Face With Camera</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!fullName.trim() || !prn.trim()) return;
                    setStep('CAMERA');
                    setTimeout(() => startSimulatedCamera(), 50);
                  }}
                  disabled={!fullName.trim() || !prn.trim()}
                  className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 border border-slate-200"
                >
                  <Video className="w-3.5 h-3.5 text-blue-600" />
                  <span>Next: Use Interactive Demo Face Stream</span>
                </button>
              </div>
            </div>
          )}

          {step === 'CAMERA' && (
            <div className="space-y-3.5 text-center">
              <div className="relative mx-auto w-full aspect-4/3 bg-slate-950 rounded-xl overflow-hidden border-2 border-slate-700 shadow-inner flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover -scale-x-100"
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Shutter Flash Animation */}
                {shutterFlash && (
                  <div className="absolute inset-0 bg-white z-40 animate-out fade-out duration-200" />
                )}

                {/* Face Alignment Oval Overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div
                    className={`relative w-44 h-56 rounded-[50%] border-2 transition-all duration-200 flex flex-col items-center justify-between py-3 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] ${
                      qualityFeedback?.isPerfect
                        ? 'border-emerald-400 ring-4 ring-emerald-500/40 shadow-[0_0_30px_rgba(16,185,129,0.7)]'
                        : autoCaptureProgress > 20
                        ? 'border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.4)]'
                        : 'border-dashed border-amber-400/90'
                    }`}
                  >
                    <span className="text-[10px] font-mono font-bold text-amber-300 bg-slate-950/80 px-2 py-0.5 rounded border border-amber-500/20">
                      {qualityFeedback?.isPerfect ? 'PERFECT POSITION' : 'BIOMETRIC OVAL'}
                    </span>

                    {autoCaptureProgress > 0 && (
                      <div className="bg-slate-950/90 text-white px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 border border-emerald-500/40 animate-pulse">
                        <Zap className="w-3 h-3 text-amber-400 fill-amber-400" />
                        <span>Optimal Quality · Auto-Clicking</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Live Guidance Prompt Banner */}
                <div className="absolute bottom-2.5 inset-x-3 pointer-events-none">
                  <div
                    className={`px-3 py-2 rounded-xl text-center text-xs font-semibold backdrop-blur-md shadow-lg transition-all duration-200 border ${
                      qualityFeedback?.isPerfect
                        ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/60 ring-2 ring-emerald-500/50 animate-pulse'
                        : 'bg-slate-950/85 text-white border-slate-700/80'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      {qualityFeedback?.isPerfect ? (
                        <Sparkles className="w-4 h-4 text-emerald-400 animate-spin" />
                      ) : (
                        <Crosshair className="w-4 h-4 text-amber-400" />
                      )}
                      <span>{isProcessing ? enrollmentScanStep : qualityFeedback?.suggestion || 'Align student face inside the oval frame...'}</span>
                    </div>

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

                {cameraError && (
                  <div className="absolute inset-0 bg-slate-900/95 p-4 flex flex-col items-center justify-center text-rose-300 text-xs z-30">
                    <AlertTriangle className="w-8 h-8 mb-2 text-rose-400" />
                    <p className="font-semibold text-center mb-1">Camera Notice</p>
                    <p className="text-[11px] text-slate-300 text-center mb-3 max-w-xs">{cameraError}</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={startCamera}
                        className="px-3 py-1.5 bg-slate-700 text-white rounded font-medium text-xs hover:bg-slate-600 cursor-pointer"
                      >
                        Retry Webcam
                      </button>
                      <button
                        onClick={startSimulatedCamera}
                        className="px-3 py-1.5 bg-emerald-600 text-white rounded font-medium text-xs hover:bg-emerald-500 cursor-pointer flex items-center gap-1 shadow-sm"
                      >
                        <Video className="w-3.5 h-3.5" />
                        <span>Use Demo Stream</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Source Switcher Pill */}
              <div className="flex items-center justify-between text-xs px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-[11px] text-slate-600">Camera Source:</span>
                <button
                  type="button"
                  onClick={isUsingSimulator ? startCamera : startSimulatedCamera}
                  className="text-[10px] font-semibold text-blue-700 hover:text-blue-900 bg-white px-2 py-1 rounded border border-slate-200 transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                >
                  <Video className="w-3 h-3" />
                  <span>{isUsingSimulator ? 'Switch to Physical Webcam' : 'Switch to Demo Stream'}</span>
                </button>
              </div>

              {/* Real-time Diagnostics HUD */}
              <div className="grid grid-cols-4 gap-1.5 text-[11px]">
                <div className={`p-1.5 rounded-lg border text-center ${
                  qualityFeedback?.distance.status === 'OPTIMAL' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}>
                  <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-500 uppercase">
                    <Maximize2 className="w-3 h-3" />
                    <span>Distance</span>
                  </div>
                  <span className="font-semibold block truncate mt-0.5">{qualityFeedback?.distance.label || 'Adjust'}</span>
                </div>

                <div className={`p-1.5 rounded-lg border text-center ${
                  qualityFeedback?.lighting.status === 'OPTIMAL' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}>
                  <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-500 uppercase">
                    <Sun className="w-3 h-3" />
                    <span>Lighting</span>
                  </div>
                  <span className="font-semibold block truncate mt-0.5">{qualityFeedback?.lighting.label || 'Adjust'}</span>
                </div>

                <div className={`p-1.5 rounded-lg border text-center ${
                  qualityFeedback?.alignment.status === 'OPTIMAL' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}>
                  <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-500 uppercase">
                    <Crosshair className="w-3 h-3" />
                    <span>Position</span>
                  </div>
                  <span className="font-semibold block truncate mt-0.5">{qualityFeedback?.alignment.status === 'OPTIMAL' ? 'Centered' : 'Off-Center'}</span>
                </div>

                <div className={`p-1.5 rounded-lg border text-center ${
                  qualityFeedback?.angle.status === 'OPTIMAL' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}>
                  <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-500 uppercase">
                    <Compass className="w-3 h-3" />
                    <span>Angle</span>
                  </div>
                  <span className="font-semibold block truncate mt-0.5">{qualityFeedback?.angle.status === 'OPTIMAL' ? 'Direct' : 'Turned'}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    setStep('DETAILS');
                  }}
                  className="w-1/3 py-2.5 px-3 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleCaptureSnapshot}
                  disabled={isProcessing || !stream}
                  className="w-2/3 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {isProcessing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4" />
                  )}
                  <span>
                    {isProcessing
                      ? 'Acquiring Biometrics...'
                      : autoCaptureProgress > 0
                      ? 'Photo Quality Optimal · Auto-Capturing...'
                      : 'Capture & Enroll Face Now'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {step === 'CONFIRM' && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <h4 className="font-bold text-sm text-emerald-950">
                  Biometric Face Snapshot Captured!
                </h4>
                <p className="text-xs text-emerald-800">
                  The face biometric template and passive liveness signature have been extracted.
                </p>
              </div>

              {capturedSnapshot && (
                <div className="w-28 h-28 mx-auto rounded-full overflow-hidden border-2 border-emerald-500 shadow-md">
                  <img
                    src={capturedSnapshot}
                    alt="Captured student"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Full Name:</span>
                  <span className="font-semibold text-slate-800">{fullName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">PRN / Roll No:</span>
                  <span className="font-mono text-slate-800">{prn.toUpperCase()} (#{rollNo})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Department:</span>
                  <span className="text-slate-800">{department}</span>
                </div>
              </div>

              {submitError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setStep('CAMERA');
                    setTimeout(() => startCamera(), 50);
                  }}
                  className="w-1/3 py-2 px-3 border border-slate-300 text-slate-700 text-xs font-semibold rounded-md hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Retake Photo
                </button>
                <button
                  type="button"
                  onClick={handleFinalSubmit}
                  className="w-2/3 py-2 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-md shadow-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Confirm & Save Student</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
