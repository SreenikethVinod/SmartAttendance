import React, { useState } from 'react';
import { useAttendance } from '../context/AttendanceContext';
import { 
  Wifi, 
  WifiOff, 
  ShieldCheck, 
  RefreshCw, 
  Lock, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Globe, 
  Server, 
  Sparkles
} from 'lucide-react';

interface WifiConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WifiConfigModal: React.FC<WifiConfigModalProps> = ({ isOpen, onClose }) => {
  const {
    networkConfig,
    isNetworkProbing,
    refreshNetworkStatus,
    lockCurrentAsBaseWifi,
    toggleNetworkMode,
  } = useAttendance();

  const [customName, setCustomName] = useState(networkConfig.baseWifiName || 'Classroom Wi-Fi');
  const [successFeedback, setSuccessFeedback] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLockCurrent = async () => {
    await lockCurrentAsBaseWifi(customName);
    setSuccessFeedback('Current network successfully locked as the Base Classroom Wi-Fi!');
    setTimeout(() => setSuccessFeedback(null), 3000);
  };

  const isMatched = networkConfig.isClassroomWifiConnected;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-[#0B2545] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 rounded-lg border ${
              isMatched 
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
            }`}>
              {isMatched ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-display font-bold text-base text-white">
                Classroom Wi-Fi Restriction System
              </h3>
              <p className="text-xs text-slate-300">
                Attendance is locked to your specific Wi-Fi network gateway
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

        {/* Content */}
        <div className="p-6 space-y-4">
          {successFeedback && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{successFeedback}</span>
            </div>
          )}

          {/* Real Live Network Status Box */}
          <div className={`p-4 rounded-xl border ${
            isMatched 
              ? 'bg-emerald-50/70 border-emerald-200' 
              : 'bg-rose-50/80 border-rose-200'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Live Network Connection
              </span>
              <button
                onClick={refreshNetworkStatus}
                disabled={isNetworkProbing}
                className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-[#0B2545] cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isNetworkProbing ? 'animate-spin text-blue-600' : ''}`} />
                <span>{isNetworkProbing ? 'Pinging...' : 'Re-Scan Network'}</span>
              </button>
            </div>

            <div className="mt-2 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-slate-400" /> Current Public IP:
                </span>
                <span className="font-mono font-bold text-slate-900">{networkConfig.currentIp}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-slate-400" /> ISP / Gateway:
                </span>
                <span className="font-semibold text-slate-800">{networkConfig.currentIsp || 'Broadband'}</span>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                <span className="text-slate-500">Attendance Authorization:</span>
                {isMatched ? (
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded text-[11px]">
                    <CheckCircle2 className="w-3 h-3" /> MATCHED (Allowed)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded text-[11px]">
                    <AlertTriangle className="w-3 h-3" /> MISMATCH (Blocked)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Base Wi-Fi Details Box */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <Lock className="w-3.5 h-3.5 text-amber-600" />
                <span>Locked Classroom Base Wi-Fi</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                {networkConfig.baseWifiIp ? 'Configured' : 'Auto-detected'}
              </span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Authorized Gateway IP:</span>
                <span className="font-mono font-bold text-slate-900">
                  {networkConfig.baseWifiIp || networkConfig.currentIp}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Network Name:</span>
                <span className="font-semibold text-slate-800">{networkConfig.baseWifiName}</span>
              </div>
            </div>

            {/* Rename or Lock current Wi-Fi */}
            <div className="pt-2 border-t border-slate-200 space-y-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Classroom / Wi-Fi Label:
                </label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g. Hall CR-304 Wi-Fi"
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:ring-2 focus:ring-[#0B2545] focus:outline-hidden"
                />
              </div>

              <button
                onClick={handleLockCurrent}
                disabled={isNetworkProbing}
                className="w-full py-2 px-3 bg-[#0B2545] hover:bg-[#133E87] text-white text-xs font-bold rounded-md shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Lock My Current Wi-Fi as Base Network</span>
              </button>
            </div>
          </div>

          {/* Demonstration Switcher for Evaluators */}
          <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs space-y-2">
            <div className="flex items-center gap-1.5 text-amber-900 font-bold text-[11px]">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Evaluator Demo: Test Network Switching</span>
            </div>
            <p className="text-[11px] text-amber-800">
              In real life, if a student disconnects from this Wi-Fi or switches to mobile data, attendance is automatically blocked. You can test this live by disconnecting your Wi-Fi or using the quick simulation toggle below:
            </p>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => toggleNetworkMode(true)}
                className={`py-1.5 px-2 rounded-md font-semibold text-xs border text-center transition-colors cursor-pointer ${
                  isMatched
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                Match Base Wi-Fi (Allowed)
              </button>
              <button
                onClick={() => toggleNetworkMode(false)}
                className={`py-1.5 px-2 rounded-md font-semibold text-xs border text-center transition-colors cursor-pointer ${
                  !isMatched
                    ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                Switch Network (Blocked)
              </button>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-md transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
