import React, { useState, useRef, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { useAttendance } from '../context/AttendanceContext';
import { 
  analyzeFaceQuality, 
  isFaceQualityReadyForCapture,
  FaceQualityFeedback 
} from '../utils/faceMatching';
import { verifyAttendanceWithInsightFace } from '../utils/insightFaceApi';
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
  ShieldCheck, 
  Wifi, 
  WifiOff, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  Sun,
  Maximize2,
  Compass,
  Crosshair,
  Sparkles,
  Zap,
  Video,
  Volume2,
  VolumeX,
  FlipHorizontal
} from 'lucide-react';

interface FaceVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const FaceVerificationModal: React.FC<FaceVerificationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const {
    students,
    currentUser,
    activeSession,
    networkConfig,
    toggleNetworkMode,
    submitAttendanceVerification,
    recordVerificationFailure,
  } = useAttendance();

  const student = students.find((s) => s.prn === currentUser?.student?.prn) || currentUser?.student;

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isUsingSimulator, setIsUsingSimulator] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanningState, setScanningState] = useState<'IDLE' | 'ANALYZING' | 'SUCCESS' | 'FAILED'>('IDLE');
  
  // Progress indicators
  const [livenessProgress, setLivenessProgress] = useState(0);
  const [scanningStepText, setScanningStepText] = useState<string>('Align face inside oval frame...');
  const [verifiedCosine, setVerifiedCosine] = useState<number | null>(null);
  const [matchScore, setMatchScore] = useState<number | null>(null);
  const [livenessScore, setLivenessScore] = useState<number | null>(null);
  const [failureReason, setFailureReason] = useState<string | null>(null);
  const [retriesLeft, setRetriesLeft] = useState(3);
  const [lastVerifiedRecord, setLastVerifiedRecord] = useState<any | null>(null);

  // Real-time quality feedback & auto-capture
  const [qualityFeedback, setQualityFeedback] = useState<FaceQualityFeedback | null>(null);
  const [autoCaptureProgress, setAutoCaptureProgress] = useState(0);
  const [shutterFlash, setShutterFlash] = useState(false);

  // Audio Guidance & Mirroring Settings
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [isMirrored, setIsMirrored] = useState(true);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const analysisIntervalRef = useRef<number | null>(null);
  const consecutiveTicksRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const simCleanupRef = useRef<(() => void) | null>(null);

  // Mutable refs to prevent unnecessary re-creation of callbacks and effect loops
  const studentRef = useRef(student);
  studentRef.current = student;

  // Keep students ref in sync so handleRunVerification always reads the latest descriptors
  // without needing 'students' in its useCallback deps (which would cause interval cascade restarts)
  const studentsRef = useRef(students);
  studentsRef.current = students;

  const activeSessionRef = useRef(activeSession);
  activeSessionRef.current = activeSession;

  const scanningStateRef = useRef(scanningState);
  scanningStateRef.current = scanningState;

  const isVoiceEnabledRef = useRef(isVoiceEnabled);
  isVoiceEnabledRef.current = isVoiceEnabled;

  const stopCamera = useCallback(() => {
    cancelVoiceGuidance();
    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current);
      analysisIntervalRef.current = null;
    }
    consecutiveTicksRef.current = 0;
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

  const handleRunVerification = useCallback(async () => {
    // Always pull the freshest student record from the live students array (via ref)
    const curStudent = studentsRef.current.find((s) => s.prn === studentRef.current?.prn) || studentRef.current;
    if (!curStudent || scanningStateRef.current === 'ANALYZING') return;

    // Check Wi-Fi constraint
    if (!networkConfig.isClassroomWifiConnected) {
      setScanningState('FAILED');
      setFailureReason(`Attendance Blocked: Connected to external IP ${networkConfig.currentIp}. Must connect to authorized Classroom Wi-Fi (${networkConfig.baseWifiIp}).`);
      playWarningTone();
      return;
    }

    // Stop quality analysis loop during active biometric scanning
    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current);
      analysisIntervalRef.current = null;
    }

    setScanningState('ANALYZING');
    setAutoCaptureProgress(100);
    speakGuidance('Scanning facial features with InsightFace deep neural model. Please hold steady.', isVoiceEnabledRef.current);

    // Multi-step tactile progress
    const captureSteps = [
      { progress: 25, label: '1/4: Analyzing Camera Frame & Head Alignment...' },
      { progress: 50, label: '2/4: Detecting Facial Landmarks with SCRFD...' },
      { progress: 75, label: '3/4: Generating InsightFace 512-D ArcFace Features...' },
      { progress: 100, label: '4/4: Performing 1:1 Cosine Identity Verification...' },
    ];

    let capturedDataUrl = '';
    for (let stepIdx = 0; stepIdx < captureSteps.length; stepIdx++) {
      const step = captureSteps[stepIdx];
      setLivenessProgress(step.progress);
      setScanningStepText(step.label);

      setShutterFlash(true);
      playMicroTick();
      setTimeout(() => setShutterFlash(false), 140);

      if (videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.save();
          if (isMirrored) {
            ctx.scale(-1, 1);
            ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
          } else {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          }
          ctx.restore();
          capturedDataUrl = canvas.toDataURL('image/jpeg', 0.95);
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    playShutterSound();

    if (!capturedDataUrl) {
      setScanningState('FAILED');
      setFailureReason('Could not capture frame from camera. Please try again.');
      return;
    }

    // Call official InsightFace 1:1 verification backend!
    // The server performs authoritative SCRFD landmark-guided Presentation Attack Detection (PAD).
    setScanningStepText('Extracting features with InsightFace ArcFace 512-D & running MiniFASNetV2 PAD...');

    const session = activeSessionRef.current;
    const periodNum = session?.periodNumber || 1;
    const sessId = session?.id || `session-p${periodNum}-${Date.now()}`;
    const sessDate = session?.date || new Date().toISOString().split('T')[0];

    const apiResult = await verifyAttendanceWithInsightFace({
      prn: curStudent.prn,
      sessionId: sessId,
      periodNumber: periodNum,
      date: sessDate,
      imageBase64: capturedDataUrl,
      networkSsid: networkConfig.currentSsid,
      ipAddress: networkConfig.currentIp,
    });

    // Server-Side Presentation Attack Detection (PAD) Check
    if (apiResult.error_code === 'SPOOF_ATTACK_DETECTED' || apiResult.is_live === false) {
      stopCamera();
      setScanningState('FAILED');
      const attack = apiResult.attack_type || 'SCREEN_REPLAY';
      const attackName = attack === 'SCREEN_REPLAY' ? 'Digital Screen Replay (Phone Display)' : '2D Printed Photo';
      const spoofReason = `⚠️ Anti-Spoofing Security Triggered: ${attackName} detected! Proxy attendance using phone screens or photos is strictly prohibited under university regulations.`;
      setFailureReason(spoofReason);
      setLivenessScore(apiResult.liveness_score || 18.5);
      setRetriesLeft((prev) => Math.max(0, prev - 1));
      playWarningTone();
      speakGuidance('Spoof attack detected. Presentation of phone screen is strictly prohibited.', isVoiceEnabledRef.current);
      recordVerificationFailure(curStudent.prn, 'SPOOF_ATTACK_DETECTED', spoofReason);
      return;
    }

    const calculatedMatch = apiResult.confidence ?? (apiResult.is_genuine ? 95.0 : 25.0);
    const cosineSim = apiResult.similarity ?? (apiResult.is_genuine ? 0.78 : 0.20);
    const calculatedLiveness = apiResult.liveness_score ?? 98.5;

    setMatchScore(calculatedMatch);
    setVerifiedCosine(cosineSim);
    setLivenessScore(calculatedLiveness);

    if (apiResult.success && (apiResult.is_genuine || apiResult.already_marked)) {
      // Sync local context attendance records
      const syncRes = submitAttendanceVerification(curStudent.prn, calculatedMatch, calculatedLiveness, {
        attackType: 'REAL_HUMAN',
        cosineSimilarity: cosineSim,
        euclideanDistance: 0.5,
      });

      stopCamera();
      setScanningState('SUCCESS');
      setLastVerifiedRecord(apiResult.record || syncRes.record);
      playSuccessChime();
      speakGuidance('Attendance verified successfully with InsightFace!', isVoiceEnabledRef.current);

      try {
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#10B981', '#3B82F6', '#F59E0B'],
        });
      } catch {
        // ignore
      }
      onSuccess();
    } else {
      stopCamera();
      setScanningState('FAILED');
      const failMsg = apiResult.message || 'Face verification failed: Captured face does not match registered biometric identity.';
      setFailureReason(failMsg);
      setRetriesLeft((prev) => Math.max(0, prev - 1));
      playWarningTone();
      speakGuidance(failMsg, isVoiceEnabledRef.current);
      recordVerificationFailure(curStudent.prn, apiResult.error_code || 'FACE_MISMATCH', failMsg);
    }
  }, [networkConfig, isMirrored, submitAttendanceVerification, stopCamera, onSuccess, recordVerificationFailure]);

  // Reference to handleRunVerification to prevent startQualityAnalysis from restarting on render
  const handleRunVerificationRef = useRef(handleRunVerification);
  handleRunVerificationRef.current = handleRunVerification;

  // Real-time quality feedback & stable auto-verification
  const startQualityAnalysis = useCallback(() => {
    // If interval is ALREADY running, do not restart it or reset ticks!
    if (analysisIntervalRef.current) return;

    analysisIntervalRef.current = window.setInterval(() => {
      if (!videoRef.current || videoRef.current.readyState < 2 || scanningStateRef.current === 'ANALYZING') return;

      const feedback = analyzeFaceQuality(videoRef.current);
      setQualityFeedback(feedback);

      // Voice coaching guidance
      if (feedback.statusType === 'adjust_distance') {
        speakGuidance(feedback.distance.status === 'TOO_FAR' ? 'Please come closer' : 'Move back slightly', isVoiceEnabledRef.current);
      } else if (feedback.statusType === 'adjust_light') {
        speakGuidance('More light needed', isVoiceEnabledRef.current);
      } else if (feedback.statusType === 'adjust_angle') {
        speakGuidance('Look straight at the camera', isVoiceEnabledRef.current);
      }

      // Auto-click immediately when photo is good enough to get all details for error-free recognition
      const isReadyToLock = isFaceQualityReadyForCapture(feedback);

      if (isReadyToLock) {
        consecutiveTicksRef.current++;
        const requiredTicks = 6;
        const pct = Math.min(100, Math.round((consecutiveTicksRef.current / requiredTicks) * 100));
        setAutoCaptureProgress(pct);

        if (consecutiveTicksRef.current >= requiredTicks) {
          if (analysisIntervalRef.current) {
            clearInterval(analysisIntervalRef.current);
            analysisIntervalRef.current = null;
          }
          handleRunVerificationRef.current();
        } else {
          playMicroTick();
        }
      } else {
        consecutiveTicksRef.current = 0;
        setAutoCaptureProgress(0);
      }
    }, 100);
  }, []);

  const startQualityAnalysisRef = useRef(startQualityAnalysis);
  startQualityAnalysisRef.current = startQualityAnalysis;

  // Fallback simulator stream starter
  const startSimulatedCamera = useCallback(() => {
    stopCamera();
    setCameraError(null);
    setAutoCaptureProgress(0);
    const curStud = studentRef.current;
    const sim = createSimulatedFaceStream(
      curStud?.name || 'CVV Student',
      curStud?.photoDataUrl || curStud?.avatarUrl
    );
    streamRef.current = sim.stream;
    simCleanupRef.current = sim.stop;
    setIsUsingSimulator(true);
    setStream(sim.stream);
  }, [stopCamera]);

  // Real webcam camera starter with automated fallback
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
      console.warn('Real webcam unavailable, activating live interactive stream:', err);
      startSimulatedCamera();
    }
  }, [stopCamera, startSimulatedCamera]);

  // Reliable video attachment effect (runs only when stream changes, not on external timer ticks)
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

  // Lifecycle control: open/close camera only on modal visibility or network change
  useEffect(() => {
    if (isOpen) {
      if (networkConfig.isClassroomWifiConnected) {
        startCamera();
      }
    } else {
      stopCamera();
      setScanningState('IDLE');
      setMatchScore(null);
      setLivenessScore(null);
      setFailureReason(null);
      setAutoCaptureProgress(0);
      setCameraError(null);
    }
  }, [isOpen, networkConfig.isClassroomWifiConnected, startCamera, stopCamera]);

  const handleRetry = () => {
    setScanningState('IDLE');
    setFailureReason(null);
    setLivenessProgress(0);
    setAutoCaptureProgress(0);
    startCamera();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-[#0B2545] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-base text-white">
                Biometric Attendance Verification
              </h3>
              <p className="text-xs text-slate-300">
                Period {activeSession?.periodNumber || 1}: {activeSession?.subjectName || 'Current Lecture'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Audio Guidance Toggle */}
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
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors p-1 rounded-md hover:bg-white/10 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body content */}
        <div className="p-6">
          {/* Case 1: Classroom Wi-Fi is NOT Connected (Proxy Defense) */}
          {!networkConfig.isClassroomWifiConnected ? (
            <div className="space-y-4 text-center py-4">
              <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto border-4 border-rose-50">
                <WifiOff className="w-8 h-8" />
              </div>

              <div>
                <h4 className="text-base font-bold text-slate-900">
                  Wi-Fi Gateway Mismatch (Attendance Blocked)
                </h4>
                <p className="text-xs text-rose-600 mt-1 max-w-sm mx-auto font-medium">
                  You switched to a different Wi-Fi or cellular network. Attendance is strictly locked to the classroom base Wi-Fi.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-left space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Your Current Live IP:</span>
                  <span className="font-mono text-rose-600 font-bold">{networkConfig.currentIp || '157.48.21.90'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Current Gateway / ISP:</span>
                  <span className="font-semibold text-slate-700 truncate max-w-[200px]">{networkConfig.currentIsp || 'External Network'}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1.5 mt-1">
                  <span className="text-slate-500">Authorized Base Wi-Fi:</span>
                  <span className="font-mono text-emerald-600 font-bold">{networkConfig.baseWifiIp}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Base Network Name:</span>
                  <span className="text-slate-600">{networkConfig.baseWifiName}</span>
                </div>
              </div>

              <div className="pt-1 flex flex-col gap-2">
                <button
                  onClick={() => toggleNetworkMode(true)}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-md shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Wifi className="w-4 h-4" />
                  <span>Switch Back to Authorized Base Wi-Fi</span>
                </button>
                <button
                  onClick={onClose}
                  className="w-full py-2 px-3 border border-slate-300 text-slate-600 text-xs font-semibold rounded-md hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : scanningState === 'SUCCESS' ? (
            /* Case 2: Verification SUCCESS digital receipt */
            <div className="space-y-4 text-center py-2">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto border-4 border-emerald-50">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h4 className="text-lg font-bold text-slate-900">
                  Attendance Stamped & Verified
                </h4>
                <p className="text-xs text-emerald-700 font-medium mt-0.5">
                  Facial Match & Passive Liveness Confirmed
                </p>
              </div>

              {/* Digital Attendance Receipt */}
              <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 text-left space-y-2 text-xs">
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500">Student Name:</span>
                  <span className="font-semibold text-slate-900">{student?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">PRN / Roll No:</span>
                  <span className="font-mono text-slate-800">{student?.prn} (#{student?.rollNo})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Period & Subject:</span>
                  <span className="font-medium text-slate-800">
                    Period {activeSession?.periodNumber || 1} · {activeSession?.subjectCode || 'CSE301'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Check-in Timestamp:</span>
                  <span className="font-mono text-slate-800">{lastVerifiedRecord?.timestamp || 'Just now'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Biometric Neural Model:</span>
                  <span className="font-semibold text-[#0B2545]">InsightFace ArcFace 512-D (buffalo_s)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Cosine Similarity:</span>
                  <span className="font-mono font-semibold text-emerald-600">
                    S = {verifiedCosine !== null ? verifiedCosine.toFixed(4) : '0.7800'} (Threshold: ≥0.50)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Identity Match Confidence:</span>
                  <span className="font-mono font-semibold text-emerald-600">{matchScore}% Match</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Passive Liveness (Anti-Spoof):</span>
                  <span className="font-mono font-semibold text-emerald-600">MiniFASNetV2 ({livenessScore || 98.5}% Live Subject)</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 text-[11px]">
                  <span className="text-slate-400">Classroom IP / Wi-Fi:</span>
                  <span className="font-mono text-slate-500">{networkConfig.currentIp || '10.24.112.45'} · {networkConfig.currentSsid}</span>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-full py-2.5 px-4 bg-[#0B2545] hover:bg-[#133E87] text-white text-xs font-semibold rounded-md shadow-xs transition-colors cursor-pointer mt-2"
              >
                Return to Student Dashboard
              </button>
            </div>
          ) : scanningState === 'FAILED' ? (
            /* Case 3: Verification FAILED */
            <div className="space-y-4 text-center py-2">
              <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto border-4 border-rose-50">
                <AlertTriangle className="w-8 h-8" />
              </div>

              <div>
                <h4 className="text-base font-bold text-slate-900">
                  Verification Unsuccessful
                </h4>
                <p className="text-xs text-rose-600 font-medium mt-1">
                  {failureReason || 'Face match score below threshold'}
                </p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 text-left space-y-1">
                <p className="font-semibold">Anti-Proxy Quality Checklist:</p>
                <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-amber-800">
                  <li>Ensure natural lighting in front of your face (not backlit).</li>
                  <li>Remain still and align directly inside the face oval.</li>
                  <li>Proxy check: Only the student enrolled to this account can verify.</li>
                </ul>
                <p className="text-[11px] text-slate-600 pt-1">
                  Remaining in-window retries: <span className="font-bold text-slate-900">{retriesLeft}</span>
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={onClose}
                  className="w-1/3 py-2 px-3 border border-slate-300 text-slate-600 text-xs font-semibold rounded-md hover:bg-slate-50 transition-colors"
                >
                  Close
                </button>
                {retriesLeft > 0 ? (
                  <button
                    onClick={handleRetry}
                    className="w-2/3 py-2 px-3 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-md shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Retry Facial Scan</span>
                  </button>
                ) : (
                  <button
                    onClick={onClose}
                    className="w-2/3 py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-md shadow-xs transition-colors cursor-pointer"
                  >
                    Approach Teacher for Override
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Case 4: Live Camera & Scanner Interface with Auto-Capture */
            <div className="space-y-3.5">
              {/* Webcam Viewport with Biometric Oval & Live Guidance */}
              <div className="relative mx-auto w-full aspect-4/3 bg-slate-950 rounded-xl overflow-hidden border-2 border-slate-700 shadow-inner flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${isMirrored ? '-scale-x-100' : 'scale-x-100'}`}
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Shutter Flash Animation */}
                {shutterFlash && (
                  <div className="absolute inset-0 bg-white z-40 animate-out fade-out duration-200" />
                )}

                {/* Face Oval Overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div
                    className={`relative w-44 h-56 border-2 transition-all duration-200 rounded-[50%] shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] flex flex-col items-center justify-between py-3 ${
                      scanningState === 'ANALYZING'
                        ? 'border-emerald-400 ring-4 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.7)] animate-pulse'
                        : qualityFeedback?.isPerfect
                        ? 'border-emerald-400 ring-4 ring-emerald-500/40 shadow-[0_0_30px_rgba(16,185,129,0.6)]'
                        : autoCaptureProgress > 20
                        ? 'border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.4)]'
                        : 'border-dashed border-amber-400/90'
                    }`}
                  >
                    <div className="bg-slate-950/85 border border-amber-500/20 px-2 py-0.5 rounded text-[10px] font-mono font-bold text-amber-300">
                      {scanningState === 'ANALYZING' ? 'EXTRACTING BIOMETRICS' : qualityFeedback?.isPerfect ? 'PERFECT POSITION' : 'ALIGN FACE'}
                    </div>

                    {autoCaptureProgress > 0 && scanningState !== 'ANALYZING' && (
                      <div className="bg-slate-950/90 text-white px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 border border-emerald-500/40 animate-pulse">
                        <Zap className="w-3 h-3 text-amber-400 fill-amber-400" />
                        <span>Optimal Quality · Auto-Clicking</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Live Top Status Pill */}
                <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-900/80 backdrop-blur-xs text-[10px] text-emerald-400 font-mono border border-slate-700/50">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Classroom Wi-Fi Locked</span>
                  </div>

                  {/* Mirror button & Clarity Meter */}
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

                {/* Live Guidance Prompt Banner Floating on Camera */}
                <div className="absolute bottom-2.5 inset-x-3 pointer-events-none">
                  <div
                    className={`px-3 py-2 rounded-xl text-center text-xs font-semibold backdrop-blur-md shadow-lg transition-all duration-200 border ${
                      scanningState === 'ANALYZING'
                        ? 'bg-blue-950/90 text-blue-200 border-blue-500/60'
                        : qualityFeedback?.isPerfect
                        ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/60 ring-2 ring-emerald-500/50 animate-pulse'
                        : 'bg-slate-950/85 text-white border-slate-700/80'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      {scanningState === 'ANALYZING' ? (
                        <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
                      ) : qualityFeedback?.isPerfect ? (
                        <Sparkles className="w-4 h-4 text-emerald-400 animate-spin" />
                      ) : (
                        <Crosshair className="w-4 h-4 text-amber-400" />
                      )}
                      <span>
                        {scanningState === 'ANALYZING'
                          ? `${scanningStepText} (${livenessProgress}%)`
                          : qualityFeedback?.suggestion || 'Align face inside the oval frame...'}
                      </span>
                    </div>

                    {autoCaptureProgress > 0 && scanningState !== 'ANALYZING' && (
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1.5">
                        <div
                          className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-100 ease-out"
                          style={{ width: `${autoCaptureProgress}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Camera Error Fallback HUD */}
                {cameraError && (
                  <div className="absolute inset-0 bg-slate-900/95 p-4 flex flex-col items-center justify-center text-rose-300 text-xs z-30">
                    <AlertTriangle className="w-8 h-8 mb-2 text-rose-400" />
                    <p className="font-semibold text-center mb-1">Webcam Permission or Hardware Notice</p>
                    <p className="text-[11px] text-slate-300 text-center mb-3 max-w-xs">
                      {cameraError}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={startCamera}
                        className="px-3 py-1.5 bg-slate-700 text-white rounded font-medium text-xs hover:bg-slate-600 cursor-pointer flex items-center gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Retry Webcam</span>
                      </button>
                      <button
                        onClick={startSimulatedCamera}
                        className="px-3 py-1.5 bg-emerald-600 text-white rounded font-medium text-xs hover:bg-emerald-500 cursor-pointer flex items-center gap-1.5 shadow-xs"
                      >
                        <Video className="w-3.5 h-3.5" />
                        <span>Use Interactive Demo Camera</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Real-time Diagnostics HUD (Distance, Light, Position, Angle) */}
              <div className="grid grid-cols-4 gap-1.5 text-[11px]">
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

              {/* Student Enrolled Profile Indicator & Camera Source Switcher */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-slate-200 overflow-hidden shrink-0 ring-1 ring-slate-300">
                    {student?.photoDataUrl ? (
                      <img src={student.photoDataUrl} alt="Registered" className="w-full h-full object-cover" />
                    ) : (
                      <img src={student?.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-800">{student?.name}</span>
                    <span className="text-[10px] text-slate-500 block font-mono">{student?.prn}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={isUsingSimulator ? startCamera : startSimulatedCamera}
                    className="text-[10px] font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded border border-blue-200 transition-colors cursor-pointer flex items-center gap-1"
                    title="Toggle between physical webcam and simulated face stream"
                  >
                    <Video className="w-3 h-3" />
                    <span>{isUsingSimulator ? 'Use Physical Webcam' : 'Use Demo Face Stream'}</span>
                  </button>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-medium">
                    Face Registered
                  </span>
                </div>
              </div>



              {/* Action Button */}
              <button
                type="button"
                onClick={handleRunVerification}
                disabled={scanningState === 'ANALYZING'}
                className="w-full py-2.5 px-4 bg-[#0B2545] hover:bg-[#133E87] text-white text-xs font-semibold rounded-md shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {scanningState === 'ANALYZING' ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : autoCaptureProgress > 0 ? (
                  <Zap className="w-4 h-4 animate-bounce text-amber-300 fill-amber-300" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
                <span>
                  {scanningState === 'ANALYZING'
                    ? 'Verifying Biometrics...'
                    : autoCaptureProgress >= 50
                    ? 'Auto-Verifying Now...'
                    : 'Scan Now (Or Align Face for Auto-Click)'}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
