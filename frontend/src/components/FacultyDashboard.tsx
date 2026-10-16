import React, { useState } from 'react';
import { useAttendance } from '../context/AttendanceContext';
import { 
  Users, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  Search, 
  ShieldAlert, 
  UserCheck, 
  Download, 
  FileSpreadsheet, 
  ChevronRight, 
  Filter, 
  Sparkles,
  RefreshCw,
  PlusCircle,
  HelpCircle,
  UserPlus,
  Wifi,
  WifiOff,
  Scan,
  BarChart3,
  Database
} from 'lucide-react';
import { OverrideReason } from '../types/attendance';
import { BiometricProofLabModal } from './BiometricProofLabModal';

interface FacultyDashboardProps {
  onOpenStudentRegister?: () => void;
  onOpenWifiConfig?: () => void;
  onOpenStudentDatabase?: () => void;
}

export const FacultyDashboard: React.FC<FacultyDashboardProps> = ({ 
  onOpenStudentRegister,
  onOpenWifiConfig,
  onOpenStudentDatabase
}) => {
  const {
    students,
    activeSession,
    timetable,
    attendanceRecords,
    auditLogs,
    networkConfig,
    startSession,
    endSession,
    extendSession,
    performManualOverride,
    resetFaceEnrollments,
    currentUser,
  } = useAttendance();

  const [selectedPeriod, setSelectedPeriod] = useState<number>(() => {
    return activeSession?.periodNumber || 3;
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PRESENT' | 'ABSENT' | 'FAILED' | 'OVERRIDE'>('ALL');
  
  // Manual override modal state
  const [overrideStudentPrn, setOverrideStudentPrn] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState<OverrideReason>('VISUAL_IDENTITY_VERIFIED');
  const [overrideNote, setOverrideNote] = useState('');

  // Audit drawer state
  const [showAuditDrawer, setShowAuditDrawer] = useState(false);
  // Biometric Proof Lab modal state
  const [showProofLab, setShowProofLab] = useState(false);

  const currentPeriodInfo = timetable.find((p) => p.periodNumber === selectedPeriod) || timetable[0];

  // Records for currently selected period
  const periodRecords = attendanceRecords.filter((r) => r.periodNumber === selectedPeriod);

  // Merge students with their period records
  const studentRows = students.map((s) => {
    const rec = periodRecords.find((r) => r.studentPrn === s.prn);
    return {
      student: s,
      record: rec,
      status: rec ? rec.status : 'ABSENT',
      method: rec ? rec.verificationMethod : 'UNRECORDED',
      time: rec ? rec.timestamp : '--:--:--',
      matchScore: rec ? rec.matchConfidence : 0,
      notes: rec?.notes,
    };
  });

  // KPI Calculations
  const totalCount = students.length;
  const presentCount = studentRows.filter((r) => r.status === 'PRESENT').length;
  const overrideCount = studentRows.filter((r) => r.status === 'MANUAL_OVERRIDE').length;
  const failedCount = studentRows.filter((r) => r.status === 'VERIFICATION_FAILED').length;
  const absentCount = studentRows.filter((r) => r.status === 'ABSENT').length;
  const totalVerified = presentCount + overrideCount;
  const attendanceRate = totalCount > 0 ? ((totalVerified / totalCount) * 100).toFixed(1) : '0';

  // Filtered rows
  const filteredRows = studentRows.filter((row) => {
    const matchesSearch =
      row.student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      row.student.prn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      row.student.rollNo.toString().includes(searchQuery);

    if (!matchesSearch) return false;

    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'PRESENT') return row.status === 'PRESENT';
    if (statusFilter === 'ABSENT') return row.status === 'ABSENT';
    if (statusFilter === 'FAILED') return row.status === 'VERIFICATION_FAILED';
    if (statusFilter === 'OVERRIDE') return row.status === 'MANUAL_OVERRIDE';
    return true;
  });

  const formatRemaining = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleExportCSV = () => {
    const headers = ['Roll No', 'PRN', 'Student Name', 'Department', 'Status', 'Method', 'Timestamp', 'Match %', 'Notes'];
    const rows = studentRows.map((r) => [
      r.student.rollNo,
      r.student.prn,
      `"${r.student.name}"`,
      `"${r.student.department}"`,
      r.status,
      r.method,
      r.time,
      r.matchScore > 0 ? `${r.matchScore}%` : 'N/A',
      `"${r.notes || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `CVV_Attendance_Period_${selectedPeriod}_${currentPeriodInfo.subjectCode}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleConfirmOverride = () => {
    if (!overrideStudentPrn) return;
    const teacherId = currentUser?.faculty?.facultyId || 'FAC-CSE-108';
    performManualOverride(teacherId, overrideStudentPrn, overrideReason, overrideNote);
    setOverrideStudentPrn(null);
    setOverrideNote('');
  };

  const isCurrentPeriodActive = activeSession && activeSession.periodNumber === selectedPeriod && activeSession.isActive;

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Institutional Breadcrumb & Header */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <span>Chinmaya Vishwa Vidyapeeth</span>
            <span>/</span>
            <span>Faculty Academic SMS</span>
            <span>/</span>
            <span className="text-slate-800 font-semibold">Attendance Management</span>
          </div>
          <h1 className="font-display font-bold text-2xl text-[#0B2545] tracking-tight">
            Class Attendance Console · B.Tech CSE (Semester 6)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Classroom Hall CR-304 · Batch 2023–2027 · Total Enrolled: <span className="font-semibold text-slate-800 font-mono">{totalCount} Students</span>
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          {onOpenWifiConfig && (
            <button
              onClick={onOpenWifiConfig}
              className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors border flex items-center gap-1.5 cursor-pointer shadow-xs ${
                networkConfig.isClassroomWifiConnected
                  ? 'text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border-emerald-300'
                  : 'text-rose-800 bg-rose-50 hover:bg-rose-100 border-rose-300'
              }`}
              title="Classroom Base Wi-Fi Lock Status (Click to inspect or test)"
            >
              {networkConfig.isClassroomWifiConnected ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Base Wi-Fi Active ({networkConfig.currentIp})</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-rose-600" />
                  <span>Wi-Fi Blocked ({networkConfig.currentIp})</span>
                </>
              )}
            </button>
          )}

          <button
            onClick={() => {
              if (window.confirm('Reset face biometrics for all students? Students will be prompted for fresh face registration on next login.')) {
                resetFaceEnrollments();
              }
            }}
            className="px-3 py-2 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors border border-amber-300 flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Reset face biometric data for testing"
          >
            <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
            <span>Reset Face IDs</span>
          </button>

          {onOpenStudentDatabase && (
            <button
              onClick={onOpenStudentDatabase}
              className="px-3.5 py-2 text-xs font-semibold text-blue-900 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-300 flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Open Student & Faces Database to add students, register faces, and reset database"
            >
              <Database className="w-4 h-4 text-amber-600" />
              <span>Student & Face Database ({students.length})</span>
            </button>
          )}

          {onOpenStudentRegister && (
            <button
              onClick={onOpenStudentRegister}
              className="px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-300 flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <UserCheck className="w-4 h-4 text-emerald-600" />
              <span>+ Enroll Student</span>
            </button>
          )}

          <button
            onClick={() => setShowProofLab(true)}
            className="px-3.5 py-2 text-xs font-semibold text-indigo-900 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-300 flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Inspect roommate vs same-face biometric differentiation and cosine distance"
          >
            <Scan className="w-4 h-4 text-indigo-600" />
            <span>Biometric Proof Lab</span>
          </button>

          <button
            onClick={() => setShowAuditDrawer(true)}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-300 flex items-center gap-1.5 cursor-pointer"
          >
            <ShieldAlert className="w-4 h-4 text-slate-600" />
            <span>Audit Trail ({auditLogs.length})</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-[#0B2545] hover:bg-[#133E87] rounded-lg transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 7-Period Timetable Navigator Bar */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Daily Timetable Schedule (7 Periods)
          </span>
          <span className="text-xs text-slate-400">
            Click any period to manage or inspect attendance records
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {timetable.map((period) => {
            const isSelected = selectedPeriod === period.periodNumber;
            const isLive = activeSession && activeSession.periodNumber === period.periodNumber && activeSession.isActive;
            const recordsThisPeriod = attendanceRecords.filter((r) => r.periodNumber === period.periodNumber);
            const verifiedInPeriod = recordsThisPeriod.filter((r) => r.status === 'PRESENT' || r.status === 'MANUAL_OVERRIDE').length;

            return (
              <button
                key={period.periodNumber}
                onClick={() => setSelectedPeriod(period.periodNumber)}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer relative overflow-hidden ${
                  isSelected
                    ? 'border-[#0B2545] bg-[#0B2545]/5 ring-2 ring-[#0B2545]/20'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 hover:border-slate-300'
                }`}
              >
                {isLive && (
                  <span className="absolute top-1 right-1.5 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700">Period {period.periodNumber}</span>
                  <span className="text-[10px] text-slate-400 font-mono">{period.timeSlot.split(' - ')[0]}</span>
                </div>

                <p className="text-xs font-semibold text-slate-900 truncate mt-1" title={period.subjectName}>
                  {period.subjectCode}
                </p>
                <p className="text-[10px] text-slate-500 truncate">{period.subjectName}</p>

                <div className="mt-2 pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-[10px]">
                  <span className="text-slate-400 font-mono tabular-nums">
                    {verifiedInPeriod > 0 ? `${verifiedInPeriod}/${totalCount}` : 'Not Taken'}
                  </span>
                  {isLive ? (
                    <span className="font-semibold text-emerald-600">LIVE</span>
                  ) : verifiedInPeriod > 0 ? (
                    <span className="text-slate-500">Done</span>
                  ) : (
                    <span className="text-amber-600">Pending</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Period Controller HUD */}
      <div className="bg-gradient-to-r from-[#0B2545] to-[#133E87] rounded-xl text-white p-6 shadow-md border border-blue-900">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Period Details */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-bold text-xs uppercase tracking-wider">
                Period {selectedPeriod}
              </span>
              <span className="text-xs text-blue-200">
                {currentPeriodInfo.timeSlot} · {currentPeriodInfo.room}
              </span>
            </div>
            <h2 className="font-display font-bold text-xl sm:text-2xl text-white">
              {currentPeriodInfo.subjectCode}: {currentPeriodInfo.subjectName}
            </h2>
            <p className="text-xs text-blue-200 mt-1">
              Instructor: <span className="font-semibold text-white">{currentPeriodInfo.facultyName}</span> · Classroom Wi-Fi Enforced: <span className="font-mono text-emerald-300">CVV-Campus-Secure-5G</span>
            </p>
          </div>

          {/* Session Timer & Action Buttons */}
          <div className="flex items-center gap-4 shrink-0">
            {isCurrentPeriodActive ? (
              <div className="flex items-center gap-4 bg-white/10 backdrop-blur-xs p-3 rounded-xl border border-white/15">
                <div className="text-center">
                  <div className="text-[11px] text-slate-300 uppercase tracking-wider font-semibold">
                    Window Closing In
                  </div>
                  <div className="font-mono font-bold text-2xl text-amber-300 tabular-nums flex items-center justify-center gap-1.5 mt-0.5">
                    <Clock className="w-5 h-5 text-amber-400 animate-spin" style={{ animationDuration: '6s' }} />
                    <span>{formatRemaining(activeSession.remainingSeconds)}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 pl-3 border-l border-white/20">
                  <button
                    onClick={() => extendSession(120)}
                    className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded text-xs font-medium transition-colors cursor-pointer"
                    title="Add 2 more minutes to session"
                  >
                    +2 Mins
                  </button>
                  <button
                    onClick={endSession}
                    className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                  >
                    Close Session
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => startSession(selectedPeriod)}
                className="px-5 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer"
              >
                <Clock className="w-5 h-5" />
                <span>Enable Attendance (Start 5-Min Window)</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 block">Total Enrolled</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums">{totalCount}</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Class strength</span>
        </div>

        <div className="bg-white rounded-xl border border-emerald-200 p-4 shadow-xs">
          <span className="text-xs font-semibold text-emerald-800 block">Verified Present</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold font-mono text-emerald-600 tabular-nums">{presentCount}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <span className="text-[11px] text-emerald-700 mt-1 block">Facial recognition</span>
        </div>

        <div className="bg-white rounded-xl border border-purple-200 p-4 shadow-xs">
          <span className="text-xs font-semibold text-purple-800 block">Manual Overrides</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold font-mono text-purple-600 tabular-nums">{overrideCount}</span>
            <UserCheck className="w-4 h-4 text-purple-500" />
          </div>
          <span className="text-[11px] text-purple-700 mt-1 block">Teacher reviewed</span>
        </div>

        <div className="bg-white rounded-xl border border-rose-200 p-4 shadow-xs">
          <span className="text-xs font-semibold text-rose-800 block">Failed / Flagged</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold font-mono text-rose-600 tabular-nums">{failedCount}</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <span className="text-[11px] text-rose-700 mt-1 block">Wi-Fi or face mismatch</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 block">Not Checked In</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold font-mono text-slate-600 tabular-nums">{absentCount}</span>
            <XCircle className="w-4 h-4 text-slate-400" />
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Rate: {attendanceRate}%</span>
        </div>
      </div>

      {/* Class Attendance & Facial Verification Roster */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        {/* Table Controls Bar */}
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative max-w-sm w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by student name, PRN, or roll #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0B2545] focus:outline-hidden"
            />
          </div>

          {/* Segmented Filter Buttons */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                statusFilter === 'ALL'
                  ? 'bg-[#0B2545] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All ({studentRows.length})
            </button>
            <button
              onClick={() => setStatusFilter('PRESENT')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                statusFilter === 'PRESENT'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              Present ({presentCount})
            </button>
            <button
              onClick={() => setStatusFilter('FAILED')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                statusFilter === 'FAILED'
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
              }`}
            >
              Failed ({failedCount})
            </button>
            <button
              onClick={() => setStatusFilter('OVERRIDE')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                statusFilter === 'OVERRIDE'
                  ? 'bg-purple-600 text-white'
                  : 'bg-purple-50 text-purple-800 hover:bg-purple-100'
              }`}
            >
              Overrides ({overrideCount})
            </button>
            <button
              onClick={() => setStatusFilter('ABSENT')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                statusFilter === 'ABSENT'
                  ? 'bg-slate-700 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Pending ({absentCount})
            </button>
          </div>
        </div>

        {/* Dense Roster Table */}
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0 z-10 font-semibold">
              <tr>
                <th className="py-2.5 px-4 w-12 text-center">#</th>
                <th className="py-2.5 px-4">Student Name & PRN</th>
                <th className="py-2.5 px-3">Face Biometric Status</th>
                <th className="py-2.5 px-3">Attendance Status</th>
                <th className="py-2.5 px-3">Time</th>
                <th className="py-2.5 px-3">Method</th>
                <th className="py-2.5 px-3 text-right">Match %</th>
                <th className="py-2.5 px-4 text-center">Faculty Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <div className="max-w-sm mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                        <UserCheck className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">
                          {students.length === 0 ? 'No Students in Roster' : 'No matching students'}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {students.length === 0
                            ? 'Register students or use the pre-added student accounts.'
                            : 'Try adjusting your search query or filter.'}
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRows.map(({ student, record, status, method, time, matchScore, notes }) => (
                  <tr key={student.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Roll No */}
                    <td className="py-2.5 px-4 text-center font-mono text-slate-500 tabular-nums">
                      {student.rollNo}
                    </td>

                    {/* Student Info */}
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden ring-1 ring-slate-300 shrink-0">
                          {student.photoDataUrl ? (
                            <img src={student.photoDataUrl} alt="Student" className="w-full h-full object-cover" />
                          ) : (
                            <img src={student.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                          )}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-900 block">{student.name}</span>
                          <span className="font-mono text-[10px] text-slate-500">{student.prn}</span>
                        </div>
                      </div>
                    </td>

                    {/* Biometric Enrollment */}
                    <td className="py-2.5 px-3">
                      {student.isFaceEnrolled ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Face Verified</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          <span>Pending First Login</span>
                        </span>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="py-2.5 px-3">
                      {status === 'PRESENT' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Present
                        </span>
                      )}
                      {status === 'MANUAL_OVERRIDE' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-100 text-purple-800" title={notes}>
                          <UserCheck className="w-3 h-3 text-purple-600" />
                          Override
                        </span>
                      )}
                      {status === 'VERIFICATION_FAILED' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-100 text-rose-800" title={notes}>
                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                          Failed
                        </span>
                      )}
                      {status === 'ABSENT' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-600">
                          Pending
                        </span>
                      )}
                    </td>

                    {/* Check In Time */}
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700 tabular-nums">
                      {time}
                    </td>

                    {/* Method */}
                    <td className="py-2.5 px-3 text-[11px] text-slate-600">
                      {method === 'FACIAL_RECOGNITION' && 'Facial AI (Auto)'}
                      {method === 'MANUAL_FACULTY_OVERRIDE' && 'Manual Review'}
                      {method === 'FACIAL_RETRY' && 'Rejected Attempt'}
                      {method === 'UNRECORDED' && '—'}
                    </td>

                    {/* Match % */}
                    <td className="py-2.5 px-3 text-right font-mono text-[11px] tabular-nums font-semibold">
                      {matchScore > 0 ? (
                        <span className={matchScore >= 80 ? 'text-emerald-700' : 'text-rose-600'}>
                          {matchScore}%
                        </span>
                      ) : (
                        <span className="text-slate-400 font-normal">—</span>
                      )}
                    </td>

                    {/* Faculty Action */}
                    <td className="py-2.5 px-4 text-center">
                      {status !== 'PRESENT' ? (
                        <button
                          onClick={() => {
                            setOverrideStudentPrn(student.prn);
                            setOverrideReason('VISUAL_IDENTITY_VERIFIED');
                          }}
                          className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-[#0B2545] hover:text-white text-slate-700 rounded transition-colors cursor-pointer border border-slate-300"
                        >
                          Manual Verify
                        </button>
                      ) : (
                        <span className="text-[10px] text-emerald-600 font-medium">Verified</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Override Dialog */}
      {overrideStudentPrn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2 text-purple-700">
                <UserCheck className="w-5 h-5" />
                <h3 className="font-display font-bold text-base text-slate-900">
                  Manual Faculty Verification
                </h3>
              </div>
              <button
                onClick={() => setOverrideStudentPrn(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {/* Student Info */}
            {(() => {
              const target = students.find((s) => s.prn === overrideStudentPrn);
              return target ? (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Student:</span>
                    <span className="font-bold text-slate-800">{target.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">PRN / Roll:</span>
                    <span className="font-mono text-slate-700">{target.prn} (#{target.rollNo})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Course & Period:</span>
                    <span className="text-slate-700">Period {selectedPeriod}: {currentPeriodInfo.subjectCode}</span>
                  </div>
                </div>
              ) : null;
            })()}

            {/* Reason selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Official Override Reason (Required for Audit Trail)
              </label>
              <select
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value as OverrideReason)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-2 focus:ring-[#0B2545] focus:outline-hidden bg-white"
              >
                <option value="VISUAL_IDENTITY_VERIFIED">
                  Visual Identity Verified (Physical Presence in Classroom Confirmed)
                </option>
                <option value="APPROVED_DEVICE_CAMERA_GLITCH">
                  Approved Device Camera Glitch / Lens Optical Defect
                </option>
                <option value="LIGHTING_FAILED_IN_CLASSROOM">
                  Lighting Contrast Failed in Classroom Corner
                </option>
                <option value="NETWORK_HANDOFF_FAILURE">
                  Campus Wi-Fi Access Point Reconnection Drop
                </option>
                <option value="MEDICAL_OR_SPECIAL_EXCUSE">
                  Medical / Official College Duty Excuse
                </option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Optional Notes
              </label>
              <input
                type="text"
                placeholder="e.g. Student presented physical ID card to Dr. K. Narayanan"
                value={overrideNote}
                onChange={(e) => setOverrideNote(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-2 focus:ring-[#0B2545] focus:outline-hidden"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setOverrideStudentPrn(null)}
                className="w-1/3 py-2 text-xs font-semibold text-slate-600 border border-slate-300 rounded-md hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmOverride}
                className="w-2/3 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-md shadow-xs transition-colors cursor-pointer"
              >
                Approve & Mark Present
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Trail Drawer Modal */}
      {showAuditDrawer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2 text-slate-900">
                <ShieldAlert className="w-5 h-5 text-amber-600" />
                <h3 className="font-display font-bold text-base">
                  Faculty Manual Verification Audit Trail
                </h3>
              </div>
              <button
                onClick={() => setShowAuditDrawer(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Complete tamper-evident log of all manual overrides submitted by instructors for transparency and college audit compliance.
            </p>

            <div className="overflow-y-auto space-y-2.5 flex-1 pr-1">
              {auditLogs.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  No manual overrides recorded yet today.
                </div>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">
                        {log.studentName} ({log.studentPrn})
                      </span>
                      <span className="font-mono text-[10px] text-slate-500 tabular-nums">
                        Period {log.periodNumber} · {log.timestamp}
                      </span>
                    </div>
                    <div className="text-slate-600">
                      Instructor: <span className="font-medium text-slate-800">{log.teacherName}</span> ({log.teacherId})
                    </div>
                    <div className="text-slate-700">
                      Reason: <span className="font-semibold text-purple-700">{log.reason}</span>
                    </div>
                    {log.customNote && (
                      <div className="text-[11px] text-slate-500 italic mt-0.5">
                        "{log.customNote}"
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-slate-200">
              <button
                onClick={() => setShowAuditDrawer(false)}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-md"
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Biometric Proof & Roommate Differentiation Lab */}
      <BiometricProofLabModal
        isOpen={showProofLab}
        onClose={() => setShowProofLab(false)}
      />
    </div>
  );
};
