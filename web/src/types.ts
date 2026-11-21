export type UserRole = 'admin' | 'faculty' | 'student';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  department?: string;
  employeeId?: string;
  contactNumber?: string;
  assignedCourses?: string[]; // Course IDs or codes
  usn?: string;
  rollNumber?: string;
  registrationNumber?: string;
  semester?: string;
  courseIds?: string[];
  createdBy?: string;
  createdAt?: any;
}

export interface Course {
  id: string;
  name: string;
  code: string;
  description?: string;
  department?: string;
  assignedFacultyIds?: string[];
  assignedFacultyNames?: string[];
  active?: boolean;
  createdBy: string;
  createdAt?: any;
}

export type ExamStatus = 'draft' | 'published';

export interface Exam {
  id: string;
  title: string;
  description: string;
  courseId: string;
  courseName?: string;
  durationMinutes: number;
  totalMarks: number;
  status: ExamStatus;
  startsAt: string; // ISO string
  endsAt: string;   // ISO string
  createdBy: string;
  createdAt?: any;
  questionCount?: number;
}

export type QuestionType = 'single' | 'boolean' | 'multiple';

export interface QuestionOption {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  options: QuestionOption[];
  marks: number;
  order: number;
  correctAnswer?: string | string[]; // Stripped in student view
  explanation?: string;
  difficulty?: string;
}

export interface ExamResult {
  id: string;
  examId: string;
  examTitle: string;
  studentUid: string;
  studentEmail: string;
  score: number;
  totalMarks: number;
  correctCount: number;
  questionCount: number;
  percentage: number;
  submittedAt: any;
  status: 'submitted';
  breakdown?: Record<string, { answered: boolean; correct: boolean; marksAwarded: number }>;
}

export interface CreateFacultyPayload {
  name: string;
  email: string;
  employeeId: string;
  department: string;
  assignedCourses: string[];
  contactNumber?: string;
  active: boolean;
  initialPassword?: string;
}

export interface CreateStudentPayload {
  name: string;
  email: string;
  usn: string;
  registrationNumber?: string;
  department: string;
  semester: string;
  courseIds: string[];
  active: boolean;
  initialPassword?: string;
}

export interface AiGenerateExamPayload {
  subject: string;
  title?: string;
  topics?: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
  questionCount: number;
  questionTypes: ('single' | 'boolean')[];
  marksPerQuestion: number;
  durationMinutes?: number;
  additionalInstructions?: string;
}
