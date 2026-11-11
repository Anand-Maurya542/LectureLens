import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import {
  GraduationCap,
  BookOpen,
  Video,
  PlayCircle,
  HelpCircle,
  Search,
  Sparkles,
  Plus,
  Brain,
  ArrowRight,
  Clock,
  CheckCircle2,
} from "lucide-react";

export default function StudentDashboard() {
  const [courses, setCourses] = useState([]);
  const [lectures, setLectures] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [myEnrollments, setMyEnrollments] = useState([]);
  const [enrollCode, setEnrollCode] = useState("");
  const [enrolling, setEnrolling] = useState(false);
  const [enrollMessage, setEnrollMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [coursesData, lecturesData, recsData, enrollmentsData] = await Promise.all([
        api.getCourses(false),
        api.getLectures(),
        api.getRevisionRecommendations(),
        api.getMyEnrollments(),
      ]);
      setCourses(coursesData || []);
      setLectures(lecturesData || []);
      setRecommendations(recsData || []);
      setMyEnrollments(enrollmentsData || []);
    } catch (err) {
      console.error("Failed to load student dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleEnroll = async (e) => {
    e.preventDefault();
    if (!enrollCode.trim() || enrolling) return;
    const code = enrollCode.trim().toUpperCase();
    setEnrolling(true);
    setEnrollMessage("");
    try {
      await api.enrollCourse(code);
      setEnrollMessage(`Course joining request for ${code} submitted! Waiting for administrator approval.`);
      setEnrollCode("");
      await loadData();
    } catch (err) {
      setEnrollMessage(err.message || "Invalid course code. Please check and try again.");
    } finally {
      setEnrolling(false);
    }
  };

  if (loading) {
    return <div className="page-loading"><div className="spinner" /> Loading your learning hub...</div>;
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div>
          <h1>Student Learning Hub</h1>
          <p>Access your courses, watch lectures with interactive transcripts, and ask questions.</p>
        </div>
        <div className="header-actions">
          <Link to="/student/courses" className="btn-secondary">
            <BookOpen size={16} />
            Explore Courses
          </Link>
          <Link to="/student/search" className="btn-secondary">
            <Search size={16} />
            Search & Ask Questions
          </Link>
        </div>
      </div>

      {/* Pending Requests Alert */}
      {myEnrollments.some((e) => e.status === "pending") && (
        <div
          style={{
            background: "linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(245, 158, 11, 0.04) 100%)",
            border: "1px solid rgba(245, 158, 11, 0.35)",
            borderRadius: "12px",
            padding: "14px 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "14px",
            marginBottom: "20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Clock size={22} style={{ color: "#d97706" }} />
            <div>
              <strong style={{ display: "block", color: "var(--text-main, #0f172a)" }}>
                Course Joining Request Pending Review
              </strong>
              <span style={{ fontSize: "0.84rem", color: "var(--text-muted, #64748b)" }}>
                You have {myEnrollments.filter((e) => e.status === "pending").length} course joining request(s) waiting for approval.
              </span>
            </div>
          </div>
          <Link to="/student/courses" className="btn-secondary btn-sm" style={{ textDecoration: "none" }}>
            View Status →
          </Link>
        </div>
      )}

      {/* Quick Course Enrollment Card */}
      <div className="quick-enroll-card">
        <div className="quick-enroll-info">
          <div className="quick-enroll-icon">
            <Plus size={22} />
          </div>
          <div>
            <h4>Join a Course</h4>
            <p>Enter the course code shared by your teacher to request access.</p>
          </div>
        </div>
        <form onSubmit={handleEnroll} className="quick-enroll-form">
          <div className="quick-enroll-input-wrapper">
            <input
              type="text"
              placeholder="e.g. CS401"
              value={enrollCode}
              onChange={(e) => setEnrollCode(e.target.value)}
              className="quick-enroll-input"
            />
          </div>
          <button
            type="submit"
            disabled={enrolling || !enrollCode.trim()}
            className="btn-primary"
            style={{ whiteSpace: "nowrap" }}
          >
            {enrolling ? "Joining..." : "Join Course"}
          </button>
        </form>
      </div>

      {enrollMessage && (
        <div
          className={`mb-4 ${
            enrollMessage.toLowerCase().includes("invalid") ||
            enrollMessage.toLowerCase().includes("failed") ||
            enrollMessage.toLowerCase().includes("error")
              ? "alert-error"
              : "alert-success"
          }`}
          style={{ display: "flex", alignItems: "center", gap: "8px" }}
        >
          <CheckCircle2 size={16} />
          <span>{enrollMessage}</span>
        </div>
      )}

      {/* Study Recommendations Banner */}
      {recommendations.length > 0 && (
        <div className="revision-highlight-card">
          <div className="revision-header">
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "8px",
                  background: "#f3e8ff",
                  color: "#9333ea",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Brain size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Recommended Study Focus</h3>
                <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-muted, #64748b)" }}>
                  Topics recommended for you based on your quiz practice
                </p>
              </div>
            </div>
            <Link to="/student/revision" className="btn-link" style={{ fontWeight: 600, fontSize: "0.88rem" }}>
              View Study Plan →
            </Link>
          </div>
          <div className="recommendations-row">
            {recommendations.slice(0, 3).map((rec, i) => (
              <div key={i} className="rec-card">
                <div>
                  <span className="rec-lecture-tag">{rec.lecture_title}</span>
                  <h4 className="rec-topic">{rec.topic_title}</h4>
                  <p className="rec-reason">{rec.reason}</p>
                </div>
                <Link to={rec.timestamp_url} className="btn-rec-action">
                  <PlayCircle size={15} />
                  <span>Watch Explanation at {Math.floor(rec.suggested_start_time / 60)}m</span>
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Enrolled Courses */}
      <div className="dashboard-section">
        <div className="section-header">
          <h2>My Courses</h2>
        </div>

        {courses.length === 0 ? (
          <div className="empty-state">
            <BookOpen size={48} />
            <h3>You haven't joined any courses yet</h3>
            <p>Enter a course code above (e.g. <code>CS401</code>) or explore available courses to join.</p>
            <Link to="/student/courses" className="btn-primary" style={{ marginTop: "14px", display: "inline-flex", alignItems: "center", gap: "8px", textDecoration: "none" }}>
              <BookOpen size={16} />
              Explore Courses
            </Link>
          </div>
        ) : (
          <div className="courses-grid">
            {courses.map((c) => (
              <div key={c.id} className="course-card student">
                <div className="course-icon"><BookOpen size={20} /></div>
                <h3 className="course-title">{c.title}</h3>
                <p className="course-desc">{c.description || "Course materials & lectures."}</p>
                <div className="course-card-footer">
                  <span>Teacher: {c.teacher_name || "Faculty"}</span>
                  <span className="font-semibold">{c.lecture_count} Lectures</span>
                </div>
                <div className="mt-3 pt-3 border-t">
                  <Link
                    to={`/student/courses/${c.id}`}
                    className="btn-primary w-full justify-center flex items-center gap-2"
                    style={{ textDecoration: "none", fontSize: "0.85rem", padding: "8px 12px" }}
                  >
                    <span>Open Course</span>
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Available Published Lectures */}
      <div className="dashboard-section mt-8">
        <div className="section-header">
          <h2>Recent Lectures</h2>
        </div>

        {lectures.length === 0 ? (
          <div className="empty-state">
            <Video size={48} />
            <h3>No lectures available yet</h3>
            <p>Your teachers will publish lectures here once they are ready.</p>
          </div>
        ) : (
          <div className="lectures-student-grid">
            {lectures.map((lec) => (
              <div key={lec.id} className="lecture-student-card">
                <div className="lecture-card-banner">
                  <span className="source-badge">
                    {lec.source_type === "youtube" ? "📺 YouTube" : "📁 Recording"}
                  </span>
                  <span className="course-pill">{lec.course_title}</span>
                </div>

                <h3 className="lecture-title">{lec.title}</h3>
                <p className="lecture-desc">
                  {lec.description || "Interactive transcript, lecture topics, and practice questions."}
                </p>

                <div className="lecture-card-stats">
                  <span>{lec.topics?.length || 0} Topics</span>
                  <span>·</span>
                  <span>{lec.segments?.length || 0} Segments</span>
                </div>

                <div className="lecture-card-actions">
                  <Link to={`/student/lectures/${lec.id}`} className="btn-primary w-full justify-center">
                    <PlayCircle size={17} />
                    <span>Watch Lecture</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

