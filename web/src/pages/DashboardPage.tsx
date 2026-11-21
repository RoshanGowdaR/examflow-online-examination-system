import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  CalendarDays,
  ChartNoAxesCombined,
  ClipboardList,
  Clock3,
  GraduationCap,
  LogOut,
  Plus,
  ShieldCheck,
  Award,
  Sparkles,
  BarChart3,
  Settings,
  UserCheck,
  User,
  Home,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { FacultyManagementView } from '../components/FacultyManagementView';
import { StudentManagementView } from '../components/StudentManagementView';
import { CourseManagementView } from '../components/CourseManagementView';
import { ExamManagementView } from '../components/ExamManagementView';
import { StudentExamsView } from '../components/StudentExamsView';
import { ResultsView } from '../components/ResultsView';
import { ExamEditorModal } from '../components/ExamEditorModal';
import { CourseModal } from '../components/CourseModal';
import { getFacultyUsers, getStudentUsers } from '../services/users';
import { getAllCourses } from '../services/courses';
import { getExams } from '../services/exams';
import { getAllResults, getStudentResults } from '../services/results';
import { isGradingApiConfigured, gradingApiUrl } from '../services/gradingApi';
import type { Exam } from '../types';

export function DashboardPage() {
  const { user, profile, signOutUser } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Modals
  const [isExamModalOpen, setIsExamModalOpen] = useState(false);
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);

  // Live Stats & Recent Data
  const [facultyCount, setFacultyCount] = useState<number | string>('—');
  const [studentCount, setStudentCount] = useState<number | string>('—');
  const [courseCount, setCourseCount] = useState<number | string>('—');
  const [examCount, setExamCount] = useState<number | string>('—');
  const [resultCount, setResultCount] = useState<number | string>('—');
  const [recentExams, setRecentExams] = useState<Exam[]>([]);

  useEffect(() => {
    async function loadStats() {
      if (!profile || !user) return;
      try {
        const [cList, eList, rList] = await Promise.all([
          getAllCourses().catch(() => []),
          getExams(profile.role, profile.uid).catch(() => []),
          profile.role === 'student' ? getStudentResults(user.uid).catch(() => []) : getAllResults().catch(() => []),
        ]);

        setCourseCount(cList.length);
        setExamCount(eList.length);
        setResultCount(rList.length);
        setRecentExams(eList.slice(0, 4));

        if (profile.role === 'admin') {
          const [fList, sList] = await Promise.all([
            getFacultyUsers().catch(() => []),
            getStudentUsers().catch(() => []),
          ]);
          setFacultyCount(fList.length);
          setStudentCount(sList.length);
        } else if (profile.role === 'faculty') {
          const sList = await getStudentUsers().catch(() => []);
          setStudentCount(sList.length);
        }
      } catch (err) {
        console.error('Failed to load stats', err);
      }
    }
    loadStats();
  }, [profile, user]);

  if (!profile) return null;

  const role = profile.role;
  const isApiReady = isGradingApiConfigured();

  return (
    <div className="app-shell">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="brand" onClick={() => navigate('/')} style={{ cursor: 'pointer' }} title="ExamFlow Landing Page">
          <span className="brand-mark"><BookOpen size={21} /></span>
          <span>ExamFlow</span>
        </div>

        <div className="sidebar-label">WORKSPACE</div>

        {/* 1. Admin Sidebar Items */}
        {role === 'admin' && (
          <>
            <button
              className={`side-link ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <ChartNoAxesCombined size={18} /> Dashboard
            </button>
            <button
              className={`side-link ${activeTab === 'faculty' ? 'active' : ''}`}
              onClick={() => setActiveTab('faculty')}
            >
              <UserCheck size={18} /> Faculty Management
            </button>
            <button
              className={`side-link ${activeTab === 'students' ? 'active' : ''}`}
              onClick={() => setActiveTab('students')}
            >
              <GraduationCap size={18} /> Student Management
            </button>
            <button
              className={`side-link ${activeTab === 'courses' ? 'active' : ''}`}
              onClick={() => setActiveTab('courses')}
            >
              <BookOpen size={18} /> Courses
            </button>
            <button
              className={`side-link ${activeTab === 'exams' ? 'active' : ''}`}
              onClick={() => setActiveTab('exams')}
            >
              <ClipboardList size={18} /> Examinations
            </button>
            <button
              className={`side-link ${activeTab === 'results' ? 'active' : ''}`}
              onClick={() => setActiveTab('results')}
            >
              <Award size={18} /> Results
            </button>
            <button
              className={`side-link ${activeTab === 'reports' ? 'active' : ''}`}
              onClick={() => setActiveTab('reports')}
            >
              <BarChart3 size={18} /> Reports
            </button>
            <button
              className={`side-link ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              <Settings size={18} /> Settings
            </button>
          </>
        )}

        {/* 2. Faculty Sidebar Items */}
        {role === 'faculty' && (
          <>
            <button
              className={`side-link ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <ChartNoAxesCombined size={18} /> Dashboard
            </button>
            <button
              className={`side-link ${activeTab === 'students' ? 'active' : ''}`}
              onClick={() => setActiveTab('students')}
            >
              <GraduationCap size={18} /> Student Management
            </button>
            <button
              className={`side-link ${activeTab === 'courses' ? 'active' : ''}`}
              onClick={() => setActiveTab('courses')}
            >
              <BookOpen size={18} /> My Courses
            </button>
            <button
              className={`side-link ${activeTab === 'exams' ? 'active' : ''}`}
              onClick={() => setActiveTab('exams')}
            >
              <ClipboardList size={18} /> Examinations
            </button>
            <button
              className={`side-link ${activeTab === 'results' ? 'active' : ''}`}
              onClick={() => setActiveTab('results')}
            >
              <Award size={18} /> Results
            </button>
            <button
              className={`side-link ${activeTab === 'reports' ? 'active' : ''}`}
              onClick={() => setActiveTab('reports')}
            >
              <BarChart3 size={18} /> Analytics
            </button>
            <button
              className={`side-link ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              <User size={18} /> Profile
            </button>
          </>
        )}

        {/* 3. Student Sidebar Items */}
        {role === 'student' && (
          <>
            <button
              className={`side-link ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <ChartNoAxesCombined size={18} /> Dashboard
            </button>
            <button
              className={`side-link ${activeTab === 'exams' ? 'active' : ''}`}
              onClick={() => setActiveTab('exams')}
            >
              <ClipboardList size={18} /> Available Exams
            </button>
            <button
              className={`side-link ${activeTab === 'results' ? 'active' : ''}`}
              onClick={() => setActiveTab('results')}
            >
              <Award size={18} /> Results & History
            </button>
            <button
              className={`side-link ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              <User size={18} /> My Profile
            </button>
          </>
        )}

        <div className="sidebar-bottom">
          <button
            type="button"
            className="side-link"
            onClick={() => navigate('/')}
            style={{ width: '100%', marginBottom: '8px', color: '#93c5fd', background: 'rgba(255, 255, 255, 0.05)' }}
            title="Return to ExamFlow Landing Page"
          >
            <Home size={17} /> Landing Page
          </button>
          <div className="cloud-status">
            <span className="status-dot" style={{ background: isApiReady ? '#36c98f' : '#f59e0b' }} />
            {isApiReady ? 'Firebase + AWS Active' : 'Firebase Connected'}
          </div>
          <button className="logout-button" onClick={() => void signOutUser()}>
            <LogOut size={17} /> Sign out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="topbar">
          <div>
            <span className="topbar-caption">ONLINE EXAMINATION MANAGEMENT SYSTEM</span>
            <h1 style={{ textTransform: 'capitalize' }}>
              {activeTab === 'dashboard'
                ? 'Overview'
                : activeTab === 'faculty'
                ? 'Faculty Management'
                : activeTab === 'students'
                ? 'Student Management'
                : activeTab}
            </h1>
          </div>
          <div className="profile-chip">
            <div className="avatar">{profile.name.slice(0, 1).toUpperCase()}</div>
            <div>
              <strong>{profile.name}</strong>
              <span className={`badge badge-role-${profile.role}`}>{profile.role}</span>
            </div>
          </div>
        </header>

        {/* Tab: Dashboard Overview (Clean Minimalism & Bento Grid) */}
        {activeTab === 'dashboard' && (
          <div className="bento-grid">
            {/* Bento Tile 1: Hero Welcome Banner (span 12) */}
            <div className="bento-card bento-hero">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <span className={`badge badge-role-${role}`} style={{ fontWeight: 700, letterSpacing: '0.5px' }}>
                    {role.toUpperCase()} WORKSPACE
                  </span>
                  <span className="bento-chip bento-chip-emerald">
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                    Platform Active
                  </span>
                </div>
                <h2 style={{ fontFamily: 'Manrope, sans-serif', fontSize: '28px', fontWeight: 800, margin: '0 0 6px', letterSpacing: '-0.8px' }}>
                  Welcome back, {profile.name}
                </h2>
                <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0, maxWidth: '580px', lineHeight: 1.5 }}>
                  {role === 'admin'
                    ? 'Oversee university faculties, enroll students, and monitor AI-powered examinations.'
                    : role === 'faculty'
                    ? 'Manage your course curriculum, enroll students, and generate assessments using Gemini AI.'
                    : 'Track your enrolled curriculum, participate in timed online tests, and view instant grades.'}
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
                <div className="date-chip" style={{ background: 'rgba(255,255,255,0.08)', borderColor: '#334155', color: '#e2e8f0' }}>
                  <CalendarDays size={15} /> Academic Session 2026
                </div>
                {(role === 'admin' || role === 'faculty') && (
                  <button
                    className="btn btn-primary"
                    style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', border: 0, boxShadow: '0 4px 14px rgba(37,99,235,0.4)' }}
                    onClick={() => setIsExamModalOpen(true)}
                  >
                    <Plus size={16} /> Create Examination
                  </button>
                )}
              </div>
            </div>

            {/* Bento Tile 2: Primary Metric Card */}
            <div
              className="bento-card bento-stat"
              onClick={() => setActiveTab(role === 'admin' ? 'faculty' : role === 'faculty' ? 'students' : 'exams')}
            >
              <div className="stat-top">
                <span style={{ textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700, fontSize: '10px' }}>
                  {role === 'admin' ? 'Faculty Members' : role === 'faculty' ? 'Enrolled Students' : 'Available Exams'}
                </span>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: '#f5f3ff', color: '#7c3aed', display: 'grid', placeItems: 'center' }}>
                  {role === 'admin' ? <UserCheck size={18} /> : role === 'faculty' ? <GraduationCap size={18} /> : <ClipboardList size={18} />}
                </div>
              </div>
              <strong className="stat-value">{role === 'admin' ? facultyCount : role === 'faculty' ? studentCount : examCount}</strong>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                <span className="stat-note">
                  {role === 'admin' ? 'Active instructors' : role === 'faculty' ? 'Department cohorts' : 'Ready to attempt'}
                </span>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#7c3aed', display: 'flex', alignItems: 'center', gap: 2 }}>
                  Manage &rarr;
                </span>
              </div>
            </div>

            {/* Bento Tile 3: Secondary Metric Card */}
            <div
              className="bento-card bento-stat"
              onClick={() => setActiveTab(role === 'admin' ? 'students' : role === 'faculty' ? 'courses' : 'results')}
            >
              <div className="stat-top">
                <span style={{ textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700, fontSize: '10px' }}>
                  {role === 'admin' ? 'Total Students' : role === 'faculty' ? 'Assigned Courses' : 'Completed Tests'}
                </span>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: '#eff6ff', color: '#2563eb', display: 'grid', placeItems: 'center' }}>
                  {role === 'admin' ? <GraduationCap size={18} /> : role === 'faculty' ? <BookOpen size={18} /> : <Award size={18} />}
                </div>
              </div>
              <strong className="stat-value">{role === 'admin' ? studentCount : role === 'faculty' ? courseCount : resultCount}</strong>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                <span className="stat-note">
                  {role === 'admin' ? 'Verified accounts' : role === 'faculty' ? 'Curriculum subjects' : 'Automated grading'}
                </span>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#2563eb', display: 'flex', alignItems: 'center', gap: 2 }}>
                  View &rarr;
                </span>
              </div>
            </div>

            {/* Bento Tile 4: Tertiary Metric Card */}
            <div
              className="bento-card bento-stat"
              onClick={() => setActiveTab('exams')}
            >
              <div className="stat-top">
                <span style={{ textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700, fontSize: '10px' }}>
                  {role === 'student' ? 'Examination Mode' : 'Examinations'}
                </span>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: '#ecfdf5', color: '#059669', display: 'grid', placeItems: 'center' }}>
                  {role === 'student' ? <Clock3 size={18} /> : <ClipboardList size={18} />}
                </div>
              </div>
              <strong className="stat-value">{examCount}</strong>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                <span className="stat-note">
                  {role === 'student' ? 'Live countdown enabled' : 'Published & draft exams'}
                </span>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#059669', display: 'flex', alignItems: 'center', gap: 2 }}>
                  Explore &rarr;
                </span>
              </div>
            </div>

            {/* Bento Tile 5: Featured Gemini AI Exam Studio (span 7) */}
            <div className="bento-card bento-ai">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span className="bento-chip bento-chip-purple">
                      <Sparkles size={13} />
                      GEMINI 1.5 FLASH ENGINE
                    </span>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Syllabus-Aligned</span>
                  </div>
                  <h3 style={{ fontFamily: 'Manrope, sans-serif', fontSize: '19px', fontWeight: 700, margin: '0 0 6px', color: '#1e1b4b' }}>
                    AI-Powered Examination Creator
                  </h3>
                  <p style={{ fontSize: '13px', color: '#64748b', margin: 0, maxWidth: '480px', lineHeight: 1.5 }}>
                    Generate calibrated objective questions with difficulty balancing, distractors, and automated server-side answer keys.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', margin: '16px 0 20px' }}>
                {['Cloud Architecture', 'Operating Systems', 'Database Systems', 'Algorithms'].map((tag) => (
                  <span
                    key={tag}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e9d5ff',
                      color: '#6b21a8',
                      borderRadius: '8px',
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: 500,
                    }}
                  >
                    #{tag}
                  </span>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  className="btn btn-primary"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', border: 0, boxShadow: '0 4px 14px rgba(124,58,237,0.3)' }}
                  onClick={() => setIsExamModalOpen(true)}
                >
                  <Sparkles size={16} /> Open AI Exam Creator
                </button>
                <button className="btn btn-secondary" onClick={() => setActiveTab('exams')}>
                  Browse Question Bank
                </button>
              </div>
            </div>

            {/* Bento Tile 6: Quick Action Shortcuts (span 5) */}
            <div className="bento-card bento-actions">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <p className="eyebrow" style={{ margin: 0 }}>QUICK SHORTCUTS</p>
                  <h3 style={{ fontFamily: 'Manrope, sans-serif', fontSize: '16px', margin: '4px 0 0' }}>Workspace Actions</h3>
                </div>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f1f5f9', color: '#475569', display: 'grid', placeItems: 'center' }}>
                  <Plus size={16} />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {role === 'admin' && (
                  <>
                    <button className="bento-shortcut-item" onClick={() => setActiveTab('faculty')}>
                      <span>+ Provision Faculty Member</span>
                      <span>&rarr;</span>
                    </button>
                    <button className="bento-shortcut-item" onClick={() => setActiveTab('students')}>
                      <span>+ Enroll Student Account</span>
                      <span>&rarr;</span>
                    </button>
                    <button className="bento-shortcut-item" onClick={() => setIsCourseModalOpen(true)}>
                      <span>+ Add Course Curriculum</span>
                      <span>&rarr;</span>
                    </button>
                    <button className="bento-shortcut-item" onClick={() => setIsExamModalOpen(true)}>
                      <span>✨ Author Exam with AI</span>
                      <span>&rarr;</span>
                    </button>
                  </>
                )}

                {role === 'faculty' && (
                  <>
                    <button className="bento-shortcut-item" onClick={() => setActiveTab('students')}>
                      <span>+ Enroll Students in My Courses</span>
                      <span>&rarr;</span>
                    </button>
                    <button className="bento-shortcut-item" onClick={() => setIsExamModalOpen(true)}>
                      <span>✨ AI Assessment Generator</span>
                      <span>&rarr;</span>
                    </button>
                    <button className="bento-shortcut-item" onClick={() => setActiveTab('courses')}>
                      <span>View Assigned Subjects</span>
                      <span>&rarr;</span>
                    </button>
                    <button className="bento-shortcut-item" onClick={() => setActiveTab('results')}>
                      <span>Review Submissions & Grades</span>
                      <span>&rarr;</span>
                    </button>
                  </>
                )}

                {role === 'student' && (
                  <>
                    <button className="bento-shortcut-item" onClick={() => setActiveTab('exams')}>
                      <span>Take Active Examination</span>
                      <span>&rarr;</span>
                    </button>
                    <button className="bento-shortcut-item" onClick={() => setActiveTab('results')}>
                      <span>Review Scorecards & Feedback</span>
                      <span>&rarr;</span>
                    </button>
                    <button className="bento-shortcut-item" onClick={() => setActiveTab('profile')}>
                      <span>My Enrolled Courses & Profile</span>
                      <span>&rarr;</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Bento Tile 7: Recent Assessments (span 7) */}
            <div className="bento-card bento-recent">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <p className="eyebrow" style={{ margin: 0 }}>ASSESSMENT ACTIVITY</p>
                  <h3 style={{ fontFamily: 'Manrope, sans-serif', fontSize: '16px', margin: '4px 0 0' }}>Recent Examinations</h3>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab('exams')}>
                  View All &rarr;
                </button>
              </div>

              {recentExams.length > 0 ? (
                <div>
                  {recentExams.map((ex) => (
                    <div key={ex.id} className="bento-exam-item">
                      <div>
                        <strong style={{ display: 'block', fontSize: '13px', color: '#1e293b' }}>{ex.title}</strong>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                          {ex.courseName || 'General Assessment'} · {ex.durationMinutes} mins · {ex.totalMarks} marks
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className={`badge badge-status-${ex.status}`}>{ex.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '30px 10px', color: '#64748b' }}>
                  <ClipboardList size={30} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                  <p style={{ margin: 0, fontSize: '13px' }}>No examinations scheduled yet.</p>
                  <button className="btn btn-secondary btn-sm" style={{ marginTop: '12px' }} onClick={() => setIsExamModalOpen(true)}>
                    Create First Exam
                  </button>
                </div>
              )}
            </div>

            {/* Bento Tile 8: Zero-Cost Architecture & Health (span 5) */}
            <div className="bento-card bento-infra">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <p className="eyebrow" style={{ margin: 0 }}>HYBRID INFRASTRUCTURE</p>
                  <h3 style={{ fontFamily: 'Manrope, sans-serif', fontSize: '16px', margin: '4px 0 0' }}>Zero-Cost Cloud Status</h3>
                </div>
                <ShieldCheck size={20} color="#059669" />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { name: 'Firebase Cloud Firestore', value: 'Spark Free Plan', status: 'Online' },
                  { name: 'Firebase Authentication', value: 'Role Hierarchy Active', status: 'Protected' },
                  { name: 'Google Gemini AI API', value: 'Gemini 1.5 Flash', status: 'Connected' },
                  { name: 'Container Architecture', value: 'Alpine Multi-Stage', status: 'Production Ready' },
                  { name: 'Deployment Target', value: 'Amazon ECR & Render', status: 'Zero-Cost' },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: '#f8fafc',
                      borderRadius: '8px',
                      fontSize: '11px',
                    }}
                  >
                    <div>
                      <strong style={{ display: 'block', color: '#1e293b' }}>{item.name}</strong>
                      <span style={{ color: '#64748b' }}>{item.value}</span>
                    </div>
                    <span className="bento-chip bento-chip-emerald" style={{ fontSize: '10px', padding: '2px 8px' }}>
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab: Faculty Management (Admin only) */}
        {activeTab === 'faculty' && role === 'admin' && <FacultyManagementView />}

        {/* Tab: Student Management (Admin or Faculty) */}
        {activeTab === 'students' && (role === 'admin' || role === 'faculty') && <StudentManagementView />}

        {/* Tab: Courses (Admin or Faculty) */}
        {activeTab === 'courses' && <CourseManagementView />}

        {/* Tab: Examinations */}
        {activeTab === 'exams' && (role === 'student' ? <StudentExamsView /> : <ExamManagementView />)}

        {/* Tab: Results */}
        {activeTab === 'results' && <ResultsView />}

        {/* Tab: Reports / Analytics */}
        {activeTab === 'reports' && (
          <div className="panel" style={{ maxWidth: '800px' }}>
            <div className="panel-heading">
              <div>
                <p className="eyebrow">METRICS & ANALYTICS</p>
                <h3>Platform Execution Reports</h3>
              </div>
              <BarChart3 size={20} color="#2558a7" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', margin: '20px 0' }}>
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '11px', color: '#64748b' }}>TOTAL ASSESSMENTS</span>
                <strong style={{ fontSize: '24px', display: 'block', color: '#1e293b', marginTop: '4px' }}>{examCount}</strong>
              </div>
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '11px', color: '#64748b' }}>TOTAL SUBMISSIONS</span>
                <strong style={{ fontSize: '24px', display: 'block', color: '#1e293b', marginTop: '4px' }}>{resultCount}</strong>
              </div>
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '11px', color: '#64748b' }}>ACTIVE COURSES</span>
                <strong style={{ fontSize: '24px', display: 'block', color: '#1e293b', marginTop: '4px' }}>{courseCount}</strong>
              </div>
            </div>

            <p style={{ fontSize: '12px', color: '#475467', lineHeight: '1.6' }}>
              All examination submissions are recorded in Firestore collection <code>results</code> and evaluated server-side by AWS Lambda. Audit trails for account creation and submissions are stored under <code>auditEvents</code>.
            </p>
          </div>
        )}

        {/* Tab: Settings (Admin) */}
        {activeTab === 'settings' && role === 'admin' && (
          <div className="panel" style={{ maxWidth: '800px' }}>
            <div className="panel-heading">
              <div>
                <p className="eyebrow">CONFIGURATION</p>
                <h3>System & Cloud Settings</h3>
              </div>
              <Settings size={20} color="#2558a7" />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '14px' }}>
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <strong>AWS Lambda & API Gateway Endpoint</strong>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 8px' }}>
                  Base URL used for server-side grading, account creation, and Gemini AI exam generation.
                </p>
                <code style={{ fontSize: '12px', color: '#2558a7', background: '#eff6ff', padding: '4px 8px', borderRadius: '4px' }}>
                  {gradingApiUrl || 'VITE_AWS_GRADING_API_URL not set in web/.env'}
                </code>
              </div>

              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <strong>Gemini AI Generation Engine</strong>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0' }}>
                  AI questions are generated on AWS Lambda via <code>GEMINI_API_KEY</code> environment variable without exposing secrets in frontend code.
                </p>
              </div>

              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <strong>Hierarchical Role Provisioning</strong>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0' }}>
                  Admin provisions Faculty &rarr; Faculty enrolls Students. Accounts are created server-side with zero credential sharing.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Profile (Faculty or Student) */}
        {activeTab === 'profile' && (
          <div className="panel" style={{ maxWidth: '720px' }}>
            <div className="panel-heading">
              <div>
                <p className="eyebrow">USER PROFILE</p>
                <h3>Account Information</h3>
              </div>
              <User size={20} color="#2558a7" />
            </div>

            <div style={{ display: 'flex', gap: '20px', alignItems: 'center', margin: '20px 0', borderBottom: '1px solid #f1f5f9', paddingBottom: '20px' }}>
              <div className="avatar" style={{ width: '64px', height: '64px', fontSize: '24px' }}>
                {profile.name.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <h3 style={{ margin: 0, fontFamily: 'Manrope, sans-serif' }}>{profile.name}</h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>{profile.email}</span>
                <div style={{ marginTop: '6px' }}>
                  <span className={`badge badge-role-${profile.role}`}>{profile.role}</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', fontSize: '12px' }}>
              {role === 'faculty' && (
                <>
                  <div>
                    <span style={{ color: '#64748b', display: 'block' }}>Employee ID</span>
                    <strong>{profile.employeeId || 'FAC-001'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block' }}>Department</span>
                    <strong>{profile.department || 'Computer Science & Engineering'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block' }}>Assigned Courses</span>
                    <strong>
                      {profile.assignedCourses && profile.assignedCourses.length > 0
                        ? profile.assignedCourses.join(', ')
                        : 'All Department Courses'}
                    </strong>
                  </div>
                </>
              )}

              {role === 'student' && (
                <>
                  <div>
                    <span style={{ color: '#64748b', display: 'block' }}>USN / Roll Number</span>
                    <strong style={{ color: '#1d4ed8' }}>{profile.usn || profile.rollNumber || 'Not assigned'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block' }}>Department</span>
                    <strong>{profile.department || 'Computer Science & Engineering'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block' }}>Semester</span>
                    <strong>Semester {profile.semester || '6'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block' }}>Enrolled Courses</span>
                    <strong>
                      {profile.courseIds && profile.courseIds.length > 0
                        ? profile.courseIds.join(', ')
                        : 'General Curriculum'}
                    </strong>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <footer className="page-footer">
          Group 12 · Bharath Kumar S · Hemanth Gowda · Roshan Gowda
        </footer>
      </main>

      {/* Global Modals */}
      <ExamEditorModal
        isOpen={isExamModalOpen}
        onClose={() => setIsExamModalOpen(false)}
        onSaved={() => {
          setActiveTab('exams');
        }}
      />

      <CourseModal
        isOpen={isCourseModalOpen}
        onClose={() => setIsCourseModalOpen(false)}
        onCreated={() => {
          setActiveTab('courses');
        }}
      />
    </div>
  );
}
