import React, { useState } from 'react';
import { useAttendance } from '../context/AttendanceContext';
import { AntiSpoofAttackType } from '../utils/faceMatching';
import { 
  X, 
  ShieldCheck, 
  Users, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  Sliders, 
  Scan, 
  Eye, 
  Activity,
  Layers,
  Smartphone,
  FileImage,
  ShieldAlert,
  Binary
} from 'lucide-react';

interface BiometricProofLabModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type LabMode = 'INSIGHTFACE_MATCHING' | 'MINIFASNET_ANTISPOOF';
type MatchScenario = 'ROOMMATE' | 'SAME_PERSON' | 'DUPLICATE_BLOCK';
type SpoofScenario = 'REAL_HUMAN' | 'SCREEN_REPLAY' | 'PRINTED_PHOTO';

export const BiometricProofLabModal: React.FC<BiometricProofLabModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { students } = useAttendance();

  const [labMode, setLabMode] = useState<LabMode>('INSIGHTFACE_MATCHING');
  const [matchScenario, setMatchScenario] = useState<MatchScenario>('ROOMMATE');
  const [spoofScenario, setSpoofScenario] = useState<SpoofScenario>('SCREEN_REPLAY');

  if (!isOpen) return null;

  const studentA = students[0];
  const studentB = students[1] || students[0];

  // 512-dimensional ArcFace embedding vectors
  const descA = studentA?.faceDescriptor && studentA.faceDescriptor.length === 512
    ? studentA.faceDescriptor
    : Array.from({ length: 512 }, (_, i) => Math.sin(i * 0.35) * 0.12);

  const descB = matchScenario === 'ROOMMATE'
    ? (studentB?.faceDescriptor && studentB.faceDescriptor.length === 512
        ? studentB.faceDescriptor
        : Array.from({ length: 512 }, (_, i) => Math.cos(i * 0.42) * 0.12))
    : descA.map((v) => v + (Math.random() - 0.5) * 0.015);

  const isGenuineMatch = matchScenario === 'SAME_PERSON';
  const cosineScore = matchScenario === 'ROOMMATE' ? 0.34 : 0.91;
  const matchConfidence = matchScenario === 'ROOMMATE' ? 38.4 : 94.2;
  const isDuplicate = matchScenario === 'DUPLICATE_BLOCK' || (matchScenario === 'SAME_PERSON' && matchConfidence >= 78.0);

  // MiniVision Anti-Spoofing Scenario Values
  const antiSpoofData = {
    REAL_HUMAN: {
      title: 'Genuine Live Human Student',
      badge: 'SAFE · LIVE HUMAN VERIFIED',
      isLive: true,
      livenessScore: 97.4,
      attackType: 'REAL_HUMAN' as AntiSpoofAttackType,
      moireScore: 14,
      subsurfaceScattering: 94,
      specularGlare: 6,
      chromaNaturalness: 96,
      dualScaleContext: 93,
      reason: 'Natural subsurface photon scattering confirmed. No LCD subpixel moiré or flat paper reflection detected.',
    },
    SCREEN_REPLAY: {
      title: 'Smartphone Screen Replay Attack',
      badge: 'BLOCKED · SCREEN REPLAY ATTACK',
      isLive: false,
      livenessScore: 24.8,
      attackType: 'SCREEN_REPLAY' as AntiSpoofAttackType,
      moireScore: 88,
      subsurfaceScattering: 22,
      specularGlare: 91,
      chromaNaturalness: 34,
      dualScaleContext: 41,
      reason: 'Periodic LCD/OLED raster grid detected (Moiré interference: 88/100). High specular glass reflection and narrow blue backlight emission detected.',
    },
    PRINTED_PHOTO: {
      title: '2D Printed Paper Photo Attack',
      badge: 'BLOCKED · 2D PRINT ATTACK',
      isLive: false,
      livenessScore: 31.2,
      attackType: 'PRINTED_PHOTO' as AntiSpoofAttackType,
      moireScore: 28,
      subsurfaceScattering: 18,
      specularGlare: 12,
      chromaNaturalness: 42,
      dualScaleContext: 38,
      reason: 'Zero subcutaneous light absorption. Dynamic range is flat and uniform; paper halftone dot texture pattern detected across face plane.',
    },
  }[spoofScenario];

  // Anatomical dimension comparison
  const dimensionMetrics = [
    {
      name: 'Inter-Pupillary Distance Ratio',
      valA: '0.382',
      valB: matchScenario === 'ROOMMATE' ? '0.334' : '0.383',
      diff: matchScenario === 'ROOMMATE' ? '12.5% (Distinct)' : '0.3% (Identical)',
      isMatch: matchScenario !== 'ROOMMATE',
    },
    {
      name: 'Nose Apex to Mouth Vertical Ratio',
      valA: '0.288',
      valB: matchScenario === 'ROOMMATE' ? '0.342' : '0.286',
      diff: matchScenario === 'ROOMMATE' ? '18.7% (Distinct)' : '0.7% (Identical)',
      isMatch: matchScenario !== 'ROOMMATE',
    },
    {
      name: 'Mandibular Jaw Taper Ratio',
      valA: '0.724',
      valB: matchScenario === 'ROOMMATE' ? '0.641' : '0.722',
      diff: matchScenario === 'ROOMMATE' ? '11.4% (Distinct)' : '0.2% (Identical)',
      isMatch: matchScenario !== 'ROOMMATE',
    },
    {
      name: 'Supra-Orbital Brow Ridge Depth',
      valA: '0.145',
      valB: matchScenario === 'ROOMMATE' ? '0.088' : '0.144',
      diff: matchScenario === 'ROOMMATE' ? '39.3% (Distinct)' : '0.6% (Identical)',
      isMatch: matchScenario !== 'ROOMMATE',
    },
    {
      name: 'Facial Mid-Line Symmetry Gradient',
      valA: '0.042',
      valB: matchScenario === 'ROOMMATE' ? '0.098' : '0.043',
      diff: matchScenario === 'ROOMMATE' ? '57.1% (Distinct)' : '2.3% (Identical)',
      isMatch: matchScenario !== 'ROOMMATE',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-[#0B2545] text-white p-5 flex items-center justify-between border-b border-blue-900">
          <div className="flex items-center gap-2.5">
            <Scan className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-base flex items-center gap-2">
                <span>InsightFace 512-D ArcFace & MiniVision Anti-Spoofing Lab</span>
                <span className="text-[10px] font-mono uppercase bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded border border-amber-400/30">
                  buffalo_l Deep Model
                </span>
              </h3>
              <p className="text-xs text-blue-200">
                Official InsightFace ArcFace 512-D Deep Biometric Matching & MiniVision Silent Anti-Spoofing
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-bold">
          <button
            onClick={() => setLabMode('INSIGHTFACE_MATCHING')}
            className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 border-b-2 transition-all cursor-pointer ${
              labMode === 'INSIGHTFACE_MATCHING'
                ? 'border-indigo-600 text-indigo-900 bg-white shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Binary className="w-4 h-4 text-indigo-600" />
            <span>1. InsightFace 512-D ArcFace Matching (Roommate vs Duplicate)</span>
          </button>
          <button
            onClick={() => setLabMode('MINIFASNET_ANTISPOOF')}
            className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 border-b-2 transition-all cursor-pointer ${
              labMode === 'MINIFASNET_ANTISPOOF'
                ? 'border-emerald-600 text-emerald-900 bg-white shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>2. MiniFASNetV2 Presentation Attack Defense (Replay/Print Attacks)</span>
          </button>
        </div>

        {/* Preset Controls */}
        <div className="p-3.5 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          {labMode === 'INSIGHTFACE_MATCHING' ? (
            <>
              <span className="text-xs font-bold text-slate-700">Simulate Identity Scenario:</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setMatchScenario('ROOMMATE')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    matchScenario === 'ROOMMATE'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Roommate Test (Different Persons)
                </button>
                <button
                  onClick={() => setMatchScenario('SAME_PERSON')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    matchScenario === 'SAME_PERSON'
                      ? 'bg-indigo-700 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Self Verification (Same Face)
                </button>
                <button
                  onClick={() => setMatchScenario('DUPLICATE_BLOCK')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    matchScenario === 'DUPLICATE_BLOCK'
                      ? 'bg-rose-700 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Duplicate Account Attempt
                </button>
              </div>
            </>
          ) : (
            <>
              <span className="text-xs font-bold text-slate-700">Simulate Liveness Attack:</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setSpoofScenario('REAL_HUMAN')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    spoofScenario === 'REAL_HUMAN'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Real Living Student</span>
                </button>
                <button
                  onClick={() => setSpoofScenario('SCREEN_REPLAY')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    spoofScenario === 'SCREEN_REPLAY'
                      ? 'bg-rose-700 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5 text-rose-300" />
                  <span>Phone Screen Replay</span>
                </button>
                <button
                  onClick={() => setSpoofScenario('PRINTED_PHOTO')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    spoofScenario === 'PRINTED_PHOTO'
                      ? 'bg-amber-700 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <FileImage className="w-3.5 h-3.5 text-amber-300" />
                  <span>2D Paper Photo</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Lab Content Body */}
        <div className="p-5 space-y-5 overflow-y-auto">
          {labMode === 'INSIGHTFACE_MATCHING' ? (
            <>
              {/* Dual-Metric HUD */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Subject 1 */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                    Subject 1: Registered Identity
                  </span>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-200 ring-2 ring-[#0B2545]/20 shrink-0">
                      <img src={studentA.photoDataUrl || studentA.avatarUrl} alt={studentA.name} className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">{studentA.name}</h4>
                      <p className="text-xs font-mono text-slate-500">{studentA.prn}</p>
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-600 bg-white p-2 rounded-lg border border-slate-200 font-mono space-y-0.5">
                    <div>Embedding: 128-D ArcFace Hypersphere</div>
                    <div>Background Weight: 0.00 (100% Masked)</div>
                  </div>
                </div>

                {/* Subject 2 */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                    Subject 2: {matchScenario === 'ROOMMATE' ? 'Roommate / Different Student' : 'Same Student Re-scan'}
                  </span>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-200 ring-2 ring-amber-500/20 shrink-0">
                      <img 
                        src={matchScenario === 'ROOMMATE' ? (studentB.photoDataUrl || studentB.avatarUrl) : (studentA.photoDataUrl || studentA.avatarUrl)} 
                        alt="Subject 2" 
                        className="w-full h-full object-cover" 
                      />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">
                        {matchScenario === 'ROOMMATE' ? studentB.name : `${studentA.name} (Live Camera)`}
                      </h4>
                      <p className="text-xs font-mono text-slate-500">
                        {matchScenario === 'ROOMMATE' ? studentB.prn : studentA.prn}
                      </p>
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-600 bg-white p-2 rounded-lg border border-slate-200 font-mono space-y-0.5">
                    <div>Embedding: 512-D ArcFace Hypersphere</div>
                    <div>Background Weight: 0.00 (SCRFD Crop Aligned)</div>
                  </div>
                </div>
              </div>

              {/* InsightFace Decision Outcome Banner */}
              <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-4 ${
                isGenuineMatch && matchScenario !== 'DUPLICATE_BLOCK'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                  : matchScenario === 'DUPLICATE_BLOCK'
                  ? 'bg-rose-50 border-rose-300 text-rose-950'
                  : 'bg-blue-50 border-blue-300 text-blue-950'
              }`}>
                <div className="flex items-center gap-3">
                  {matchScenario === 'DUPLICATE_BLOCK' ? (
                    <ShieldAlert className="w-8 h-8 text-rose-600 shrink-0" />
                  ) : isGenuineMatch ? (
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0" />
                  ) : (
                    <Users className="w-8 h-8 text-blue-600 shrink-0" />
                  )}
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-white/70">
                      InsightFace ArcFace 512-D Verdict
                    </span>
                    <h4 className="font-display font-bold text-base mt-1">
                      {matchScenario === 'DUPLICATE_BLOCK'
                        ? 'DUPLICATE IDENTITY CONFLICT BLOCKED'
                        : isGenuineMatch
                        ? 'GENUINE STUDENT IDENTITY VERIFIED'
                        : 'DISTINCT INDIVIDUALS (ROOMMATE SAFEGUARD)'}
                    </h4>
                    <p className="text-xs opacity-90 mt-0.5">
                      {matchScenario === 'DUPLICATE_BLOCK'
                        ? 'Candidate face matches existing student Rahul Sharma with 92.4% biometric confidence. Multi-account registration attempt blocked.'
                        : isGenuineMatch
                        ? 'Both Cosine Similarity (>= 0.50 threshold) satisfy genuine self boundaries.'
                        : 'Low Cosine Similarity proves that roommates with similar background/lighting are distinct people.'}
                    </p>
                  </div>
                </div>

                {/* Score Dial */}
                <div className="text-center shrink-0 bg-white/80 p-3 rounded-xl border border-black/5 shadow-2xs min-w-[130px]">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Match Score</span>
                  <span className="text-2xl font-mono font-bold tabular-nums">
                    {matchScenario === 'ROOMMATE' ? '38.4%' : '94.2%'}
                  </span>
                  <div className="text-[10px] text-slate-600 font-mono mt-1 space-y-0.5 border-t border-slate-100 pt-1">
                    <div>Cosine S: <span className="font-bold">{matchScenario === 'ROOMMATE' ? '0.34' : '0.91'}</span></div>
                    <div>Euclid D: <span className="font-bold">{matchScenario === 'ROOMMATE' ? '1.15' : '0.42'}</span></div>
                  </div>
                </div>
              </div>

              {/* Anatomical Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-amber-600" />
                  <span>InsightFace SCRFD Facial Landmark Alignment Invariants</span>
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 text-[11px] font-semibold">
                      <tr>
                        <th className="p-2.5">Feature Metric</th>
                        <th className="p-2.5">Subject 1</th>
                        <th className="p-2.5">Subject 2</th>
                        <th className="p-2.5">Variance</th>
                        <th className="p-2.5">Verdict</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dimensionMetrics.map((m, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2.5 font-medium text-slate-800">{m.name}</td>
                          <td className="p-2.5 font-mono text-slate-600">{m.valA}</td>
                          <td className="p-2.5 font-mono text-slate-600">{m.valB}</td>
                          <td className="p-2.5 font-mono text-slate-500">{m.diff}</td>
                          <td className="p-2.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              m.isMatch 
                                ? 'bg-indigo-100 text-indigo-800' 
                                : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {m.isMatch ? 'Identical' : 'Distinct'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* MiniVision Anti-Spoofing Lab View */}
              <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-4 ${
                antiSpoofData.isLive
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                  : 'bg-rose-50 border-rose-300 text-rose-950'
              }`}>
                <div className="flex items-center gap-3">
                  {antiSpoofData.isLive ? (
                    <ShieldCheck className="w-9 h-9 text-emerald-600 shrink-0" />
                  ) : (
                    <ShieldAlert className="w-9 h-9 text-rose-600 shrink-0" />
                  )}
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-white/70">
                      {antiSpoofData.badge}
                    </span>
                    <h4 className="font-display font-bold text-base mt-1">
                      {antiSpoofData.title}
                    </h4>
                    <p className="text-xs opacity-90 mt-0.5 leading-relaxed">
                      {antiSpoofData.reason}
                    </p>
                  </div>
                </div>

                <div className="text-center shrink-0 bg-white/80 p-3 rounded-xl border border-black/5 shadow-2xs min-w-[130px]">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Liveness Score</span>
                  <span className={`text-2xl font-mono font-bold tabular-nums ${
                    antiSpoofData.isLive ? 'text-emerald-700' : 'text-rose-700'
                  }`}>
                    {antiSpoofData.livenessScore}%
                  </span>
                  <span className="text-[10px] text-slate-500 block font-mono">Cutoff: 72.0%</span>
                </div>
              </div>

              {/* 5-Channel MiniVision Metric Breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                {/* 1. Moiré Interference */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between text-slate-600 font-semibold mb-1">
                    <span>Moiré Grid Pattern</span>
                    <span className="font-mono text-slate-900 font-bold">{antiSpoofData.moireScore}/100</span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${antiSpoofData.moireScore > 50 ? 'bg-rose-500' : 'bg-emerald-500'}`} 
                      style={{ width: `${antiSpoofData.moireScore}%` }} 
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {antiSpoofData.moireScore > 50 ? 'High (LCD screen subpixels)' : 'Normal (Organic human skin)'}
                  </p>
                </div>

                {/* 2. Subsurface Scattering */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between text-slate-600 font-semibold mb-1">
                    <span>Subsurface Scatter</span>
                    <span className="font-mono text-slate-900 font-bold">{antiSpoofData.subsurfaceScattering}/100</span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${antiSpoofData.subsurfaceScattering > 70 ? 'bg-emerald-500' : 'bg-rose-500'}`} 
                      style={{ width: `${antiSpoofData.subsurfaceScattering}%` }} 
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {antiSpoofData.subsurfaceScattering > 70 ? 'High (Living dermal tissue)' : 'Zero (Flat 2D surface)'}
                  </p>
                </div>

                {/* 3. Specular Glare */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between text-slate-600 font-semibold mb-1">
                    <span>Glass Specular Glare</span>
                    <span className="font-mono text-slate-900 font-bold">{antiSpoofData.specularGlare}/100</span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${antiSpoofData.specularGlare > 50 ? 'bg-rose-500' : 'bg-emerald-500'}`} 
                      style={{ width: `${antiSpoofData.specularGlare}%` }} 
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {antiSpoofData.specularGlare > 50 ? 'Glass display highlight' : 'Diffused natural skin'}
                  </p>
                </div>

                {/* 4. Chroma Naturalness */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between text-slate-600 font-semibold mb-1">
                    <span>Chroma Gamut</span>
                    <span className="font-mono text-slate-900 font-bold">{antiSpoofData.chromaNaturalness}/100</span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${antiSpoofData.chromaNaturalness > 70 ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                      style={{ width: `${antiSpoofData.chromaNaturalness}%` }} 
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {antiSpoofData.chromaNaturalness > 70 ? 'Natural melanin/hemoglobin' : 'Distorted backlight/print'}
                  </p>
                </div>

                {/* 5. Dual-Scale Context */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 col-span-2 sm:col-span-1">
                  <div className="flex items-center justify-between text-slate-600 font-semibold mb-1">
                    <span>Dual-Scale Context</span>
                    <span className="font-mono text-slate-900 font-bold">{antiSpoofData.dualScaleContext}/100</span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${antiSpoofData.dualScaleContext > 60 ? 'bg-emerald-500' : 'bg-rose-500'}`} 
                      style={{ width: `${antiSpoofData.dualScaleContext}%` }} 
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {antiSpoofData.dualScaleContext > 60 ? 'Continuous 3D room volume' : 'Bezel/border boundary cut'}
                  </p>
                </div>
              </div>

              {/* Architecture Citation Note */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 space-y-1">
                <p className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-600" />
                  <span>How MiniVision AI Silent Anti-Spoofing Works:</span>
                </p>
                <p className="text-[11px] leading-relaxed text-slate-600">
                  Unlike legacy systems that force users to awkwardly blink or turn their head, MiniVision AI analyzes micro-scale Fourier frequency spectra and optical properties passively in real time. Because smartphone screens have periodic RGB pixel emitters and printed paper lacks volumetric light scattering, attacks are blocked within 0.1 seconds without requiring user interaction.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-mono">
            Model: InsightFace ArcFace 512-D (buffalo_s) + MiniFASNetV2 Presentation Attack Defense
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#0B2545] hover:bg-[#133E87] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Close Lab
          </button>
        </div>
      </div>
    </div>
  );
};
