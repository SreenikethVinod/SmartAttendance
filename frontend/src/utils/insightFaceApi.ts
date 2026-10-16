/**
 * Dedicated InsightFace API Client for Frontend-Backend Biometric Verification.
 * Communicates with the official InsightFace FastAPI service running on /api.
 */

export interface InsightFaceHealth {
  status: string;
  engine: string;
  model_loaded: boolean;
  model_name: string;
  init_error: string | null;
  similarity_threshold: number;
  timestamp: string;
}

export interface InsightFaceEnrollResult {
  success: boolean;
  message: string;
  prn?: string;
  model?: string;
  embedding_dim?: number;
  quality_score?: number;
  error_code?: string;
  matched_prn?: string;
  matched_name?: string;
  similarity?: number;
}

export interface InsightFaceVerifyResult {
  success: boolean;
  is_genuine?: boolean;
  is_live?: boolean;
  attack_type?: string;
  liveness_score?: number;
  message: string;
  similarity?: number;
  confidence?: number;
  threshold?: number;
  already_marked?: boolean;
  error_code?: string;
  record?: any;
}

export interface ThresholdConfig {
  similarity_threshold: number;
  model_name: string;
  recommended_threshold: number;
  far_benchmark: string;
  description: string;
}

export interface InsightFaceDetectResult {
  success: boolean;
  detected: boolean;
  face_count: number;
  det_score?: number;
  bbox?: number[];
  quality_score?: number;
  message: string;
}

/**
 * Checks backend health and InsightFace model status.
 */
export async function getInsightFaceHealth(): Promise<InsightFaceHealth | null> {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('InsightFace health check failed:', err);
    return null;
  }
}

/**
 * Runs genuine InsightFace deep neural detector on a camera frame.
 */
export async function detectFaceWithInsightFace(
  imageBase64: string
): Promise<InsightFaceDetectResult> {
  try {
    const res = await fetch('/api/face/detect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageBase64 }),
    });
    if (!res.ok) {
      return { success: false, detected: false, face_count: 0, message: 'Detection request failed' };
    }
    return await res.json();
  } catch (err: any) {
    return { success: false, detected: false, face_count: 0, message: err?.message || 'Network error' };
  }
}

/**
 * Enrolls a student face using InsightFace 512-D deep learning model.
 * Performs face quality check, single-face validation, and duplicate identity prevention.
 */
export async function enrollFaceWithInsightFace(
  prn: string,
  imageBase64: string,
  consentGiven: boolean = true
): Promise<InsightFaceEnrollResult> {
  try {
    const res = await fetch('/api/students/enroll-face', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prn: prn.trim().toUpperCase(),
        image: imageBase64,
        consentGiven,
        auditNote: 'Student camera enrollment via web client',
      }),
    });

    const data = await res.json();
    return {
      success: res.ok && data.success === true,
      message: data.message || (res.ok ? 'Face enrolled successfully' : 'Enrollment failed'),
      prn: data.prn,
      model: data.model,
      embedding_dim: data.embedding_dim,
      quality_score: data.quality_score,
      error_code: data.error_code,
      matched_prn: data.matched_prn,
      matched_name: data.matched_name,
      similarity: data.similarity,
    };
  } catch (err: any) {
    return {
      success: false,
      error_code: 'NETWORK_ERROR',
      message: `Failed to connect to InsightFace server: ${err?.message || 'Server unreachable'}`,
    };
  }
}

/**
 * Deletes student biometric template according to privacy/retention policy.
 */
export async function deleteFaceWithInsightFace(prn: string): Promise<boolean> {
  try {
    const res = await fetch('/api/students/delete-face', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prn: prn.trim().toUpperCase() }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Verifies attendance using 1:1 InsightFace ArcFace comparison against enrolled template.
 */
export async function verifyAttendanceWithInsightFace(params: {
  prn: string;
  sessionId: string;
  periodNumber: number;
  date: string;
  imageBase64: string;
  networkSsid?: string;
  ipAddress?: string;
}): Promise<InsightFaceVerifyResult> {
  try {
    const res = await fetch('/api/attendance/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prn: params.prn.trim().toUpperCase(),
        sessionId: params.sessionId,
        periodNumber: params.periodNumber,
        date: params.date,
        image: params.imageBase64,
        networkSsid: params.networkSsid,
        ipAddress: params.ipAddress,
      }),
    });

    const data = await res.json();
    return {
      success: res.ok && data.success === true,
      is_genuine: data.is_genuine,
      message: data.message || (res.ok ? 'Verified successfully' : 'Verification failed'),
      similarity: data.similarity,
      confidence: data.confidence,
      threshold: data.threshold,
      already_marked: data.already_marked,
      error_code: data.error_code,
      record: data.record,
    };
  } catch (err: any) {
    return {
      success: false,
      is_genuine: false,
      error_code: 'NETWORK_ERROR',
      message: `Could not reach InsightFace verification service: ${err?.message || 'Server connection error'}`,
    };
  }
}

/**
 * Gets currently configured similarity threshold from backend.
 */
export async function getThresholdConfig(): Promise<ThresholdConfig | null> {
  try {
    const res = await fetch('/api/config/threshold');
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Updates similarity threshold with faculty authorization.
 */
export async function updateThresholdConfig(threshold: number, facultyId?: string, reason?: string): Promise<boolean> {
  try {
    const res = await fetch('/api/config/threshold', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        threshold,
        facultyId: facultyId || 'faculty-admin',
        reason: reason || 'Calibrated verification update',
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Fetches all registered students from SQLite backend.
 */
export async function fetchStudentsFromBackend(): Promise<any[] | null> {
  try {
    const res = await fetch('/api/students');
    if (!res.ok) return null;
    const data = await res.json();
    return data.students || [];
  } catch {
    return null;
  }
}

/**
 * Syncs student record to SQLite backend.
 */
export async function saveStudentToBackend(student: {
  id?: string;
  prn: string;
  rollNo: number;
  name: string;
  email?: string;
  department?: string;
  semester?: string;
  batch?: string;
  avatarUrl?: string;
  overallAttendance?: number;
}): Promise<boolean> {
  try {
    const res = await fetch('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(student),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Deletes student record from SQLite backend.
 */
export async function deleteStudentFromBackend(prn: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/students/${encodeURIComponent(prn.trim().toUpperCase())}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Records a faculty manual attendance override.
 */
export async function submitAttendanceOverride(overrideData: {
  sessionId: string;
  periodNumber: number;
  date: string;
  studentPrn: string;
  studentName: string;
  newStatus: 'PRESENT' | 'ABSENT';
  teacherId: string;
  teacherName: string;
  reason: string;
  customNote?: string;
}): Promise<boolean> {
  try {
    const res = await fetch('/api/attendance/override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(overrideData),
    });
    return res.ok;
  } catch {
    return false;
  }
}
