// ─── Domain types matching the DB schema ─────────────────────────────────────

export type ShiftStatus = 'pending' | 'approved' | 'cancelled' | 'called_out';

export interface Student {
  id: string;
  name: string;
  student_id: string;   // e.g. "S001"
  program: string;
  cohort: string;
  created_at: string;
}

export interface Shift {
  id: string;
  student_id: string;
  date: string;         // ISO date "YYYY-MM-DD"
  start_time: string;   // "HH:MM"
  end_time: string;     // "HH:MM"
  clinic: string;
  notes: string | null;
  status: ShiftStatus;
  override_cap: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields (from API responses)
  student?: Student;
}

export interface Callout {
  id: string;
  shift_id: string;
  student_id: string;
  reason: string;
  photo_url: string | null;
  created_at: string;
  // Joined fields
  shift?: Shift;
  student?: Student;
}

export interface Settings {
  max_per_day: number;
  max_concurrent: number;
  auto_approve: boolean;
  updated_at: string;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface StudentJwtPayload {
  sub: string;          // student.id (UUID)
  student_id: string;   // e.g. "S001"
  name: string;
  program: string;
  cohort: string;
  iat: number;
  exp: number;
}

// ─── API request/response shapes ─────────────────────────────────────────────

export interface BookShiftBody {
  date: string;
  start_time: string;
  end_time: string;
  clinic: string;
  notes?: string;
}

export interface CalloutBody {
  shift_id: string;
  reason: string;
  photo_base64?: string;       // optional photo from OCR import
  photo_mime?: string;         // e.g. "image/jpeg"
}

export interface OcrResult {
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  clinic: string | null;
  notes: string | null;
  raw_text: string;
  confidence: 'high' | 'medium' | 'low';
  /** True when ANTHROPIC_API_KEY is unset and sample data was returned instead */
  demoMode?: boolean;
}

export interface ApiError {
  error: string;
}

export interface Admin {
  id: string;
  email: string;
  created_at: string;
}
