export interface Student {
  id: string;
  prn: string; // Permanent Registration Number (e.g. CVV2024CS001)
  rollNo: number;
  name: string;
  email: string;
  department: string;
  semester: string;
  batch: string;
  avatarUrl: string;
  isFaceEnrolled: boolean;
  enrolledAt?: string;
  photoDataUrl?: string; // Captured snapshot for verification matching
  faceDescriptor?: number[]; // Extracted feature vector
  faceDimensions?: Record<string, number>; // Anatomical skull proportions (aspectRatio, jawTaper, etc.)
  overallAttendancePercentage: number;
}

export interface Faculty {
  id: string;
  facultyId: string; // e.g. FAC-CSE-108
  name: string;
  department: string;
  designation: string;
  email: string;
  courses: string[];
}

export interface TimetablePeriod {
  periodNumber: number; // 1 to 7
  timeSlot: string; // e.g. "09:00 - 09:50"
  subjectCode: string; // e.g. "CSE301"
  subjectName: string; // e.g. "Computer Networks"
  facultyId: string;
  facultyName: string;
  room: string;
}

export type VerificationStatus = 'PRESENT' | 'ABSENT' | 'MANUAL_OVERRIDE' | 'VERIFICATION_FAILED';
export type VerificationMethod = 'FACIAL_RECOGNITION' | 'FACIAL_RETRY' | 'MANUAL_FACULTY_OVERRIDE' | 'UNRECORDED';

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  periodNumber: number;
  date: string; // YYYY-MM-DD
  studentPrn: string;
  studentName: string;
  status: VerificationStatus;
  verificationMethod: VerificationMethod;
  timestamp: string;
  matchConfidence: number; // 0 to 100%
  livenessScore: number; // 0 to 100%
  antiSpoofAttackType?: 'REAL_HUMAN' | 'SCREEN_REPLAY' | 'PRINTED_PHOTO' | 'PAPER_MASK';
  cosineSimilarity?: number; // InsightFace ArcFace 512-D cosine similarity (-1 to 1)
  euclideanDistance?: number; // L2 normalized euclidean metric
  networkSsid: string;
  ipAddress: string;
  notes?: string;
  verifiedByFacultyId?: string;
}

export interface AttendanceSession {
  id: string;
  periodNumber: number;
  subjectCode: string;
  subjectName: string;
  facultyId: string;
  facultyName: string;
  room: string;
  date: string;
  startedAt: string;
  expiresAt: string; // ISO string 5 mins after startedAt
  remainingSeconds: number;
  durationSeconds: number; // 300 (5 mins)
  isActive: boolean;
  isClosedManually?: boolean;
}

export type OverrideReason = 
  | 'VISUAL_IDENTITY_VERIFIED'
  | 'APPROVED_DEVICE_CAMERA_GLITCH'
  | 'LIGHTING_FAILED_IN_CLASSROOM'
  | 'NETWORK_HANDOFF_FAILURE'
  | 'MEDICAL_OR_SPECIAL_EXCUSE';

export interface AuditLog {
  id: string;
  sessionId: string;
  periodNumber: number;
  teacherId: string;
  teacherName: string;
  studentPrn: string;
  studentName: string;
  reason: OverrideReason;
  customNote?: string;
  timestamp: string;
}

export interface NetworkConfig {
  isClassroomWifiConnected: boolean;
  currentSsid: string;
  currentIp: string;
  currentIsp: string;
  currentLocation?: string;
  baseWifiIp: string;
  baseWifiIsp: string;
  baseWifiName: string;
  allowedSsid: string;
  allowedSubnetPrefix: string;
  isSimulationActive: boolean;
  simulatedIp?: string;
  simulatedSsid?: string;
  lastCheckedAt: number;
}

export type UserRole = 'student' | 'faculty';

export interface AuthUser {
  role: UserRole;
  student?: Student;
  faculty?: Faculty;
}
