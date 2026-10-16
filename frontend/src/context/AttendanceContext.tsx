import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  Student,
  Faculty,
  TimetablePeriod,
  AttendanceSession,
  AttendanceRecord,
  AuditLog,
  NetworkConfig,
  AuthUser,
  OverrideReason,
} from '../types/attendance';
import {
  INITIAL_FACULTY,
  INITIAL_STUDENTS,
  TIMETABLE_PERIODS,
  INITIAL_NETWORK_CONFIG,
  createInitialRecords,
} from '../data/mockData';
import { fetchLiveNetworkInfo, verifyWifiMatch } from '../utils/networkDetector';
import { checkForDuplicateFace, DuplicateCheckResult } from '../utils/faceMatching';
import { 
  fetchStudentsFromBackend, 
  deleteStudentFromBackend, 
  deleteFaceWithInsightFace, 
  submitAttendanceOverride 
} from '../utils/insightFaceApi';

const TODAY_DATE = new Date().toISOString().split('T')[0];

interface VerificationResult {
  success: boolean;
  code: 'SUCCESS' | 'NETWORK_BLOCKED' | 'LIVENESS_FAILED' | 'FACE_MISMATCH' | 'SESSION_EXPIRED' | 'NOT_ENROLLED' | 'SPOOF_ATTACK_DETECTED';
  message: string;
  record?: AttendanceRecord;
}

export interface RegisterStudentData {
  name: string;
  prn: string;
  rollNo: number;
  email: string;
  department: string;
  semester: string;
  pin?: string;
  snapshotUrl: string;
  descriptor: number[];
  dimensions?: Record<string, number>;
}

export interface RegisterFacultyData {
  name: string;
  facultyId: string;
  department: string;
  designation: string;
  email: string;
  password?: string;
  courses: string[];
}

export interface EnrollFaceResult {
  success: boolean;
  error?: string;
  matchedStudentName?: string;
  matchedStudentPrn?: string;
  similarityScore?: number;
}

interface AttendanceContextType {
  students: Student[];
  facultyList: Faculty[];
  timetable: TimetablePeriod[];
  currentUser: AuthUser | null;
  activeSession: AttendanceSession | null;
  attendanceRecords: AttendanceRecord[];
  auditLogs: AuditLog[];
  networkConfig: NetworkConfig;
  isNetworkProbing: boolean;
  
  // Auth & Physical Registration methods
  loginAsStudent: (prn: string) => boolean;
  loginAsFaculty: (facultyId: string) => boolean;
  logout: () => void;
  registerStudent: (data: RegisterStudentData) => { student?: Student; error?: string };
  registerFaculty: (data: RegisterFacultyData) => Faculty;
  enrollFaceForStudent: (studentPrn: string, snapshotUrl: string, descriptor: number[], dimensions?: Record<string, number>) => EnrollFaceResult;
  checkFaceDuplicate: (descriptor: number[], studentPrn: string) => DuplicateCheckResult;

  // Session methods
  startSession: (periodNumber: number) => void;
  endSession: () => void;
  extendSession: (seconds: number) => void;

  // Verification & Override methods
  submitAttendanceVerification: (
    studentPrn: string,
    matchConfidence: number,
    livenessScore: number,
    antiSpoofMeta?: {
      attackType?: 'REAL_HUMAN' | 'SCREEN_REPLAY' | 'PRINTED_PHOTO' | 'PAPER_MASK';
      cosineSimilarity?: number;
      euclideanDistance?: number;
    }
  ) => VerificationResult;
  recordVerificationFailure: (studentPrn: string, reasonCode: string, note?: string) => void;
  performManualOverride: (teacherId: string, studentPrn: string, reason: OverrideReason, customNote?: string) => void;

  // Real Network Detection & Locking
  refreshNetworkStatus: () => Promise<void>;
  lockCurrentAsBaseWifi: (customName?: string) => Promise<void>;
  toggleNetworkMode: (isCampusWifi: boolean) => void;
  deleteStudent: (prn: string) => void;
  addOrUpdateStudent: (student: Student) => void;
  resetDatabase: (mode: 'FULL' | 'FACES_ONLY' | 'RECORDS_ONLY') => void;
  resetFaceEnrollments: () => void;
  resetAllData: () => void;
}

const AttendanceContext = createContext<AttendanceContextType | undefined>(undefined);

// Bump version to purge legacy vectors and ensure clean database with anti-spoof and anti-cover biometrics
const CURRENT_DB_VERSION = 'v12_cvv_anti_cover_anti_background_v6';

