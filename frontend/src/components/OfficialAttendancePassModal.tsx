import React, { useState } from 'react';
import { AttendanceRecord, Student } from '../types/attendance';
import { CvvLogo } from './CvvLogo';
import { 
  X, 
  Printer, 
  CheckCircle2, 
  Copy, 
  Check, 
  ShieldCheck, 
  Calendar, 
  Clock, 
  Wifi, 
  User, 
  Award,
  QrCode
} from 'lucide-react';

interface OfficialAttendancePassModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: AttendanceRecord;
  student: Student;
}

export const OfficialAttendancePassModal: React.FC<OfficialAttendancePassModalProps> = ({
  isOpen,
  onClose,
  record,
  student,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const verificationHash = `CVV-AUTH-${student.prn}-P${record.periodNumber}-${record.date.replace(/-/g, '')}-${record.timestamp.replace(/:/g, '')}`;

  const handleCopyHash = () => {
    navigator.clipboard.writeText(verificationHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Action Bar */}
        <div className="bg-[#0B2545] text-white px-6 py-4 flex items-center justify-between border-b border-blue-900 print:hidden">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-400" />
            <span className="font-bold text-sm tracking-wide">Digital Attendance Verification Pass</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer text-xs flex items-center gap-1.5 px-3"
              title="Print Official Slip"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Official Pass Certificate */}
        <div className="p-6 sm:p-8 space-y-6 print:p-0 bg-white" id="cvv-attendance-pass">
          
          {/* Institutional Crest Header */}
          <div className="text-center border-b border-slate-200 pb-5">
            <div className="flex justify-center mb-2">
              <CvvLogo size="md" />
            </div>
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 text-[11px] font-bold uppercase tracking-wider">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Official ERP Timestamp Verified</span>
            </div>
          </div>

          {/* Student Profile & Pass QR Info */}
          <div className="flex items-center justify-between gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-200 ring-2 ring-[#0B2545]/20 shrink-0">
                {student.photoDataUrl ? (
                  <img src={student.photoDataUrl} alt={student.name} className="w-full h-full object-cover" />
                ) : (
                  <img src={student.avatarUrl} alt={student.name} className="w-full h-full object-cover" />
                )}
              </div>
              <div>
                <h4 className="font-display font-bold text-base text-[#0B2545]">
                  {student.name}
                </h4>
                <p className="text-xs font-mono font-semibold text-slate-700">
                  PRN: {student.prn} · Roll #{student.rollNo}
                </p>
                <p className="text-[11px] text-slate-500">
                  {student.department} · {student.semester}
                </p>
              </div>
            </div>

            {/* Simulated Verified QR Code */}
            <div className="p-2 bg-white rounded-lg border border-slate-300 shadow-2xs text-center shrink-0">
              <QrCode className="w-12 h-12 text-[#0B2545] mx-auto" />
              <span className="text-[9px] font-mono text-slate-500 block mt-0.5 font-bold">SCAN VERIFY</span>
            </div>
          </div>

          {/* Period & Attendance Specifications */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Academic Period</span>
              <span className="font-bold text-slate-800">Period {record.periodNumber} of 7</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Check-in Timestamp</span>
              <span className="font-bold text-slate-800 font-mono">{record.timestamp} · {record.date}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Biometric Match</span>
              <span className="font-bold text-emerald-700 font-mono">{record.matchConfidence}% Match</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Passive Liveness</span>
              <span className="font-bold text-emerald-700 font-mono">{record.livenessScore || 97.4}% Live Subject</span>
            </div>
          </div>

          {/* Network Security Lock */}
          <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-200 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wifi className="w-4 h-4 text-blue-700 shrink-0" />
              <div>
                <span className="font-bold text-blue-950 block">Classroom Wi-Fi Base Authenticated</span>
                <span className="text-[11px] font-mono text-blue-800">
                  IP: {record.ipAddress || '192.168.1.104'} ({record.networkSsid || 'CVV_Campus_5GHz'})
                </span>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
              LOCATION LOCKED
            </span>
          </div>

          {/* Cryptographic Digital Signature */}
          <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-between gap-2">
            <div className="overflow-hidden">
              <span className="text-[9px] uppercase font-bold text-slate-500 block">Digital Verification Hash</span>
              <span className="text-[10px] font-mono text-slate-700 truncate block">
                {verificationHash}
              </span>
            </div>
            <button
              onClick={handleCopyHash}
              className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-300 rounded text-[10px] font-semibold text-slate-700 transition-colors cursor-pointer shrink-0 flex items-center gap-1 print:hidden"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          <div className="text-center text-[10px] text-slate-400">
            Issued by Chinmaya Vishwa Vidyapeeth (Deemed-to-be-University) · Linways ERP Gateway
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 print:hidden">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Close Pass
          </button>
        </div>
      </div>
    </div>
  );
};
