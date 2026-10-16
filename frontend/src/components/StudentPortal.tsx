import React, { useState } from 'react';
import { useAttendance } from '../context/AttendanceContext';
import { 
  Camera, 
  ShieldCheck, 
  Wifi, 
  WifiOff, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  UserCheck, 
  Calendar, 
  Info, 
  Sparkles,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  Lock,
  UserX,
  FileText
} from 'lucide-react';
import { FaceVerificationModal } from './FaceVerificationModal';
import { FirstTimeFaceEnrollModal } from './FirstTimeFaceEnrollModal';
import { AttendanceHealthCard } from './AttendanceHealthCard';
import { OfficialAttendancePassModal } from './OfficialAttendancePassModal';

interface StudentPortalProps {
  onOpenStudentRegister?: () => void;
  onOpenWifiConfig?: () => void;
  onOpenStudentDatabase?: () => void;
}

export const StudentPortal: React.FC<StudentPortalProps> = ({ 
  onOpenStudentRegister, 
  onOpenWifiConfig,
  onOpenStudentDatabase 
}) => {
  const {
    currentUser,
    students,
    activeSession,
    startSession,
    networkConfig,
    toggleNetworkMode,
    attendanceRecords,
    timetable,
  } = useAttendance();

  const student = students.find((s) => s.prn === currentUser?.student?.prn) || currentUser?.student;
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [isFirstTimeModalOpen, setIsFirstTimeModalOpen] = useState(() => {
    return student ? !student.isFaceEnrolled : false;
  });
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  if (!student) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-white rounded-xl shadow-xs text-center border border-slate-200">
        <p className="text-sm text-slate-600">Please log in as a student to access the student portal.</p>
      </div>
    );
  }

  // Find attendance record for active session
  const currentPeriodNumber = activeSession ? activeSession.periodNumber : 1;
  const activeRecord = attendanceRecords.find(
    (r) => r.periodNumber === currentPeriodNumber && r.studentPrn === student.prn
  );

  const formatRemaining = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Student Identity Card */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-slate-100 overflow-hidden ring-2 ring-[#0B2545]/20 shadow-xs shrink-0">
              {student.photoDataUrl ? (
                <img
                  src={student.photoDataUrl}
                  alt={student.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <img
                  src={student.avatarUrl}
                  alt={student.name}
                  className="w-full h-full object-cover"
                />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display font-bold text-xl text-[#0B2545]">
                  {student.name}
                </h1>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                  {student.semester}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                PRN: <span className="font-semibold text-slate-800">{student.prn}</span> · Roll #{student.rollNo}
              </p>
              <p className="text-xs text-slate-500">{student.department}</p>
            </div>
          </div>

          {/* Biometric Status & Overall Attendance */}
          <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
            <div className="text-right">
              <span className="text-[11px] text-slate-500 block">Overall Attendance</span>
              <span className="text-xl font-bold font-mono text-[#0B2545] tabular-nums">
                {student.overallAttendancePercentage}%
              </span>
            </div>

            <div className="pl-4 border-l border-slate-200 text-right">
              {student.isFaceEnrolled ? (
                <div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Face Enrolled</span>
                  </span>
                  <button
                    onClick={() => setIsFirstTimeModalOpen(true)}
                    className="block text-[10px] text-slate-400 hover:text-[#0B2545] mt-1 underline cursor-pointer ml-auto"
                  >
                    Update / Re-verify Face
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsFirstTimeModalOpen(true)}
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer animate-pulse"
                >
                  <Camera className="w-4 h-4" />
                  <span>Enroll Face Now</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mandatory First-Time Notice Banner if not enrolled */}
      {!student.isFaceEnrolled && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 text-amber-800 shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <p className="font-bold text-amber-900">
                First-Time Login: Face Verification Required
              </p>
              <p className="text-[11px] text-amber-800 mt-0.5">
                You must verify and enroll your face once before you can mark attendance for classes. One face cannot be registered to multiple student accounts.
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsFirstTimeModalOpen(true)}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold text-xs shadow-xs transition-colors cursor-pointer shrink-0"
          >
            Open Front Camera Verification
          </button>
        </div>
      )}

      {/* Classroom Network Status Banner */}
      <div
        className={`rounded-xl p-4 border transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
          networkConfig.isClassroomWifiConnected
            ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
            : 'bg-rose-50/90 border-rose-200 text-rose-950'
        }`}
      >
        <div className="flex items-start sm:items-center gap-3">
          <div
            className={`p-2 rounded-lg shrink-0 ${
              networkConfig.isClassroomWifiConnected
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-rose-100 text-rose-700'
            }`}
          >
            {networkConfig.isClassroomWifiConnected ? (
              <Wifi className="w-5 h-5" />
            ) : (
              <WifiOff className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold">
                {networkConfig.isClassroomWifiConnected
                  ? 'Authorized Base Wi-Fi Active'
                  : 'Network Mismatch: Attendance Blocked'}
              </span>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white/60">
                IP: {networkConfig.currentIp || 'Detecting...'}
              </span>
            </div>
            <p className="text-[11px] opacity-90 mt-0.5">
              {networkConfig.isClassroomWifiConnected
                ? `Gateway: ${networkConfig.currentIsp || 'Classroom Wi-Fi'} · Locked to Base IP: ${networkConfig.baseWifiIp}. Attendance allowed.`
                : `Current IP ${networkConfig.currentIp} does not match Classroom Base Wi-Fi (${networkConfig.baseWifiIp}). Attendance is strictly blocked.`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onOpenWifiConfig && (
            <button
              onClick={onOpenWifiConfig}
              className="px-3 py-1.5 rounded-lg bg-white shadow-xs border border-slate-200 font-semibold text-slate-800 hover:bg-slate-50 transition-colors text-center cursor-pointer text-xs"
            >
              Wi-Fi Gateway Details
            </button>
          )}
          <button
            onClick={() => toggleNetworkMode(!networkConfig.isClassroomWifiConnected)}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors text-center cursor-pointer text-xs ${
              networkConfig.isClassroomWifiConnected
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
            }`}
          >
            {networkConfig.isClassroomWifiConnected ? 'Test Mismatch (Cellular)' : 'Switch Back to Base Wi-Fi'}
          </button>
        </div>
      </div>

      {/* Active Period Attendance Section */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="bg-[#0B2545] text-white p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs text-blue-200 mb-1">
                <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-bold uppercase tracking-wider text-[10px]">
                  {activeSession && activeSession.isActive ? 'Active Period' : 'Class Schedule'}
                </span>
                <span>Period {activeSession?.periodNumber || 1} of 7</span>
              </div>
              <h2 className="font-display font-bold text-xl sm:text-2xl text-white">
                {activeSession?.subjectCode || 'CSE301'}: {activeSession?.subjectName || 'Computer Networks'}
              </h2>
              <p className="text-xs text-blue-200 mt-1">
                Room: <span className="font-semibold text-white">{activeSession?.room || 'Hall CR-304'}</span> · Instructor: <span className="font-semibold text-white">{activeSession?.facultyName || 'Dr. K. Narayanan'}</span>
              </p>
            </div>

            {/* Countdown or status */}
            <div className="shrink-0 text-left md:text-right">
              {activeSession && activeSession.isActive ? (
                <div className="bg-white/10 backdrop-blur-xs px-4 py-2.5 rounded-xl border border-white/20 inline-block">
                  <span className="text-[10px] text-slate-300 uppercase tracking-wider block font-semibold">
                    Attendance Window
                  </span>
                  <div className="font-mono font-bold text-2xl text-amber-300 tabular-nums flex items-center gap-1.5">
                    <Clock className="w-5 h-5 text-amber-400" />
                    <span>{formatRemaining(activeSession.remainingSeconds)}</span>
                  </div>
                </div>
              ) : (
                <span className="text-xs text-slate-300 bg-white/10 px-3 py-1.5 rounded-lg">
                  Window Closed (Teacher must enable)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Verification Action Body */}
        <div className="p-6">
          {activeRecord?.status === 'PRESENT' ? (
            <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                    Attendance Recorded
                  </span>
                  <h4 className="font-display font-bold text-base text-emerald-950 mt-1">
                    Present · Verified by Facial Recognition
                  </h4>
                  <p className="text-xs text-emerald-800 font-mono mt-0.5">
                    Check-in Time: {activeRecord.timestamp} · Match: {activeRecord.matchConfidence}% · Liveness: {activeRecord.livenessScore}%
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setIsVerifyModalOpen(true)}
                  className="px-3 py-2 bg-white hover:bg-slate-50 border border-emerald-300 text-emerald-800 rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer shrink-0 flex items-center gap-1.5"
                  title="Test InsightFace ArcFace 512-D neural biometric verification again"
                >
                  <Camera className="w-4 h-4 text-emerald-600" />
                  <span>Re-Scan Face (InsightFace)</span>
                </button>
                <button
                  onClick={() => setShowReceiptModal(true)}
                  className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer shrink-0 flex items-center gap-1.5"
                >
                  <FileText className="w-4 h-4" />
                  <span>View Digital Attendance Pass</span>
                </button>
              </div>
            </div>
          ) : activeSession && activeSession.isActive ? (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                <div>
                  <h4 className="font-bold text-blue-950 text-sm">
                    Period {activeSession.periodNumber} Attendance is Open!
                  </h4>
                  <p className="text-blue-800 mt-0.5">
                    The 5-minute timed attendance window is running. Look at your front camera to verify identity.
                  </p>
                </div>

                <button
                  onClick={() => {
                    if (!student.isFaceEnrolled) {
                      setIsFirstTimeModalOpen(true);
                    } else {
                      setIsVerifyModalOpen(true);
                    }
                  }}
                  className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
                >
                  <Camera className="w-4 h-4" />
                  <span>
                    {!student.isFaceEnrolled ? 'Enroll Face First to Check In' : 'Mark Attendance (Face Scan)'}
                  </span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-slate-500 text-xs border border-dashed border-slate-200 rounded-xl space-y-3">
              <Clock className="w-8 h-8 text-slate-400 mx-auto" />
              <div>
                <p className="font-semibold text-slate-700">Attendance Window Closed</p>
                <p className="text-slate-500 max-w-sm mx-auto mt-0.5">
                  Attendance sessions open for 5 minutes when the faculty instructor enables it for each period.
                </p>
              </div>
              <button
                onClick={() => startSession(1)}
                className="px-4 py-2 bg-[#0B2545] hover:bg-[#133E87] text-white font-bold rounded-lg text-xs shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Open Period 1 Attendance Window (5 Min Demo)</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 7-Period Daily Timetable Grid */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-amber-600" />
            <h3 className="font-display font-bold text-sm text-slate-900">
              Official 7-Period Timetable (Today's Schedule)
            </h3>
          </div>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
            {student.semester}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2.5">
          {timetable.map((period) => {
            const isCurrent = activeSession?.periodNumber === period.periodNumber;
            const rec = attendanceRecords.find(
              (r) => r.periodNumber === period.periodNumber && r.studentPrn === student.prn
            );
            const isPresent = rec?.status === 'PRESENT';

            return (
              <div
                key={period.periodNumber}
                className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                  isCurrent
                    ? 'border-amber-400 bg-amber-50/40 ring-2 ring-amber-400/20'
                    : isPresent
                    ? 'border-emerald-200 bg-emerald-50/30'
                    : 'border-slate-200 bg-slate-50/50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-bold text-slate-700">Period {period.periodNumber}</span>
                    <span className="font-mono text-slate-400">{period.timeSlot.split(' - ')[0]}</span>
                  </div>
                  <p className="font-bold text-xs text-slate-900 mt-1 truncate" title={period.subjectName}>
                    {period.subjectCode}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate">{period.subjectName}</p>
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                  <span className="text-slate-400 font-mono">{period.room}</span>
                  {isPresent ? (
                    <span className="font-bold text-emerald-700">Present</span>
                  ) : isCurrent ? (
                    <span className="font-bold text-amber-700 animate-pulse">In Progress</span>
                  ) : (
                    <span className="text-slate-400">Scheduled</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Linways Academic 75% Attendance Rule & 30-Day Monthly Heatmap */}
      <AttendanceHealthCard
        student={student}
        timetable={timetable}
        records={attendanceRecords}
      />

      {/* Modals */}
      <FirstTimeFaceEnrollModal
        isOpen={isFirstTimeModalOpen}
        onClose={() => setIsFirstTimeModalOpen(false)}
      />

      <FaceVerificationModal
        isOpen={isVerifyModalOpen}
        onClose={() => setIsVerifyModalOpen(false)}
        onSuccess={() => setIsVerifyModalOpen(false)}
      />

      {/* Printable Digital Attendance Pass Certificate */}
      {activeRecord && (
        <OfficialAttendancePassModal
          isOpen={showReceiptModal}
          onClose={() => setShowReceiptModal(false)}
          record={activeRecord}
          student={student}
        />
      )}
    </div>
  );
};