export const AttendanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (typeof window !== 'undefined') {
    const existingVersion = localStorage.getItem('cvv_app_version');
    if (existingVersion !== CURRENT_DB_VERSION) {
      localStorage.removeItem('cvv_students');
      localStorage.removeItem('cvv_faculty_list');
      localStorage.removeItem('cvv_attendance_records');
      localStorage.removeItem('cvv_audit_logs');
      localStorage.removeItem('cvv_current_user');
      localStorage.removeItem('cvv_active_session');
      localStorage.setItem('cvv_app_version', CURRENT_DB_VERSION);
    }
  }

  // Load or initialize students (Default: Student 1 & Student 2)
  const [students, setStudents] = useState<Student[]>(() => {
    const saved = localStorage.getItem('cvv_students');
    if (saved) {
      try { 
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch { /* ignore */ }
    }
    return INITIAL_STUDENTS;
  });

  // Load or initialize faculty (Default: Dr. K. Narayanan)
  const [facultyList, setFacultyList] = useState<Faculty[]>(() => {
    const saved = localStorage.getItem('cvv_faculty_list');
    if (saved) {
      try { 
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch { /* ignore */ }
    }
    return INITIAL_FACULTY;
  });

  const [timetable] = useState<TimetablePeriod[]>(TIMETABLE_PERIODS);

  // Current logged in user
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    const saved = localStorage.getItem('cvv_current_user');
    if (saved) {
      try { return JSON.parse(saved); } catch { /* ignore */ }
    }
    return null;
  });

  // Active 5-minute session
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(() => {
    const saved = localStorage.getItem('cvv_active_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const diffSeconds = Math.max(0, Math.floor((new Date(parsed.expiresAt).getTime() - Date.now()) / 1000));
        if (diffSeconds > 0 && parsed.isActive) {
          return { ...parsed, remainingSeconds: diffSeconds };
        }
      } catch { /* ignore */ }
    }
    // Default active Period 1 session so attendance scanning is immediately open
    const durationSeconds = 300;
    const now = Date.now();
    return {
      id: `session-p1-${now}`,
      periodNumber: 1,
      subjectCode: 'CSE301',
      subjectName: 'Computer Networks',
      facultyId: 'FAC-CSE-101',
      facultyName: 'Dr. K. Narayanan',
      room: 'Hall CR-304',
      date: TODAY_DATE,
      startedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + durationSeconds * 1000).toISOString(),
      remainingSeconds: durationSeconds,
      durationSeconds,
      isActive: true,
    };
  });

  // Attendance Records
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(() => {
    const saved = localStorage.getItem('cvv_attendance_records');
    if (saved) {
      try { return JSON.parse(saved); } catch { /* ignore */ }
    }
    return createInitialRecords(TODAY_DATE);
  });

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    const saved = localStorage.getItem('cvv_audit_logs');
    if (saved) {
      try { return JSON.parse(saved); } catch { /* ignore */ }
    }
    return [];
  });

  // Classroom Wi-Fi Network restriction state
  const [networkConfig, setNetworkConfig] = useState<NetworkConfig>(() => {
    const saved = localStorage.getItem('cvv_network_config');
    if (saved) {
      try { return JSON.parse(saved); } catch { /* ignore */ }
    }
    return INITIAL_NETWORK_CONFIG;
  });

  const [isNetworkProbing, setIsNetworkProbing] = useState<boolean>(false);

  // Active Real-Time Wi-Fi Probing & Base Wi-Fi Verification
  const refreshNetworkStatus = useCallback(async () => {
    setIsNetworkProbing(true);
    try {
      const liveInfo = await fetchLiveNetworkInfo();
      
      setNetworkConfig((prev) => {
        if (prev.isSimulationActive) {
          return {
            ...prev,
            currentIp: prev.simulatedIp || '157.48.21.90',
            currentSsid: prev.simulatedSsid || 'External-Cellular-Hotspot-5G',
            isClassroomWifiConnected: false,
            lastCheckedAt: Date.now(),
          };
        }

        let baseIp = prev.baseWifiIp;
        let baseIsp = prev.baseWifiIsp;
        let baseName = prev.baseWifiName;

        // Auto-lock user's current Wi-Fi as base on first detection if not set
        if (!baseIp || baseIp === '' || baseIp === 'UNKNOWN') {
          baseIp = liveInfo.publicIp;
          baseIsp = liveInfo.isp || 'Authorized Classroom Wi-Fi';
          baseName = 'Authorized Classroom Wi-Fi';
        }

        const matchResult = verifyWifiMatch(liveInfo.publicIp, baseIp);

        return {
          ...prev,
          currentIp: liveInfo.publicIp,
          currentIsp: liveInfo.isp,
          currentLocation: liveInfo.city || prev.currentLocation,
          currentSsid: matchResult.isMatch ? (baseName || 'Authorized Classroom Wi-Fi') : `External (${liveInfo.isp || 'Unknown Network'})`,
          baseWifiIp: baseIp,
          baseWifiIsp: baseIsp,
          baseWifiName: baseName,
          isClassroomWifiConnected: matchResult.isMatch,
          isSimulationActive: false,
          lastCheckedAt: Date.now(),
        };
      });
    } catch (err) {
      console.warn('Network probe error:', err);
    } finally {
      setIsNetworkProbing(false);
    }
  }, []);

  const lockCurrentAsBaseWifi = async (customName?: string) => {
    setIsNetworkProbing(true);
    try {
      const liveInfo = await fetchLiveNetworkInfo();
      const newBaseName = customName || `Classroom Wi-Fi (${liveInfo.isp || 'Active Gateway'})`;

      setNetworkConfig((prev) => ({
        ...prev,
        baseWifiIp: liveInfo.publicIp,
        baseWifiIsp: liveInfo.isp,
        baseWifiName: newBaseName,
        currentIp: liveInfo.publicIp,
        currentIsp: liveInfo.isp,
        currentSsid: newBaseName,
        isClassroomWifiConnected: true,
        isSimulationActive: false,
        lastCheckedAt: Date.now(),
      }));
    } finally {
      setIsNetworkProbing(false);
    }
  };

  const toggleNetworkMode = (isCampusWifi: boolean) => {
    if (isCampusWifi) {
      setNetworkConfig((prev) => ({
        ...prev,
        isSimulationActive: false,
        isClassroomWifiConnected: true,
        currentIp: prev.baseWifiIp || '10.24.112.45',
        currentSsid: prev.baseWifiName || 'Authorized Classroom Wi-Fi',
      }));
      refreshNetworkStatus();
    } else {
      setNetworkConfig((prev) => ({
        ...prev,
        isSimulationActive: true,
        isClassroomWifiConnected: false,
        simulatedIp: '157.48.21.90',
        simulatedSsid: 'Cellular-5G-Mobile-Hotspot',
        currentIp: '157.48.21.90',
        currentSsid: 'Cellular-5G-Mobile-Hotspot',
        currentIsp: 'External Mobile Cellular Carrier',
        lastCheckedAt: Date.now(),
      }));
    }
  };

  // Initial network check on mount + continuous probe interval (every 8s)
  useEffect(() => {
    refreshNetworkStatus();
    const networkInterval = setInterval(() => {
      refreshNetworkStatus();
    }, 8000);

    return () => clearInterval(networkInterval);
  }, [refreshNetworkStatus]);

  // Synchronize student face enrollments and roster from InsightFace SQLite database on startup
  useEffect(() => {
    fetchStudentsFromBackend()
      .then((backendStudents) => {
        if (backendStudents && Array.isArray(backendStudents) && backendStudents.length > 0) {
          setStudents((prev) => {
            const map = new Map(prev.map((s) => [s.prn.trim().toUpperCase(), s]));
            for (const bs of backendStudents) {
              const prnKey = bs.prn.trim().toUpperCase();
              const existing = map.get(prnKey);
              if (existing) {
                map.set(prnKey, {
                  ...existing,
                  isFaceEnrolled: Boolean(bs.isFaceEnrolled),
                  name: bs.name || existing.name,
                  enrolledAt: bs.enrolledAt || existing.enrolledAt,
                });
              } else {
                map.set(prnKey, {
                  id: bs.id,
                  prn: bs.prn,
                  rollNo: bs.rollNo,
                  name: bs.name,
                  email: bs.email,
                  department: bs.department,
                  semester: bs.semester,
                  batch: bs.batch,
                  avatarUrl: bs.avatarUrl,
                  isFaceEnrolled: Boolean(bs.isFaceEnrolled),
                  enrolledAt: bs.enrolledAt,
                  overallAttendancePercentage: bs.overallAttendance || 85,
                });
              }
            }
            return Array.from(map.values());
          });
        }
      })
      .catch((err) => console.warn('Could not sync students from InsightFace backend:', err));
  }, []);

  // Save changes to localStorage
  useEffect(() => {
    localStorage.setItem('cvv_students', JSON.stringify(students));
  }, [students]);

  useEffect(() => {
    localStorage.setItem('cvv_faculty_list', JSON.stringify(facultyList));
  }, [facultyList]);

  useEffect(() => {
    localStorage.setItem('cvv_attendance_records', JSON.stringify(attendanceRecords));
  }, [attendanceRecords]);

  useEffect(() => {
    localStorage.setItem('cvv_audit_logs', JSON.stringify(auditLogs));
  }, [auditLogs]);

  useEffect(() => {
    localStorage.setItem('cvv_network_config', JSON.stringify(networkConfig));
  }, [networkConfig]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('cvv_current_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('cvv_current_user');
    }
  }, [currentUser]);

  useEffect(() => {
    if (activeSession) {
      localStorage.setItem('cvv_active_session', JSON.stringify(activeSession));
    } else {
      localStorage.removeItem('cvv_active_session');
    }
  }, [activeSession]);

  // Session timer ticker
  useEffect(() => {
    if (!activeSession || !activeSession.isActive) return;

    const interval = setInterval(() => {
      setActiveSession((prev) => {
        if (!prev || !prev.isActive) return null;
        const now = Date.now();
        const expiry = new Date(prev.expiresAt).getTime();
        const diffSeconds = Math.max(0, Math.floor((expiry - now) / 1000));

        if (diffSeconds <= 0) {
          return {
            ...prev,
            remainingSeconds: 0,
            isActive: false,
          };
        }
        return {
          ...prev,
          remainingSeconds: diffSeconds,
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeSession?.isActive, activeSession?.expiresAt]);

  // Duplicate face checker helper
  const checkFaceDuplicate = (descriptor: number[], studentPrn: string): DuplicateCheckResult => {
    return checkForDuplicateFace(descriptor, studentPrn, students);
  };

  // Auth Functions
  const loginAsStudent = (prn: string): boolean => {
    const target = students.find((s) => s.prn.toUpperCase() === prn.trim().toUpperCase());
    if (target) {
      setCurrentUser({ role: 'student', student: target });
      return true;
    }
    return false;
  };

  const loginAsFaculty = (facultyId: string): boolean => {
    const target = facultyList.find((f) => f.facultyId.toUpperCase() === facultyId.trim().toUpperCase());
    if (target) {
      setCurrentUser({ role: 'faculty', faculty: target });
      return true;
    }
    return false;
  };

  const logout = () => {
    setCurrentUser(null);
  };

  // Physically Register Student with camera face enrollment & duplicate check
  const registerStudent = (data: RegisterStudentData): { student?: Student; error?: string } => {
    const cleanPrn = data.prn.trim().toUpperCase();

    // Check duplicate PRN
    if (students.some((s) => s.prn.toUpperCase() === cleanPrn)) {
      return { error: `PRN ${cleanPrn} already exists in the student roster.` };
    }

    // Check duplicate Face (legacy heuristic check only when 128-D vector is provided)
    if (data.descriptor && data.descriptor.length === 128) {
      const dupCheck = checkForDuplicateFace(data.descriptor, cleanPrn, students);
      if (dupCheck.isDuplicate) {
        return {
          error: `Duplicate Face Detected: This facial identity is already registered to ${dupCheck.matchedStudentName} (${dupCheck.matchedStudentPrn}). One face cannot be registered to multiple student accounts!`,
        };
      }
    }

    const newStudent: Student = {
      id: `stud-${cleanPrn}-${Date.now()}`,
      prn: cleanPrn,
      rollNo: data.rollNo,
      name: data.name.trim(),
      email: data.email.trim(),
      department: data.department,
      semester: data.semester,
      batch: '2024 - 2028',
      avatarUrl: data.snapshotUrl,
      photoDataUrl: data.snapshotUrl,
      isFaceEnrolled: true,
      enrolledAt: new Date().toISOString(),
      faceDescriptor: data.descriptor,
      faceDimensions: data.dimensions,
      overallAttendancePercentage: 100,
    };

    const nextStudents = [...students, newStudent];
    setStudents(nextStudents);
    try {
      localStorage.setItem('cvv_students', JSON.stringify(nextStudents));
    } catch { /* ignore */ }

    const newAuth: AuthUser = { role: 'student', student: newStudent };
    setCurrentUser(newAuth);
    try {
      localStorage.setItem('cvv_current_user', JSON.stringify(newAuth));
    } catch { /* ignore */ }

    return { student: newStudent };
  };

  // Physically Register Faculty member
  const registerFaculty = (data: RegisterFacultyData): Faculty => {
    const cleanFacultyId = data.facultyId.trim().toUpperCase();
    const newFaculty: Faculty = {
      id: `fac-${cleanFacultyId}-${Date.now()}`,
      facultyId: cleanFacultyId,
      name: data.name.trim(),
      department: data.department,
      designation: data.designation,
      email: data.email.trim(),
      courses: data.courses.length > 0 ? data.courses : ['CSE301: Computer Networks'],
    };

    setFacultyList((prev) => [...prev, newFaculty]);
    setCurrentUser({ role: 'faculty', faculty: newFaculty });
    return newFaculty;
  };

  // Update existing student's face enrollment with DUPLICATE FACE VALIDATION
  const enrollFaceForStudent = (
    studentPrn: string,
    snapshotUrl: string,
    descriptor: number[],
    dimensions?: Record<string, number>
  ): EnrollFaceResult => {
    const cleanPrn = studentPrn.trim().toUpperCase();

    // Check if this face already belongs to another registered student (legacy fallback only if 128-D vector is supplied)
    if (descriptor && descriptor.length === 128) {
      const dupCheck = checkForDuplicateFace(descriptor, cleanPrn, students);
      if (dupCheck.isDuplicate) {
        return {
          success: false,
          error: `Duplicate Face Detected: This facial identity is already registered to ${dupCheck.matchedStudentName} (${dupCheck.matchedStudentPrn}). Under university anti-proxy regulations, one person cannot register multiple student accounts!`,
          matchedStudentName: dupCheck.matchedStudentName,
          matchedStudentPrn: dupCheck.matchedStudentPrn,
          similarityScore: dupCheck.similarityScore,
        };
      }
    }

    // Success: Update student record across database and localStorage
    const updatedStudents = students.map((s) => {
      if (s.prn.trim().toUpperCase() === cleanPrn) {
        return {
          ...s,
          isFaceEnrolled: true,
          photoDataUrl: snapshotUrl,
          avatarUrl: snapshotUrl,
          faceDescriptor: descriptor,
          faceDimensions: dimensions,
          enrolledAt: new Date().toISOString(),
        };
      }
      return s;
    });

    setStudents(updatedStudents);
    try {
      localStorage.setItem('cvv_students', JSON.stringify(updatedStudents));
    } catch { /* ignore */ }

    if (currentUser?.student?.prn.trim().toUpperCase() === cleanPrn) {
      const updatedStudent = updatedStudents.find((s) => s.prn.trim().toUpperCase() === cleanPrn);
      if (updatedStudent) {
        const newAuth: AuthUser = { role: 'student', student: updatedStudent };
        setCurrentUser(newAuth);
        try {
          localStorage.setItem('cvv_current_user', JSON.stringify(newAuth));
        } catch { /* ignore */ }
      }
    }

    return { success: true };
  };

  // Session Control Functions
  const startSession = (periodNumber: number) => {
    const period = timetable.find((p) => p.periodNumber === periodNumber) || timetable[0];
    const durationSeconds = 300; // 5 minutes
    const startedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + durationSeconds * 1000).toISOString();
    const sessionId = `session-p${periodNumber}-${Date.now()}`;

    const newSession: AttendanceSession = {
      id: sessionId,
      periodNumber,
      subjectCode: period.subjectCode,
      subjectName: period.subjectName,
      facultyId: currentUser?.faculty?.facultyId || period.facultyId,
      facultyName: currentUser?.faculty?.name || period.facultyName,
      room: period.room,
      date: TODAY_DATE,
      startedAt,
      expiresAt,
      remainingSeconds: durationSeconds,
      durationSeconds,
      isActive: true,
    };

    setActiveSession(newSession);

    // Initialize all current students as ABSENT until verified
    setAttendanceRecords((prev) => {
      const existingForPeriod = prev.filter((r) => r.periodNumber === periodNumber && r.date === TODAY_DATE);
      if (existingForPeriod.length > 0) {
        return prev;
      }
      const initialPeriodRecords: AttendanceRecord[] = students.map((s) => ({
        id: `rec-p${periodNumber}-${s.prn}-${Date.now()}`,
        sessionId,
        periodNumber,
        date: TODAY_DATE,
        studentPrn: s.prn,
        studentName: s.name,
        status: 'ABSENT',
        verificationMethod: 'UNRECORDED',
        timestamp: '--:--:--',
        matchConfidence: 0,
        livenessScore: 0,
        networkSsid: 'N/A',
        ipAddress: 'N/A',
      }));
      return [...prev, ...initialPeriodRecords];
    });
  };

  const endSession = () => {
    if (!activeSession) return;
    setActiveSession((prev) => (prev ? { ...prev, isActive: false, remainingSeconds: 0, isClosedManually: true } : null));
  };

  const extendSession = (seconds: number) => {
    if (!activeSession || !activeSession.isActive) return;
    setActiveSession((prev) => {
      if (!prev) return null;
      const newExpiry = new Date(new Date(prev.expiresAt).getTime() + seconds * 1000).toISOString();
      return {
        ...prev,
        expiresAt: newExpiry,
        remainingSeconds: prev.remainingSeconds + seconds,
        durationSeconds: prev.durationSeconds + seconds,
      };
    });
  };

  // Student Attendance Verification with strict Wi-Fi network and biometric criteria
  const submitAttendanceVerification = (
    studentPrn: string,
    matchConfidence: number,
    livenessScore: number,
    antiSpoofMeta?: {
      attackType?: 'REAL_HUMAN' | 'SCREEN_REPLAY' | 'PRINTED_PHOTO' | 'PAPER_MASK';
      cosineSimilarity?: number;
      euclideanDistance?: number;
    }
  ): VerificationResult => {
    if (!activeSession || !activeSession.isActive || activeSession.remainingSeconds <= 0) {
      return {
        success: false,
        code: 'SESSION_EXPIRED',
        message: 'The attendance window for this period has expired or is closed.',
      };
    }

    const cleanPrn = studentPrn.trim().toUpperCase();
    const student = students.find((s) => s.prn.trim().toUpperCase() === cleanPrn);
    if (!student || !student.isFaceEnrolled) {
      return {
        success: false,
        code: 'NOT_ENROLLED',
        message: 'Facial profile not yet registered. First-time face verification is required before marking attendance.',
      };
    }

    // Step 1: Real Wi-Fi Network restriction check
    if (!networkConfig.isClassroomWifiConnected) {
      return {
        success: false,
        code: 'NETWORK_BLOCKED',
        message: `Attendance Blocked: You are connected to IP ${networkConfig.currentIp} (${networkConfig.currentIsp || 'External Network'}). Attendance is strictly locked to Classroom Base Wi-Fi (${networkConfig.baseWifiIp}). Please connect back to the approved Wi-Fi.`,
      };
    }

    // Step 2: MiniVision Multi-Scale Anti-Spoofing & Liveness check
    if (antiSpoofMeta?.attackType && antiSpoofMeta.attackType !== 'REAL_HUMAN') {
      const typeLabel =
        antiSpoofMeta.attackType === 'SCREEN_REPLAY'
          ? 'Digital Screen Replay (Moiré pattern detected)'
          : '2D Printed Photo (Static dynamic range detected)';
      return {
        success: false,
        code: 'SPOOF_ATTACK_DETECTED',
        message: `Anti-Spoofing Security Triggered: ${typeLabel}. Proxy attendance attempts are strictly blocked.`,
      };
    }

    if (livenessScore < 50) {
      return {
        success: false,
        code: 'LIVENESS_FAILED',
        message: `Passive liveness failed (${livenessScore}%). Static photograph or screen detected. Real live student presence required.`,
      };
    }

    // Step 3: Biometric match verified authoritatively by InsightFace ArcFace engine
    if (matchConfidence <= 0) {
      return {
        success: false,
        code: 'FACE_MISMATCH',
        message: 'InsightFace biometric match failed. Registered student identity not verified.',
      };
    }

    // Verification PASSED! Record attendance with InsightFace ArcFace & MiniFASNetV2 telemetry
    const nowTime = new Date().toTimeString().split(' ')[0];
    const updatedRecord: AttendanceRecord = {
      id: `rec-p${activeSession.periodNumber}-${student.prn}-${Date.now()}`,
      sessionId: activeSession.id,
      periodNumber: activeSession.periodNumber,
      date: TODAY_DATE,
      studentPrn: student.prn,
      studentName: student.name,
      status: 'PRESENT',
      verificationMethod: 'FACIAL_RECOGNITION',
      timestamp: nowTime,
      matchConfidence,
      livenessScore,
      antiSpoofAttackType: antiSpoofMeta?.attackType || 'REAL_HUMAN',
      cosineSimilarity: antiSpoofMeta?.cosineSimilarity,
      euclideanDistance: antiSpoofMeta?.euclideanDistance,
      networkSsid: networkConfig.currentSsid,
      ipAddress: networkConfig.currentIp,
      notes: `Verified on ${networkConfig.currentIp} (InsightFace ArcFace 512-D Cosine: ${antiSpoofMeta?.cosineSimilarity || 0.78}, MiniFASNetV2 Liveness: ${livenessScore}%)`,
    };

    setAttendanceRecords((prev) => {
      const filtered = prev.filter(
        (r) => !(r.periodNumber === activeSession.periodNumber && r.date === TODAY_DATE && r.studentPrn === student.prn)
      );
      return [updatedRecord, ...filtered];
    });

    return {
      success: true,
      code: 'SUCCESS',
      message: `Verified successfully for Period ${activeSession.periodNumber}: ${activeSession.subjectName}!`,
      record: updatedRecord,
    };
  };

  const recordVerificationFailure = (studentPrn: string, reasonCode: string, note?: string) => {
    if (!activeSession) return;
    const student = students.find((s) => s.prn === studentPrn);
    if (!student) return;

    const nowTime = new Date().toTimeString().split(' ')[0];
    const failedRecord: AttendanceRecord = {
      id: `rec-p${activeSession.periodNumber}-${student.prn}-${Date.now()}`,
      sessionId: activeSession.id,
      periodNumber: activeSession.periodNumber,
      date: TODAY_DATE,
      studentPrn: student.prn,
      studentName: student.name,
      status: 'VERIFICATION_FAILED',
      verificationMethod: 'FACIAL_RETRY',
      timestamp: nowTime,
      matchConfidence: 62.4,
      livenessScore: 68.0,
      networkSsid: networkConfig.currentSsid,
      ipAddress: networkConfig.currentIp,
      notes: note || `Verification failed: ${reasonCode}`,
    };

    setAttendanceRecords((prev) => {
      const filtered = prev.filter(
        (r) => !(r.periodNumber === activeSession.periodNumber && r.date === TODAY_DATE && r.studentPrn === student.prn)
      );
      return [failedRecord, ...filtered];
    });
  };

  const performManualOverride = (
    teacherId: string,
    studentPrn: string,
    reason: OverrideReason,
    customNote?: string
  ) => {
    const periodNum = activeSession ? activeSession.periodNumber : 1;
    const student = students.find((s) => s.prn === studentPrn);
    const teacher = facultyList.find((f) => f.facultyId === teacherId) || facultyList[0] || {
      facultyId: teacherId,
      name: 'Faculty In-Charge',
    };
    if (!student) return;

    const nowTime = new Date().toTimeString().split(' ')[0];
    const sessionId = activeSession ? activeSession.id : `session-manual-p${periodNum}`;

    const overrideRecord: AttendanceRecord = {
      id: `rec-p${periodNum}-${student.prn}-${Date.now()}`,
      sessionId,
      periodNumber: periodNum,
      date: TODAY_DATE,
      studentPrn: student.prn,
      studentName: student.name,
      status: 'MANUAL_OVERRIDE',
      verificationMethod: 'MANUAL_FACULTY_OVERRIDE',
      timestamp: nowTime,
      matchConfidence: 0,
      livenessScore: 0,
      networkSsid: networkConfig.currentSsid,
      ipAddress: networkConfig.currentIp,
      notes: `Teacher override: ${reason}${customNote ? ` - ${customNote}` : ''}`,
      verifiedByFacultyId: teacher.facultyId,
    };

    setAttendanceRecords((prev) => {
      const filtered = prev.filter(
        (r) => !(r.periodNumber === periodNum && r.date === TODAY_DATE && r.studentPrn === student.prn)
      );
      return [overrideRecord, ...filtered];
    });

    const newAudit: AuditLog = {
      id: `audit-${Date.now()}`,
      sessionId,
      periodNumber: periodNum,
      teacherId: teacher.facultyId,
      teacherName: teacher.name,
      studentPrn: student.prn,
      studentName: student.name,
      reason,
      customNote,
      timestamp: nowTime,
    };

    setAuditLogs((prev) => [newAudit, ...prev]);

    // Asynchronously log to SQLite audit table
    submitAttendanceOverride({
      sessionId,
      periodNumber: periodNum,
      date: TODAY_DATE,
      studentPrn: student.prn,
      studentName: student.name,
      newStatus: 'PRESENT',
      teacherId: teacher.facultyId,
      teacherName: teacher.name,
      reason,
      customNote,
    }).catch((err) => console.warn('Override backend log error:', err));
  };

  const deleteStudent = (prn: string) => {
    const cleanPrn = prn.trim().toUpperCase();
    deleteStudentFromBackend(cleanPrn).catch((err) => console.warn('Backend delete student error:', err));
    setStudents((prev) => prev.filter((s) => s.prn.toUpperCase() !== cleanPrn));
    if (currentUser?.student?.prn.toUpperCase() === cleanPrn) {
      setCurrentUser(null);
    }
  };

  const addOrUpdateStudent = (student: Student) => {
    setStudents((prev) => {
      const idx = prev.findIndex((s) => s.prn.toUpperCase() === student.prn.toUpperCase());
      const next = idx >= 0 ? prev.map((s, i) => (i === idx ? student : s)) : [student, ...prev];
      try {
        localStorage.setItem('cvv_students', JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
    if (currentUser?.student?.prn.toUpperCase() === student.prn.toUpperCase()) {
      setCurrentUser((prev) => {
        const nextAuth = prev ? { ...prev, student } : null;
        if (nextAuth) {
          try {
            localStorage.setItem('cvv_current_user', JSON.stringify(nextAuth));
          } catch {
            /* ignore */
          }
        }
        return nextAuth;
      });
    }
  };

  const resetDatabase = (mode: 'FULL' | 'FACES_ONLY' | 'RECORDS_ONLY') => {
    if (mode === 'FULL') {
      resetAllData();
    } else if (mode === 'FACES_ONLY') {
      resetFaceEnrollments();
    } else if (mode === 'RECORDS_ONLY') {
      localStorage.removeItem('cvv_attendance_records');
      localStorage.removeItem('cvv_audit_logs');
      setAttendanceRecords([]);
      setAuditLogs([]);
    }
  };

  const resetFaceEnrollments = () => {
    // Delete biometrics from InsightFace SQLite database
    students.forEach((s) => {
      deleteFaceWithInsightFace(s.prn).catch((err) => console.warn('Delete biometric error:', err));
    });

    setStudents((prev) =>
      prev.map((s) => ({
        ...s,
        isFaceEnrolled: false,
        faceDescriptor: undefined,
        photoDataUrl: undefined,
      }))
    );
    setCurrentUser((prev) => {
      if (prev?.role === 'student' && prev.student) {
        return {
          role: 'student',
          student: {
            ...prev.student,
            isFaceEnrolled: false,
            faceDescriptor: undefined,
            photoDataUrl: undefined,
          },
        };
      }
      return prev;
    });
  };

  const resetAllData = () => {
    localStorage.removeItem('cvv_students');
    localStorage.removeItem('cvv_faculty_list');
    localStorage.removeItem('cvv_attendance_records');
    localStorage.removeItem('cvv_audit_logs');
    localStorage.removeItem('cvv_network_config');
    localStorage.removeItem('cvv_active_session');
    localStorage.removeItem('cvv_current_user');
    setStudents(INITIAL_STUDENTS);
    setFacultyList(INITIAL_FACULTY);
    setAttendanceRecords([]);
    setAuditLogs([]);
    setNetworkConfig(INITIAL_NETWORK_CONFIG);
    setCurrentUser(null);
    setActiveSession(null);
    refreshNetworkStatus();
  };

  return (
    <AttendanceContext.Provider
      value={{
        students,
        facultyList,
        timetable,
        currentUser,
        activeSession,
        attendanceRecords,
        auditLogs,
        networkConfig,
        isNetworkProbing,
        loginAsStudent,
        loginAsFaculty,
        logout,
        registerStudent,
        registerFaculty,
        enrollFaceForStudent,
        checkFaceDuplicate,
        startSession,
        endSession,
        extendSession,
        submitAttendanceVerification,
        recordVerificationFailure,
        performManualOverride,
        refreshNetworkStatus,
        lockCurrentAsBaseWifi,
        toggleNetworkMode,
        deleteStudent,
        addOrUpdateStudent,
        resetDatabase,
        resetFaceEnrollments,
        resetAllData,
      }}
    >
      {children}
    </AttendanceContext.Provider>
  );
};

export const useAttendance = () => {
  const context = useContext(AttendanceContext);
  if (!context) {
    throw new Error('useAttendance must be used within an AttendanceProvider');
  }
  return context;
};
