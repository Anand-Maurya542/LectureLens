import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { StatusBadge } from "../../components/StatusBadge";
import {
  BookOpen,
  Video,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  ChevronRight,
  Eye,
  RefreshCw,
} from "lucide-react";

export default function TeacherDashboard() {
  const [courses, setCourses] = useState([]);
  const [lectures, setLectures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [coursesData, lecturesData] = await Promise.all([
        api.getCourses(),
        api.getLectures(),
      ]);
      setCourses(coursesData || []);
      setLectures(lecturesData || []);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    // Poll every 8 seconds if there are processing lectures
    const interval = setInterval(() => {
      const hasProcessing = lectures.some(
        (l) => l.status === "queued" || l.status === "processing"
      );
      if (hasProcessing) {
        loadData();
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [lectures.length]);

  const totalCourses = courses.length;
  const totalLectures = lectures.length;
  const pendingReview = lectures.filter((l) => l.status === "review_required").length;
  const publishedLectures = lectures.filter((l) => l.is_published).length;

  if (loading) {
    return <div className="page-loading"><div className="spinner" /> Loading instructor workspace...</div>;
  }

  return (
    <div className="dashboard-page">
      {/* Top Banner */}
      <div className="dashboard-header">
        <div>
          <h1>Instructor Studio</h1>
          <p>Manage curriculum, review AI transcriptions & approve student learning material.</p>
        </div>
        <div className="header-actions">
          <button
            onClick={() => {
              setRefreshing(true);
              loadData();
            }}
            className="btn-secondary"
            title="Refresh status"
          >
            <RefreshCw size={16} className={refreshing ? "spin" : ""} />
            Refresh
          </button>
          <Link to="/teacher/add-lecture" className="btn-primary">
            <PlusCircle size={18} />
            Add Lecture
          </Link>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon purple"><BookOpen size={24} /></div>
          <div>
            <div className="metric-value">{totalCourses}</div>
            <div className="metric-label">Active Courses</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon blue"><Video size={24} /></div>
          <div>
            <div className="metric-value">{totalLectures}</div>
            <div className="metric-label">Ingested Lectures</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon amber"><AlertCircle size={24} /></div>
          <div>
            <div className="metric-value">{pendingReview}</div>
            <div className="metric-label">Pending Review</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon green"><CheckCircle2 size={24} /></div>
          <div>
            <div className="metric-value">{publishedLectures}</div>
            <div className="metric-label">Published to Students</div>
          </div>
        </div>
      </div>

      {/* Recent Lectures Section */}
      <div className="dashboard-section">
        <div className="section-header">
          <h2>Lecture Processing & Review Queue</h2>
          <Link to="/teacher/add-lecture" className="btn-link">Upload New</Link>
        </div>

        {lectures.length === 0 ? (
          <div className="empty-state">
            <Video size={48} />
            <h3>No lectures uploaded yet</h3>
            <p>Upload your first audio/video recording or paste a YouTube lecture link to get started.</p>
            <Link to="/teacher/add-lecture" className="btn-primary mt-4">
              Add Your First Lecture
            </Link>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title & Course</th>
                  <th>Source</th>
                  <th>Pipeline Status</th>
                  <th>Publication</th>
                  <th>Segments / Topics</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {lectures.map((lec) => (
                  <tr key={lec.id}>
                    <td>
                      <div className="table-main-title">{lec.title}</div>
                      <div className="table-sub-title">{lec.course_title || "General"}</div>
                    </td>
                    <td>
                      <span className="source-tag">
                        {lec.source_type === "youtube" ? "📺 YouTube" : "📁 Upload"}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={lec.status} isPublished={lec.is_published} />
                    </td>
                    <td>
                      <span className={`pub-status ${lec.is_published ? "published" : "draft"}`}>
                        {lec.is_published ? "Visible to Students" : "Draft / Hidden"}
                      </span>
                    </td>
                    <td>
                      <span className="badge-count">
                        {lec.segments?.length || 0} segments · {lec.topics?.length || 0} topics
                      </span>
                    </td>
                    <td>
                      <Link
                        to={`/teacher/lectures/${lec.id}/review`}
                        className="btn-action"
                        title="Review transcript and topics"
                      >
                        <Eye size={16} />
                        <span>Review & Edit</span>
                        <ChevronRight size={14} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

