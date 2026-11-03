import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../../api/client";
import {
  BookOpen,
  Video,
  PlayCircle,
  HelpCircle,
  ChevronLeft,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  Search,
  Award,
} from "lucide-react";

export default function StudentCourseWorkspace() {
  const { id: courseId } = useParams();
  const [courseData, setCourseData] = useState(null);
  const [myAttempts, setMyAttempts] = useState([]);
  const [activeTab, setActiveTab] = useState("lectures"); // lectures | quizzes
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadWorkspace = async () => {
    try {
      const data = await api.getCourseContent(courseId);
      setCourseData(data);

      // Load my attempts in this course
      try {
        const attempts = await api.getMyCourseAttempts(courseId);
        setMyAttempts(attempts || []);
      } catch (err) {
        console.warn("Could not load course attempts:", err);
      }
    } catch (err) {
      setError(err.message || "Failed to load course workspace");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspace();
  }, [courseId]);

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" /> Loading course learning workspace...
      </div>
    );
  }

  if (error || !courseData) {
    return (
      <div className="dashboard-page max-w-5xl">
        <div className="alert-error mb-4">
          {error || "Access to this course is restricted. You must have an approved enrollment."}
        </div>
        <div className="flex gap-3">
          <Link to="/student/courses" className="btn-primary">
            Browse Available Courses
          </Link>
          <Link to="/student" className="btn-secondary">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const { course, lectures = [], quizzes = [] } = courseData;

  return (
    <div className="dashboard-page max-w-5xl">
      {/* Back Link */}
      <div className="mb-3">
        <Link
          to="/student/courses"
          className="text-sm font-semibold flex items-center gap-1 text-muted hover:text-primary"
          style={{ textDecoration: "none" }}
        >
          <ChevronLeft size={16} /> Back to Courses
        </Link>
      </div>

      {/* Course Header */}
      <div className="dashboard-header">
        <div>
          <div className="flex items-center gap-3">
            <h1>{course.title}</h1>
            <code style={{ fontSize: "0.88rem", padding: "2px 8px", background: "rgba(99, 102, 241, 0.1)", borderRadius: "6px" }}>
              {course.code}
            </code>
            <span className="badge badge-success flex items-center gap-1">
              <CheckCircle2 size={13} /> Enrolled
            </span>
          </div>
          <p className="mt-1">
            Instructor: <strong>{course.teacher_name || "Faculty"}</strong> · {course.description || "Course materials & quizzes."}
          </p>
        </div>
        <div className="header-actions">
          <Link to="/student/search" className="btn-secondary">
            <Search size={16} /> Search Transcripts
          </Link>
        </div>
      </div>

      {/* Workspace Tabs */}
      <div className="admin-nav-tabs mb-6">
        <button
          onClick={() => setActiveTab("lectures")}
          className={`tab-btn ${activeTab === "lectures" ? "active" : ""}`}
        >
          <Video size={17} />
          Published Lectures ({lectures.length})
        </button>
        <button
          onClick={() => setActiveTab("quizzes")}
          className={`tab-btn ${activeTab === "quizzes" ? "active" : ""}`}
        >
          <HelpCircle size={17} />
          Assessments & Quizzes ({quizzes.length})
        </button>
      </div>

      {/* TAB 1: PUBLISHED LECTURES */}
      {activeTab === "lectures" && (
        <div className="admin-tab-content">
          <div className="dashboard-section">
            <div className="section-header">
              <h2>Course Video Lectures</h2>
              <span className="badge-count">{lectures.length} Approved Lectures</span>
            </div>

            {lectures.length === 0 ? (
              <div className="empty-state">
                <Video size={44} style={{ opacity: 0.4 }} />
                <h3>No published lectures yet</h3>
                <p>Your instructor will publish lectures as course topics progress.</p>
              </div>
            ) : (
              <div className="lectures-student-grid">
                {lectures.map((lec) => (
                  <div key={lec.id} className="lecture-student-card">
                    <div className="lecture-card-banner">
                      <span className="source-badge">
                        {lec.source_type === "youtube" ? "📺 YouTube" : "📁 Recording"}
                      </span>
                      <span className="course-pill">{course.code}</span>
                    </div>

                    <h3 className="lecture-title">{lec.title}</h3>
                    <p className="lecture-desc">
                      {lec.description || "Interactive transcript, semantic vector search, and topic segments."}
                    </p>

                    <div className="lecture-card-stats">
                      <span>{lec.topics?.length || 0} Topics</span>
                      <span>·</span>
                      <span>{lec.segments?.length || 0} Segments</span>
                    </div>

                    <div className="lecture-card-actions">
                      <Link
                        to={`/student/lectures/${lec.id}`}
                        className="btn-primary w-full justify-center flex items-center gap-2"
                        style={{ textDecoration: "none" }}
                      >
                        <PlayCircle size={17} />
                        <span>Open Learning Workspace</span>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ASSESSMENTS & QUIZZES */}
      {activeTab === "quizzes" && (
        <div className="admin-tab-content">
          <div className="dashboard-section mb-6">
            <div className="section-header">
              <h2>Assigned Lecture Quizzes</h2>
              <span className="badge-count">{quizzes.length} Questions Available</span>
            </div>

            {quizzes.length === 0 ? (
              <div className="empty-state">
                <HelpCircle size={44} style={{ opacity: 0.4 }} />
                <h3>No quizzes available yet</h3>
                <p>Quizzes will appear as lectures are reviewed and published by your instructor.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {lectures.map((lec) => {
                  const lecQuizzes = quizzes.filter(
                    (q) => q.lecture_id === lec.id || q.course_id === courseId
                  );
                  if (lecQuizzes.length === 0) return null;

                  return (
                    <div
                      key={lec.id}
                      className="p-4 bg-white rounded-lg border flex justify-between items-center"
                    >
                      <div>
                        <h4 className="font-semibold text-main mb-1">{lec.title} Quiz</h4>
                        <div className="text-xs text-muted">
                          {lecQuizzes.length} approved question(s) · Instant evaluation & grounded explanations
                        </div>
                      </div>
                      <Link
                        to={`/student/lectures/${lec.id}/quiz`}
                        className="btn-primary flex items-center gap-2"
                        style={{ textDecoration: "none" }}
                      >
                        <Sparkles size={16} />
                        <span>Take Assessment</span>
                        <ArrowRight size={14} />
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Previous Attempts & Performance */}
          <div className="dashboard-section">
            <div className="section-header">
              <h2>My Assessment History</h2>
              <span className="badge-count">{myAttempts.length} Completed Attempts</span>
            </div>

            {myAttempts.length === 0 ? (
              <div className="empty-state">
                <Award size={36} style={{ opacity: 0.4 }} />
                <p>You haven't completed any assessments in this course yet.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Assessment</th>
                      <th>Score</th>
                      <th>Correct / Total</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myAttempts.map((att, idx) => (
                      <tr key={idx}>
                        <td>
                          <strong>{att.lecture_title || "Course Quiz"}</strong>
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              att.score >= 80 ? "badge-success" : att.score >= 50 ? "badge-warning" : "badge-danger"
                            }`}
                          >
                            {att.score}%
                          </span>
                        </td>
                        <td>
                          {att.correct_count} / {att.total_questions}
                        </td>
                        <td className="text-sm text-muted">
                          {att.created_at ? new Date(att.created_at).toLocaleString() : "Recent"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

