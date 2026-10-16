import React, { useState } from 'react';
import { useAttendance } from '../context/AttendanceContext';
import { 
  Zap, 
  ChevronUp, 
  ChevronDown, 
  Users, 
  GraduationCap, 
  Clock, 
  Wifi, 
  WifiOff, 
  Scan, 
  RotateCcw,
  Sparkles,
  Database
} from 'lucide-react';

interface QuickDemoBarProps {
  onOpenProofLab: () => void;
  onOpenWifiConfig?: () => void;
  onOpenStudentDatabase?: () => void;
}

export const QuickDemoBar: React.FC<QuickDemoBarProps> = ({
  onOpenProofLab,
  onOpenWifiConfig,
  onOpenStudentDatabase,
}) => {
  const {
    students,
    facultyList,
    currentUser,
    loginAsStudent,
    loginAsFaculty,
    logout,
    activeSession,
    startSession,
    endSession,
    networkConfig,
    toggleNetworkMode,
    resetFaceEnrollments,
    lockCurrentAsBaseWifi,
  } = useAttendance();

  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <aside
      aria-label="Evaluation Tools"
      className="fixed bottom-4 right-4 z-40 max-w-sm sm:max-w-md w-full px-2 pointer-events-none"
    >
      <div className="bg-slate-900/95 backdrop-blur-md text-white rounded-2xl shadow-2xl border border-slate-700/80 overflow-hidden pointer-events-auto transition-all duration-200">
        {/* Header Toggle */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-bold text-amber-400 hover:text-amber-300 hover:bg-slate-800/50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
            </span>
            <span className="text-white">Quick Demo & Evaluator Toolbar</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
              1-Click Test
            </span>
          </div>
          <div className="flex items-center gap-1 text-slate-400">
            <span className="text-[10px] hidden sm:inline">{isExpanded ? 'Collapse' : 'Expand'}</span>
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </div>
        </button>

        {/* Expandable Controls */}
        {isExpanded && (
          <div className="p-4 space-y-3.5 border-t border-slate-800 text-xs">
            {/* Quick Switch Profiles */}
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1.5">
                Fast-Switch Account:
              </span>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                {students.map((st) => {
                  const isCurrent = currentUser?.student?.prn.toUpperCase() === st.prn.toUpperCase();
                  return (
                    <button
                      key={st.prn}
                      onClick={() => loginAsStudent(st.prn)}
                      className={`px-2.5 py-1.5 rounded-lg font-semibold truncate transition-colors cursor-pointer text-center text-[11px] shrink-0 ${
                        isCurrent
                          ? 'bg-amber-600 text-white font-bold ring-2 ring-amber-400'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                      title={`${st.name} (${st.prn}) - ${st.isFaceEnrolled ? 'Face Enrolled' : 'Needs Face Enrollment'}`}
                    >
                      {st.name.split(' ')[0]} ({st.prn.slice(-4)})
                    </button>
                  );
                })}
                <button
                  onClick={() => loginAsFaculty(facultyList[0]?.facultyId || 'FAC-CSE-101')}
                  className={`px-2.5 py-1.5 rounded-lg font-semibold truncate transition-colors cursor-pointer text-center text-[11px] shrink-0 ${
                    currentUser?.role === 'faculty'
                      ? 'bg-blue-600 text-white font-bold ring-2 ring-blue-400'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                  title="Dr. Narayanan (Faculty)"
                >
                  Faculty (Teacher)
                </button>
              </div>
            </div>

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
              {/* Session Trigger */}
              {activeSession && activeSession.isActive ? (
                <button
                  onClick={endSession}
                  className="px-2.5 py-1.5 bg-rose-950/80 hover:bg-rose-900 border border-rose-600/40 text-rose-200 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Clock className="w-3.5 h-3.5 text-rose-400" />
                  <span>Close Attendance</span>
                </button>
              ) : (
                <button
                  onClick={() => startSession(1)}
                  className="px-2.5 py-1.5 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-600/40 text-emerald-200 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Start 5m Period 1</span>
                </button>
              )}

              {/* Wi-Fi Toggle */}
              <button
                onClick={() => toggleNetworkMode(!networkConfig.isClassroomWifiConnected)}
                className={`px-2.5 py-1.5 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer flex items-center justify-center gap-1.5 border ${
                  networkConfig.isClassroomWifiConnected
                    ? 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-200'
                    : 'bg-emerald-950/80 hover:bg-emerald-900 border-emerald-500/50 text-emerald-200'
                }`}
              >
                {networkConfig.isClassroomWifiConnected ? (
                  <>
                    <WifiOff className="w-3.5 h-3.5 text-rose-400" />
                    <span>Test Switched IP</span>
                  </>
                ) : (
                  <>
                    <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Restore Base Wi-Fi</span>
                  </>
                )}
              </button>
            </div>

            {/* Quick 1-Click Wi-Fi Lock to User's Active Connection */}
            <button
              onClick={() => lockCurrentAsBaseWifi()}
              className="w-full px-2.5 py-1.5 bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-200 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              title="Locks attendance strictly to your currently active Wi-Fi IP so no other network can give attendance"
            >
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              <span>Lock Attendance to My Current Wi-Fi ({networkConfig.currentIp || 'Active'})</span>
            </button>

            {/* Student Database, Proof Lab & Reset */}
            <div className="space-y-1.5 pt-1 border-t border-slate-800">
              {onOpenStudentDatabase && (
                <button
                  onClick={onOpenStudentDatabase}
                  className="w-full px-2.5 py-1.5 bg-blue-950/90 hover:bg-blue-900 border border-blue-500/40 text-blue-200 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                >
                  <Database className="w-3.5 h-3.5 text-amber-400" />
                  <span>Student & Faces Database ({students.length})</span>
                </button>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={onOpenProofLab}
                  className="px-2.5 py-1.5 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-500/40 text-indigo-200 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Scan className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Roommate Proof Lab</span>
                </button>

                <button
                  onClick={resetFaceEnrollments}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  title="Clears enrolled faces so you can test registration again"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                  <span>Reset Face Enrolls</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
