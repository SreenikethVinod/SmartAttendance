/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AttendanceProvider, useAttendance } from './context/AttendanceContext';
import { Navbar } from './components/Navbar';
import { FacultyDashboard } from './components/FacultyDashboard';
import { StudentPortal } from './components/StudentPortal';
import { StudentRegisterModal } from './components/StudentRegisterModal';
import { TeacherRegisterModal } from './components/TeacherRegisterModal';
import { WifiConfigModal } from './components/WifiConfigModal';
import { QuickDemoBar } from './components/QuickDemoBar';
import { BiometricProofLabModal } from './components/BiometricProofLabModal';
import { StudentDatabaseModal } from './components/StudentDatabaseModal';
import { CvvLogo } from './components/CvvLogo';
import { 
  GraduationCap, 
  Users, 
  KeyRound,
  ArrowRight,
  Database
} from 'lucide-react';

function AppContent() {
  const { 
    currentUser, 
    students, 
    facultyList, 
    loginAsFaculty, 
    loginAsStudent
  } = useAttendance();

  const [isStudentRegisterOpen, setIsStudentRegisterOpen] = useState(false);
  const [isTeacherRegisterOpen, setIsTeacherRegisterOpen] = useState(false);
  const [isWifiConfigOpen, setIsWifiConfigOpen] = useState(false);
  const [isProofLabOpen, setIsProofLabOpen] = useState(false);
  const [isStudentDatabaseOpen, setIsStudentDatabaseOpen] = useState(false);

  // In-page portal login state
  const [roleTab, setRoleTab] = useState<'STUDENT' | 'FACULTY'>('STUDENT');
  const [prnInput, setPrnInput] = useState(students[0]?.prn || 'CVV240871');
  const [pinInput, setPinInput] = useState('1234');
  const [facultyIdInput, setFacultyIdInput] = useState(facultyList[0]?.facultyId || 'FAC-CSE-101');
  const [facultyPassword, setFacultyPassword] = useState('admin123');
  const [loginError, setLoginError] = useState<string | null>(null);

  const handlePageStudentLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (!prnInput.trim()) {
      setLoginError('Please enter your PRN');
      return;
    }
    const ok = loginAsStudent(prnInput);
    if (!ok) {
      setLoginError(`No student registered with PRN "${prnInput}".`);
    }
  };

  const handlePageFacultyLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (!facultyIdInput.trim()) {
      setLoginError('Please enter your Faculty ID');
      return;
    }
    const ok = loginAsFaculty(facultyIdInput);
    if (!ok) {
      setLoginError(`Invalid Faculty ID "${facultyIdInput}".`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans selection:bg-[#0B2545] selection:text-white">
      {/* Top Navigation: Clean & minimal without Register/Sign-In buttons; Wi-Fi only appears when logged in */}
      <Navbar
        onOpenWifiConfig={() => setIsWifiConfigOpen(true)}
        onOpenStudentDatabase={() => setIsStudentDatabaseOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col justify-center">
        {currentUser?.role === 'faculty' && (
          <div className="py-6 flex-1">
            <FacultyDashboard 
              onOpenStudentRegister={() => setIsStudentRegisterOpen(true)} 
              onOpenWifiConfig={() => setIsWifiConfigOpen(true)}
              onOpenStudentDatabase={() => setIsStudentDatabaseOpen(true)}
            />
          </div>
        )}

        {currentUser?.role === 'student' && (
          <div className="py-6 flex-1">
            <StudentPortal 
              onOpenStudentRegister={() => setIsStudentRegisterOpen(true)} 
              onOpenWifiConfig={() => setIsWifiConfigOpen(true)}
              onOpenStudentDatabase={() => setIsStudentDatabaseOpen(true)}
            />
          </div>
        )}

        {/* Minimal Official CVV SMS Login Portal (No Timetable, No Wi-Fi on Login) */}
        {!currentUser && (
          <div className="w-full max-w-md mx-auto px-4 py-8 sm:py-12 my-auto">
            {/* Minimal Linways Institutional Login Card */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-lg overflow-hidden">
              {/* Institutional Header Banner */}
              <div className="bg-[#0B2545] text-white p-6 text-center flex flex-col items-center border-b border-blue-900">
                <CvvLogo size="md" />
                <div className="mt-4 pt-3 border-t border-white/15 w-full flex items-center justify-between text-[11px]">
                  <span className="text-amber-300 font-bold uppercase tracking-wider">
                    Student Management System (SMS)
                  </span>
                  <span className="text-blue-200">
                    Linways ERP
                  </span>
                </div>
              </div>

              {/* Role Toggle Switcher */}
              <div className="p-4 bg-slate-50 border-b border-slate-200">
                <div className="grid grid-cols-2 gap-1 bg-slate-200/80 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setRoleTab('STUDENT');
                      setLoginError(null);
                    }}
                    className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      roleTab === 'STUDENT'
                        ? 'bg-[#0B2545] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <GraduationCap className="w-4 h-4" />
                    <span>Student Login</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRoleTab('FACULTY');
                      setLoginError(null);
                    }}
                    className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      roleTab === 'FACULTY'
                        ? 'bg-[#0B2545] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    <span>Faculty Login</span>
                  </button>
                </div>
              </div>

              {/* Form Body */}
              <div className="p-6">
                {loginError && (
                  <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-medium">
                    {loginError}
                  </div>
                )}

                {roleTab === 'STUDENT' ? (
                  <form onSubmit={handlePageStudentLogin} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Admission No. / PRN
                      </label>
                      <input
                        type="text"
                        value={prnInput}
                        onChange={(e) => setPrnInput(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-xs font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#0B2545] focus:outline-hidden bg-white"
                        placeholder="e.g. CVV240871"
                        required
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-slate-700">
                          Password / PIN
                        </label>
                        <span className="text-[11px] text-slate-400 hover:text-slate-600 cursor-pointer">
                          Forgot Password?
                        </span>
                      </div>
                      <input
                        type="password"
                        value={pinInput}
                        onChange={(e) => setPinInput(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#0B2545] focus:outline-hidden bg-white"
                        placeholder="••••"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 px-4 bg-[#0B2545] hover:bg-[#133E87] text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 mt-2"
                    >
                      <GraduationCap className="w-4 h-4" />
                      <span>Sign In to Student SMS</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handlePageFacultyLogin} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Faculty ID / Username
                      </label>
                      <input
                        type="text"
                        value={facultyIdInput}
                        onChange={(e) => setFacultyIdInput(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-xs font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#0B2545] focus:outline-hidden bg-white"
                        placeholder="e.g. FAC-CSE-101"
                        required
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-slate-700">
                          Faculty Password
                        </label>
                        <span className="text-[11px] text-slate-400 hover:text-slate-600 cursor-pointer">
                          Reset PIN
                        </span>
                      </div>
                      <input
                        type="password"
                        value={facultyPassword}
                        onChange={(e) => setFacultyPassword(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#0B2545] focus:outline-hidden bg-white"
                        placeholder="••••••••"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 px-4 bg-[#0B2545] hover:bg-[#133E87] text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 mt-2"
                    >
                      <Users className="w-4 h-4" />
                      <span>Sign In to Faculty SMS</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </form>
                )}

                {/* Pre-Added Evaluation Accounts (1-Click) */}
                <div className="mt-6 pt-4 border-t border-slate-200">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2.5">
                    <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                    <span>Pre-Added Accounts (1-Click Test):</span>
                  </div>

                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {students.map((s) => (
                      <button
                        key={s.prn}
                        type="button"
                        onClick={() => loginAsStudent(s.prn)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-50 hover:bg-amber-50/50 border border-slate-200 hover:border-amber-300 text-left transition-colors cursor-pointer flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${s.isFaceEnrolled ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                          <span className="font-semibold text-slate-800">{s.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">({s.prn})</span>
                        </div>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${s.isFaceEnrolled ? 'text-emerald-700 bg-emerald-100/80' : 'text-amber-700 bg-amber-100/80'}`}>
                          {s.isFaceEnrolled ? 'Face Enrolled' : 'First-Time (Needs Face)'}
                        </span>
                      </button>
                    ))}

                    {facultyList.slice(0, 1).map((f) => (
                      <button
                        key={f.facultyId}
                        type="button"
                        onClick={() => loginAsFaculty(f.facultyId)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-50 hover:bg-blue-50/50 border border-slate-200 hover:border-blue-300 text-left transition-colors cursor-pointer flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                          <span className="font-semibold text-slate-800">{f.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">({f.facultyId})</span>
                        </div>
                        <span className="text-[10px] font-semibold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-full">
                          Teacher
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Student & Faces Database Launcher Button */}
                  <button
                    type="button"
                    onClick={() => setIsStudentDatabaseOpen(true)}
                    className="w-full mt-3 py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200/80 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                  >
                    <Database className="w-4 h-4 text-amber-600" />
                    <span>Manage Student & Faces Database ({students.length} Profiles)</span>
                  </button>
                </div>
              </div>

              {/* Minimal Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
                <span className="text-[11px] text-slate-500">Need to create a profile?</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsStudentRegisterOpen(true)}
                    className="text-emerald-700 hover:text-emerald-800 font-bold underline cursor-pointer"
                  >
                    + Register Student
                  </button>
                  <span className="text-slate-300">·</span>
                  <button
                    type="button"
                    onClick={() => setIsTeacherRegisterOpen(true)}
                    className="text-[#0B2545] hover:underline font-bold cursor-pointer"
                  >
                    + Register Teacher
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Institutional Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Chinmaya Vishwa Vidyapeeth</span>
            <span>·</span>
            <span>Deemed to be University</span>
            <span>·</span>
            <span>Department of CSE</span>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <span>Linways SMS Portal</span>
            <span>·</span>
            <span>Academic Year 2026–27</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <StudentRegisterModal
        isOpen={isStudentRegisterOpen}
        onClose={() => setIsStudentRegisterOpen(false)}
      />

      <TeacherRegisterModal
        isOpen={isTeacherRegisterOpen}
        onClose={() => setIsTeacherRegisterOpen(false)}
      />

      <WifiConfigModal
        isOpen={isWifiConfigOpen}
        onClose={() => setIsWifiConfigOpen(false)}
      />

      <BiometricProofLabModal
        isOpen={isProofLabOpen}
        onClose={() => setIsProofLabOpen(false)}
      />

      <StudentDatabaseModal
        isOpen={isStudentDatabaseOpen}
        onClose={() => setIsStudentDatabaseOpen(false)}
      />

      {/* Floating 1-Click Evaluator Toolbar */}
      <QuickDemoBar
        onOpenProofLab={() => setIsProofLabOpen(true)}
        onOpenWifiConfig={() => setIsWifiConfigOpen(true)}
        onOpenStudentDatabase={() => setIsStudentDatabaseOpen(true)}
      />
    </div>
  );
}

export function App() {
  return (
    <AttendanceProvider>
      <AppContent />
    </AttendanceProvider>
  );
}

export default App;
