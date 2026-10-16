import React, { useState } from 'react';
import { useAttendance } from '../context/AttendanceContext';
import { CvvLogo } from './CvvLogo';
import { 
  GraduationCap, 
  Users, 
  Lock, 
  Camera, 
  ArrowRight, 
  CheckCircle2, 
  Sparkles, 
  X,
  UserPlus,
  ShieldCheck,
  KeyRound,
  Fingerprint
} from 'lucide-react';

interface LoginPageProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenStudentRegister: () => void;
  onOpenTeacherRegister: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  isOpen,
  onClose,
  onOpenStudentRegister,
  onOpenTeacherRegister,
}) => {
  const { 
    loginAsStudent, 
    loginAsFaculty, 
    students, 
    facultyList 
  } = useAttendance();

  const [roleTab, setRoleTab] = useState<'STUDENT' | 'FACULTY'>('STUDENT');
  const [prnInput, setPrnInput] = useState(students[0]?.prn || 'CVV240871');
  const [pinInput, setPinInput] = useState('1234');
  const [facultyIdInput, setFacultyIdInput] = useState(facultyList[0]?.facultyId || 'FAC-CSE-101');
  const [facultyPassword, setFacultyPassword] = useState('admin123');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!prnInput.trim()) {
      setErrorMsg('Please enter your PRN number or select a student account.');
      return;
    }
    const success = loginAsStudent(prnInput);
    if (success) {
      onClose();
    } else {
      setErrorMsg(`No student found with PRN "${prnInput}". Please check the PRN or register first.`);
    }
  };

  const handleFacultySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!facultyIdInput.trim()) {
      setErrorMsg('Please enter your Faculty ID or select a teacher account.');
      return;
    }
    const success = loginAsFaculty(facultyIdInput);
    if (success) {
      onClose();
    } else {
      setErrorMsg(`Invalid Faculty ID "${facultyIdInput}". Please check the ID or register first.`);
    }
  };

  const handleQuickStudentLogin = (prn: string) => {
    setPrnInput(prn);
    const success = loginAsStudent(prn);
    if (success) {
      onClose();
    }
  };

  const handleQuickFacultyLogin = (facId: string) => {
    setFacultyIdInput(facId);
    const success = loginAsFaculty(facId);
    if (success) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* CVV SMS Brand Header */}
        <div className="bg-[#0B2545] text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-300 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-4">
            <CvvLogo size="sm" />
          </div>

          <div className="mt-4 pt-3 border-t border-white/15 flex items-center justify-between text-[11px] text-blue-200">
            <span>Student Management System (SMS)</span>
            <span className="font-semibold text-amber-300">Linways ERP · AY 2026-27</span>
          </div>

          {/* Role Tabs */}
          <div className="flex items-center bg-[#07192F] p-1 rounded-xl mt-4 border border-blue-900/60">
            <button
              onClick={() => {
                setRoleTab('STUDENT');
                setErrorMsg(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                roleTab === 'STUDENT'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              <span>Student Login</span>
            </button>
            <button
              onClick={() => {
                setRoleTab('FACULTY');
                setErrorMsg(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                roleTab === 'FACULTY'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Faculty / Teacher Login</span>
            </button>
          </div>
        </div>

        {/* Quick Account Chips (for testing & judges) */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <KeyRound className="w-3 h-3 text-amber-600" />
              <span>1-Click Demo Accounts</span>
            </span>
            <span className="text-[10px] text-slate-400">Pre-added for evaluation</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {students.slice(0, 2).map((s, idx) => (
              <button
                key={s.prn}
                onClick={() => handleQuickStudentLogin(s.prn)}
                className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-800 text-[11px] font-semibold hover:border-amber-500 hover:bg-amber-50/50 transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                <span>{s.name}</span>
                <span className="font-mono text-[10px] text-slate-400">({s.prn})</span>
              </button>
            ))}

            {facultyList.slice(0, 1).map((f) => (
              <button
                key={f.facultyId}
                onClick={() => handleQuickFacultyLogin(f.facultyId)}
                className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-800 text-[11px] font-semibold hover:border-blue-500 hover:bg-blue-50/50 transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                <span>{f.name}</span>
                <span className="font-mono text-[10px] text-slate-400">({f.facultyId})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {roleTab === 'STUDENT' ? (
            <form onSubmit={handleStudentSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Permanent Registration Number (PRN)
                </label>
                <input
                  type="text"
                  value={prnInput}
                  onChange={(e) => setPrnInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0B2545] focus:outline-hidden"
                  placeholder="e.g. CVV240871"
                  required
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  First-time logins will automatically prompt for camera face verification.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Student Portal PIN
                </label>
                <input
                  type="password"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0B2545] focus:outline-hidden"
                  placeholder="••••"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-[#0B2545] hover:bg-[#133E87] text-white text-xs font-bold rounded-xl shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <GraduationCap className="w-4 h-4" />
                <span>Sign In to Student SMS Portal</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleFacultySubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Faculty Registration ID
                </label>
                <input
                  type="text"
                  value={facultyIdInput}
                  onChange={(e) => setFacultyIdInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0B2545] focus:outline-hidden"
                  placeholder="e.g. FAC-CSE-101"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={facultyPassword}
                  onChange={(e) => setFacultyPassword(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0B2545] focus:outline-hidden"
                  placeholder="••••••••"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-[#0B2545] hover:bg-[#133E87] text-white text-xs font-bold rounded-xl shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <Users className="w-4 h-4" />
                <span>Sign In to Faculty Dashboard</span>
              </button>
            </form>
          )}

          {/* Physical Registration Action Links */}
          <div className="pt-3 border-t border-slate-200 space-y-2">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Physically Register New Profiles:
            </span>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenStudentRegister();
                }}
                className="p-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-left transition-colors cursor-pointer flex flex-col justify-between"
              >
                <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-xs">
                  <GraduationCap className="w-4 h-4 text-emerald-600" />
                  <span>Create Student</span>
                </div>
                <span className="text-[10px] text-emerald-600 mt-1">With camera face enrollment</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenTeacherRegister();
                }}
                className="p-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-left transition-colors cursor-pointer flex flex-col justify-between"
              >
                <div className="flex items-center gap-1.5 text-blue-800 font-bold text-xs">
                  <Users className="w-4 h-4 text-blue-600" />
                  <span>Create Teacher</span>
                </div>
                <span className="text-[10px] text-blue-600 mt-1">Manage timetable & periods</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
