import React, { useState } from 'react';
import { Student, TimetablePeriod, AttendanceRecord } from '../types/attendance';
import { 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Calendar, 
  Info, 
  ShieldCheck, 
  ChevronDown, 
  ChevronUp,
  Award,
  BookOpen
} from 'lucide-react';

interface AttendanceHealthCardProps {
  student: Student;
  timetable: TimetablePeriod[];
  records: AttendanceRecord[];
}

interface SubjectStat {
  code: string;
  name: string;
  attended: number;
  total: number;
  percentage: number;
  status: 'SAFE' | 'WARNING' | 'CRITICAL';
}

export const AttendanceHealthCard: React.FC<AttendanceHealthCardProps> = ({
  student,
  timetable,
  records,
}) => {
  const [showSubjectDetails, setShowSubjectDetails] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // Linways Academic Parameters
  const MIN_REQUIRED_PERCENT = 75.0;
  const totalSemesterClasses = 60;
  // Calculate attended count based on overall percentage
  const currentTotalClasses = 45;
  const attendedClasses = Math.round((student.overallAttendancePercentage / 100) * currentTotalClasses);
  const missedClasses = currentTotalClasses - attendedClasses;
  const currentPercentage = student.overallAttendancePercentage;

  // Margin calculation:
  // If % >= 75%: How many consecutive classes can be missed before falling below 75%?
  // (attended) / (currentTotal + x) >= 0.75  =>  currentTotal + x <= attended / 0.75  => x <= (attended / 0.75) - currentTotal
  let marginMessage = '';
  const isEligible = currentPercentage >= MIN_REQUIRED_PERCENT;

  if (isEligible) {
    const safeMisses = Math.max(0, Math.floor((attendedClasses / (MIN_REQUIRED_PERCENT / 100)) - currentTotalClasses));
    marginMessage = safeMisses > 0 
      ? `You can safely miss up to ${safeMisses} more ${safeMisses === 1 ? 'class' : 'classes'} and maintain >= 75% eligibility.`
      : `You are right at the 75% threshold. Any absence will drop your eligibility.`;
  } else {
    // If % < 75%: How many consecutive classes must be attended to reach 75%?
    // (attended + y) / (currentTotal + y) >= 0.75 => attended + y >= 0.75 * currentTotal + 0.75 * y => 0.25 * y >= 0.75 * currentTotal - attended
    const needed = Math.max(1, Math.ceil((0.75 * currentTotalClasses - attendedClasses) / 0.25));
    marginMessage = `You must attend the next ${needed} consecutive ${needed === 1 ? 'class' : 'classes'} without absence to restore your 75% exam eligibility.`;
  }

  // Subject-wise stats
  const subjectStats: SubjectStat[] = [
    { code: 'CSE301', name: 'Computer Networks', attended: 18, total: 20, percentage: 90.0, status: 'SAFE' },
    { code: 'MAT202', name: 'Discrete Mathematics', attended: 16, total: 20, percentage: 80.0, status: 'SAFE' },
    { code: 'CSE303', name: 'Database Management', attended: 17, total: 20, percentage: 85.0, status: 'SAFE' },
    { code: 'HSS102', name: 'Sanskrit & Indian Knowledge Systems', attended: 19, total: 20, percentage: 95.0, status: 'SAFE' },
    { code: 'CSE305', name: 'Operating Systems', attended: 15, total: 20, percentage: 75.0, status: 'WARNING' },
  ];

  // Generate 30-day simulated attendance record for current month
  const daysInMonth = 30;
  const currentDayIndex = 14; // Day 14 is today

  const dayCells = Array.from({ length: daysInMonth }, (_, i) => {
    const dayNum = i + 1;
    const isWeekend = (dayNum % 7 === 0) || (dayNum % 7 === 6);
    const isToday = dayNum === currentDayIndex;
    const isFuture = dayNum > currentDayIndex;

    let status: 'PRESENT' | 'ABSENT' | 'WEEKEND' | 'FUTURE' = 'PRESENT';
    if (isFuture) status = 'FUTURE';
    else if (isWeekend) status = 'WEEKEND';
    else if (dayNum === 4 || dayNum === 9) status = 'ABSENT'; // 2 simulated absences

    return {
      dayNum,
      isToday,
      status,
      dateLabel: `Oct ${dayNum}, 2026`,
      classesAttended: status === 'PRESENT' ? '7 of 7 periods' : status === 'ABSENT' ? '0 of 7 periods' : '--',
    };
  });

  return (
    <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
            <TrendingUp className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display font-bold text-base text-slate-900">
                Linways Academic Attendance Status & 75% Rule Monitor
              </h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                isEligible 
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                  : 'bg-rose-50 text-rose-800 border-rose-300'
              }`}>
                {isEligible ? 'EXAM ELIGIBLE' : 'DEBARMENT RISK'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Chinmaya Vishwa Vidyapeeth academic ordinance mandates minimum 75.0% aggregate attendance for semester exams.
            </p>
          </div>
        </div>

        <div className="text-right shrink-0">
          <span className="text-[11px] text-slate-400 block font-medium">Aggregate Percentage</span>
          <span className={`text-2xl font-bold font-mono tabular-nums ${
            isEligible ? 'text-emerald-700' : 'text-rose-700'
          }`}>
            {currentPercentage}%
          </span>
        </div>
      </div>

      {/* Progress Bar & Threshold Marker */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-600 font-medium">
            Classes Attended: <strong className="text-slate-900">{attendedClasses}</strong> / {currentTotalClasses}
          </span>
          <span className="font-mono text-[11px] text-amber-700 font-bold">
            Required: 75.0% Minimum
          </span>
        </div>

        <div className="relative w-full h-3.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              currentPercentage >= 85
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                : currentPercentage >= 75
                ? 'bg-gradient-to-r from-amber-500 to-emerald-500'
                : 'bg-gradient-to-r from-rose-500 to-amber-500'
            }`}
            style={{ width: `${Math.min(100, currentPercentage)}%` }}
          />
          {/* 75% Marker Line */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-rose-600 z-10"
            style={{ left: '75%' }}
            title="75% Exam Eligibility Cutoff"
          />
        </div>

        {/* Prediction / Safe Margin Callout */}
        <div className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs ${
          isEligible 
            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950' 
            : 'bg-rose-50/80 border-rose-200 text-rose-950'
        }`}>
          {isEligible ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span className="font-medium">{marginMessage}</span>
        </div>
      </div>

      {/* 30-Day Monthly Attendance Calendar Heatmap */}
      <div className="pt-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <Calendar className="w-4 h-4 text-amber-600" />
            <span>October 2026 Daily Attendance Record (AY 2026-27)</span>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> Present
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" /> Absent
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-slate-200 inline-block" /> Weekend / Off
            </span>
          </div>
        </div>

        <div className="grid grid-cols-10 sm:grid-cols-15 gap-1.5 p-3 bg-slate-50 rounded-xl border border-slate-200">
          {dayCells.map((day) => {
            const isSelected = selectedDay === day.dayNum;
            let bgClass = 'bg-slate-200 text-slate-400';
            if (day.status === 'PRESENT') bgClass = 'bg-emerald-500 text-white font-bold hover:bg-emerald-600';
            else if (day.status === 'ABSENT') bgClass = 'bg-rose-500 text-white font-bold hover:bg-rose-600';
            else if (day.status === 'FUTURE') bgClass = 'bg-slate-100 text-slate-300 border border-dashed border-slate-200';

            return (
              <button
                key={day.dayNum}
                onClick={() => setSelectedDay(isSelected ? null : day.dayNum)}
                className={`h-8 rounded-lg text-[10px] flex flex-col items-center justify-center transition-all cursor-pointer relative ${bgClass} ${
                  day.isToday ? 'ring-2 ring-amber-500 ring-offset-1' : ''
                } ${isSelected ? 'scale-110 shadow-md z-10' : ''}`}
                title={`${day.dateLabel}: ${day.classesAttended}`}
              >
                <span>{day.dayNum}</span>
              </button>
            );
          })}
        </div>

        {selectedDay && (
          <div className="mt-2 p-2.5 bg-blue-50/80 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-center justify-between animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                <strong>October {selectedDay}, 2026</strong>: {
                  dayCells[selectedDay - 1]?.status === 'PRESENT'
                    ? 'All 7 periods attended & verified via Facial Recognition'
                    : dayCells[selectedDay - 1]?.status === 'ABSENT'
                    ? 'Unexcused Absence (0 of 7 periods)'
                    : dayCells[selectedDay - 1]?.status === 'WEEKEND'
                    ? 'Campus Holiday / Sunday'
                    : 'Upcoming scheduled academic day'
                }
              </span>
            </div>
            <button
              onClick={() => setSelectedDay(null)}
              className="text-blue-500 hover:text-blue-800 text-[10px] underline font-bold cursor-pointer"
            >
              Close
            </button>
          </div>
        )}
      </div>

      {/* Collapsible Subject-Wise Attendance Breakdown */}
      <div className="border-t border-slate-200 pt-3">
        <button
          onClick={() => setShowSubjectDetails(!showSubjectDetails)}
          className="w-full flex items-center justify-between text-xs font-bold text-slate-700 hover:text-slate-900 transition-colors cursor-pointer py-1"
        >
          <div className="flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-slate-500" />
            <span>Course-Wise Attendance Breakdown (5 Subjects)</span>
          </div>
          <span className="flex items-center gap-1 text-[11px] text-amber-700">
            {showSubjectDetails ? 'Hide Details' : 'View Course Breakdown'}
            {showSubjectDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </span>
        </button>

        {showSubjectDetails && (
          <div className="mt-3 space-y-2 animate-in fade-in duration-150">
            {subjectStats.map((sub) => (
              <div
                key={sub.code}
                className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-800">{sub.code}</span>
                    <span className="text-slate-600">{sub.name}</span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    Attended: {sub.attended} of {sub.total} classes
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`font-mono font-bold text-xs ${
                    sub.percentage >= 80 ? 'text-emerald-700' : 'text-amber-700'
                  }`}>
                    {sub.percentage.toFixed(1)}%
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    sub.percentage >= 80
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {sub.percentage >= 80 ? 'Safe' : 'Near Cutoff'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
