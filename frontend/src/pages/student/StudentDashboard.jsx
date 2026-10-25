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
} from "lucide-react";

export default function StudentDashboard() {
  const [courses, setCourses] = useState([]);
  const [lectures, setLectures] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [enrollCode, setEnrollCode] = useState("");
  const [enrolling, setEnrolling] = useState(false);
  const [enrollMessage, setEnrollMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [coursesData, lecturesData, recsData] = await Promise.all([
        api.getCourses(),
        api.getLectures(),
        api.getRevisionRecommendations(),
      ]);
      setCourses(coursesData || []);
      setLectures(lecturesData || []);
      setRecommendations(recsData || []);
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
    if (!enrollCode.trim()) return;
    setEnrolling(true);
    setEnrollMessage("");
    try {
      await api.enrollCourse(enrollCode.trim());
      setEnrollMessage("Successfully enrolled in course!");
      setEnrollCode("");
      await loadData();
    } catch (err) {
      setEnrollMessage(err.message || "Invalid course code");
    } finally {
      setEnrolling(false);
    }
  };

  if (loading) {
    return <div className="page-loading"><div className="spinner" /> Loading student learning hub...</div>;
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div>
          <h1>Student Learning Workspace</h1>
          <p>Access your enrolled courses, searchable lecture transcripts, and smart revision guides.</p>
        </div>
        <div className="header-actions">
          <Link to="/student/search" className="btn-secondary">
            <Search size={16} />
            Atlas Vector Search
          </Link>
        </div>
      </div>

      {/* Course Enrollment Pill */}
      <div className="enroll-banner">
        <form onSubmit={handleEnroll} className="enroll-form">
          <Plus size={18} />
          <input
            type="text"
            placeholder="Enter course code (e.g. CS401)..."
            value={enrollCode}
            onChange={(e) => setEnrollCode(e.target.value)}
          />
          <button type="submit" disabled={enrolling} className="btn-primary btn-sm">
            {enrolling ? "Enrolling..." : "Enroll"}
          </button>
        </form>
        {enrollMessage && <span className="enroll-status">{enrollMessage}</span>}
      </div>

      {/* Smart Revision Recommendations Banner */}
      {recommendations.length > 0 && (
        <div className="revision-highlight-card">
          <div className="revision-header">
            <div className="flex items-center gap-2">
              <Brain size={22} className="text-purple-600" />
              <h3>Personalized Revision Focus</h3>
            </div>
            <Link to="/student/revision" className="btn-link">View Full Plan →</Link>
          </div>
          <div className="recommendations-row">
            {recommendations.slice(0, 3).map((rec, i) => (
              <div key={i} className="rec-card">
                <span className="rec-lecture-tag">{rec.lecture_title}</span>
                <h4 className="rec-topic">{rec.topic_title}</h4>
                <p className="rec-reason">{rec.reason}</p>
                <Link to={rec.timestamp_url} className="btn-rec-action">
                  <PlayCircle size={14} />
                  <span>Review at {Math.floor(rec.suggested_start_time / 60)}m</span>
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Enrolled Courses */}
      <div className="dashboard-section">
        <div className="section-header">
          <h2>My Enrolled Courses</h2>
        </div>

        {courses.length === 0 ? (
          <div className="empty-state">
            <BookOpen size={48} />
            <h3>No enrolled courses yet</h3>
            <p>Enter an enrollment code above (e.g. <code>CS401</code>) to access lecture materials.</p>
          </div>
        ) : (
          <div className="courses-grid">
            {courses.map((c) => (
              <div key={c.id} className="course-card student">
                <div className="course-icon"><BookOpen size={20} /></div>
                <h3 className="course-title">{c.title}</h3>
                <p className="course-desc">{c.description || "Course materials & lectures."}</p>
                <div className="course-card-footer">
                  <span>Instructor: {c.teacher_name || "Faculty"}</span>
                  <span className="font-semibold">{c.lecture_count} Published Lectures</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Available Published Lectures */}
      <div className="dashboard-section mt-8">
        <div className="section-header">
          <h2>Available Approved Lectures</h2>
        </div>

        {lectures.length === 0 ? (
          <div className="empty-state">
            <Video size={48} />
            <h3>No published lectures available yet</h3>
            <p>Your instructors will publish lectures once transcript review and quiz verification are complete.</p>
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
                  {lec.description || "Interactive transcript, semantic search, and section quizzes."}
                </p>

                <div className="lecture-card-stats">
                  <span>{lec.topics?.length || 0} Topics</span>
                  <span>·</span>
                  <span>{lec.segments?.length || 0} Segments</span>
                </div>

                <div className="lecture-card-actions">
                  <Link to={`/student/lectures/${lec.id}`} className="btn-primary w-full justify-center">
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
  );
}

