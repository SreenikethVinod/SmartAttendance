import React, { useState } from 'react';
import { useAttendance } from '../context/AttendanceContext';
import { Users, X, UserPlus, BookOpen, CheckCircle2 } from 'lucide-react';

interface TeacherRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const TeacherRegisterModal: React.FC<TeacherRegisterModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { facultyList, timetable } = useAttendance();
  const { registerFaculty } = useAttendance() as any;

  const [fullName, setFullName] = useState('');
  const [facultyId, setFacultyId] = useState(`FAC-CSE-${100 + facultyList.length + 1}`);
  const [department, setDepartment] = useState('Computer Science & Engineering');
  const [designation, setDesignation] = useState('Professor & Course Instructor');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('admin123');
  const [selectedCourses, setSelectedCourses] = useState<string[]>([
    'CSE301: Computer Networks',
    'IKS201: Indian Knowledge Systems & Logic',
  ]);

  if (!isOpen) return null;

  const availableSubjects = Array.from(
    new Set(timetable.map((t) => `${t.subjectCode}: ${t.subjectName}`))
  );

  const toggleCourse = (c: string) => {
    setSelectedCourses((prev) =>
      prev.includes(c) ? prev.filter((item) => item !== c) : [...prev, c]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !facultyId.trim()) return;

    registerFaculty({
      name: fullName.trim(),
      facultyId: facultyId.trim().toUpperCase(),
      department,
      designation,
      email: email.trim() || `${fullName.toLowerCase().replace(/\s+/g, '.')}@cvv.ac.in`,
      password,
      courses: selectedCourses,
    });

    if (onSuccess) onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-[#0B2545] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-base text-white">
                Create Faculty Account
              </h3>
              <p className="text-xs text-slate-300">
                Register as a teacher to launch attendance sessions and manage rosters
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Teacher Full Name *
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-2 focus:ring-[#0B2545] focus:outline-hidden"
              placeholder="Enter faculty full name"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Faculty ID *
              </label>
              <input
                type="text"
                value={facultyId}
                onChange={(e) => setFacultyId(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-md focus:ring-2 focus:ring-[#0B2545] focus:outline-hidden"
                placeholder="FAC-CSE-101"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Designation
              </label>
              <input
                type="text"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-2 focus:ring-[#0B2545] focus:outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Department
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-2 focus:ring-[#0B2545] focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Portal Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-2 focus:ring-[#0B2545] focus:outline-hidden"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-2 focus:ring-[#0B2545] focus:outline-hidden"
              placeholder="faculty@cvv.ac.in"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Assigned Timetable Subjects (Click to Select)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-32 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-md">
              {availableSubjects.map((subject) => {
                const isSelected = selectedCourses.includes(subject);
                return (
                  <button
                    key={subject}
                    type="button"
                    onClick={() => toggleCourse(subject)}
                    className={`p-1.5 rounded text-[11px] text-left border transition-colors cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-[#0B2545] text-white border-[#0B2545]'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span className="truncate">{subject}</span>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 shrink-0 ml-1 text-amber-400" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={!fullName.trim() || !facultyId.trim()}
              className="w-full py-2.5 px-4 bg-[#0B2545] hover:bg-[#133E87] text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <UserPlus className="w-4 h-4" />
              <span>Create Faculty Profile & Open Dashboard</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
