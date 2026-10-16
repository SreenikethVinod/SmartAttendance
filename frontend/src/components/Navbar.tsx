import React from 'react';
import { useAttendance } from '../context/AttendanceContext';
import { 
  Wifi, 
  WifiOff, 
  Clock, 
  User, 
  LogOut,
  Database
} from 'lucide-react';

import { CvvLogo } from './CvvLogo';

interface NavbarProps {
  onOpenLogin?: () => void;
  onOpenStudentRegister?: () => void;
  onOpenTeacherRegister?: () => void;
  onOpenWifiConfig?: () => void;
  onOpenStudentDatabase?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ 
  onOpenWifiConfig,
  onOpenStudentDatabase
}) => {
  const { 
    students,
    currentUser, 
    logout, 
    activeSession, 
    networkConfig 
  } = useAttendance();

  const formatRemaining = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <header className="sticky top-0 z-40 bg-[#0B2545] text-white shadow-md border-b border-[#133E87]">
      {/* Top institutional strip */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Brand Wordmark & University Crest */}
          <div className="flex items-center gap-3 shrink-0">
            <CvvLogo size="sm" />
          </div>

          {/* Center: Live Session & Wi-Fi Network Monitor (Only in Main Dashboard when Logged In) */}
          {currentUser && (
            <div className="hidden lg:flex items-center gap-3">
              {/* Active Session Pill */}
              {activeSession && activeSession.isActive && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#133E87]/80 border border-blue-400/30 text-xs">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-medium text-slate-200">
                    Period {activeSession.periodNumber}: {activeSession.subjectCode}
                  </span>
                  <span className="text-blue-300">·</span>
                  <span className="font-mono font-bold text-amber-300 tabular-nums flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 inline text-amber-300" />
                    {formatRemaining(activeSession.remainingSeconds)}
                  </span>
                </div>
              )}

              {/* Real Network Restriction Monitor Button */}
              {onOpenWifiConfig && (
                <button
                  onClick={onOpenWifiConfig}
                  title="Click to view live IP, lock current Wi-Fi as base, or test network mismatch"
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                    networkConfig.isClassroomWifiConnected
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/50'
                      : 'bg-rose-950/40 border-rose-500/40 text-rose-300 hover:bg-rose-900/50'
                  }`}
                >
                  {networkConfig.isClassroomWifiConnected ? (
                    <>
                      <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Wi-Fi: {networkConfig.currentIp}</span>
                      <span className="text-[10px] text-emerald-400/80 font-mono">(Authorized)</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-3.5 h-3.5 text-rose-400" />
                      <span>Switched: {networkConfig.currentIp}</span>
                      <span className="text-[10px] text-rose-400/80 font-mono">(Blocked)</span>
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Right Actions: Authenticated User Profile & Sign Out Only */}
          <div className="flex items-center gap-2.5 shrink-0">
            {onOpenStudentDatabase && (
              <button
                onClick={onOpenStudentDatabase}
                title="Open Student & Faces Database"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-blue-400/40 bg-blue-600/30 hover:bg-blue-600/50 text-white transition-all cursor-pointer shadow-xs"
              >
                <Database className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Student Database</span>
                <span className="text-[10px] bg-blue-400/30 text-amber-300 px-1.5 py-0.2 rounded font-mono">
                  {students.length}
                </span>
              </button>
            )}

            {currentUser && (
              <div className="flex items-center gap-2 pl-2">
                <div className="flex flex-col text-right hidden sm:flex">
                  <span className="text-xs font-medium text-white truncate max-w-[150px]">
                    {currentUser.role === 'faculty' ? currentUser.faculty?.name : currentUser.student?.name}
                  </span>
                  <span className="text-[10px] text-slate-300 font-mono">
                    {currentUser.role === 'faculty' ? currentUser.faculty?.facultyId : currentUser.student?.prn}
                  </span>
                </div>

                <div className="w-8 h-8 rounded-full bg-slate-700 overflow-hidden ring-1 ring-white/20 flex items-center justify-center shrink-0">
                  {currentUser.role === 'student' && currentUser.student?.photoDataUrl ? (
                    <img 
                      src={currentUser.student.photoDataUrl} 
                      alt="Student Face" 
                      className="w-full h-full object-cover" 
                    />
                  ) : currentUser.role === 'student' && currentUser.student?.avatarUrl ? (
                    <img 
                      src={currentUser.student.avatarUrl} 
                      alt="Avatar" 
                      className="w-full h-full object-cover" 
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <User className="w-4 h-4 text-slate-300" />
                  )}
                </div>

                <button
                  onClick={logout}
                  className="p-1.5 text-slate-300 hover:text-white rounded hover:bg-white/10 transition-colors cursor-pointer"
                  title="Sign out of portal"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Sub-bar for mobile network indicator: Only shown when logged in */}
      {currentUser && onOpenWifiConfig && (
        <div className="lg:hidden bg-[#07192F] px-4 py-1.5 flex items-center justify-between text-[11px] border-t border-[#133E87]/40">
          <button
            onClick={onOpenWifiConfig}
            className="flex items-center gap-1.5 text-slate-300 cursor-pointer"
          >
            {networkConfig.isClassroomWifiConnected ? (
              <span className="text-emerald-400 flex items-center gap-1">
                <Wifi className="w-3 h-3" /> Wi-Fi: {networkConfig.currentIp} (Authorized)
              </span>
            ) : (
              <span className="text-rose-400 flex items-center gap-1">
                <WifiOff className="w-3 h-3" /> Switched: {networkConfig.currentIp} (Blocked)
              </span>
            )}
          </button>

          {activeSession && activeSession.isActive && (
            <span className="font-mono text-amber-300 font-medium">
              Period {activeSession.periodNumber} · {formatRemaining(activeSession.remainingSeconds)}
            </span>
          )}
        </div>
      )}
    </header>
  );
};
