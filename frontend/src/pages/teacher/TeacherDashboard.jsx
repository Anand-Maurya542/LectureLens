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
  Clock,
  AlertTriangle,
  Search,
  Trash2,
  HelpCircle,
  X,
} from "lucide-react";

export default function TeacherDashboard() {
  const [courses, setCourses] = useState([]);
  const [lectures, setLectures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [lectureToDelete, setLectureToDelete] = useState(null);
  const [retryingId, setRetryingId] = useState(null);
  const [notification, setNotification] = useState("");
  const [errorNotification, setErrorNotification] = useState("");

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

  const showMsg = (msg, isErr = false) => {
    if (isErr) {
      setErrorNotification(msg);
      setNotification("");
    } else {
      setNotification(msg);
      setErrorNotification("");
    }
    setTimeout(() => {
      setNotification("");
      setErrorNotification("");
    }, 4500);
  };

  const handleRetryPipeline = async (lectureId) => {
    setRetryingId(lectureId);
    try {
      await api.retryLecture(lectureId);
      showMsg("Pipeline restarted successfully. Status will update automatically.");
      await loadData();
    } catch (err) {
      showMsg(err.message || "Failed to retry pipeline", true);
    } finally {
      setRetryingId(null);
    }
  };

  const handleDeleteLecture = async () => {
    if (!lectureToDelete) return;
    try {
      await api.deleteLecture(lectureToDelete.id);
      showMsg(`Lecture "${lectureToDelete.title}" deleted.`);
      setLectureToDelete(null);
      await loadData();
    } catch (err) {
      showMsg(err.message || "Failed to delete lecture", true);
    }
  };

  const totalCourses = courses.length;
  const totalLectures = lectures.length;
  const processedLectures = lectures.filter(
    (l) => l.status === "review_required" || l.status === "published"
  ).length;
  const pendingProcessing = lectures.filter(
    (l) => l.status === "queued" || l.status === "processing"
  ).length;
  const publishedLectures = lectures.filter((l) => l.is_published).length;
  const failedLectures = lectures.filter((l) => l.status === "failed").length;

  const filteredLectures = lectures.filter((l) => {
    const matchesSearch =
      !searchTerm ||
      l.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.course_title?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "published" && l.is_published) ||
      (statusFilter === "review_required" && l.status === "review_required") ||
      (statusFilter === "processing" && (l.status === "queued" || l.status === "processing")) ||
      (statusFilter === "failed" && l.status === "failed");
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" /> Loading instructor workspace...
      </div>
    );
  }

  return (
    <div className="dashboard-page max-w-5xl">
      {/* Top Banner */}
      <div className="dashboard-header">
        <div>
          <div className="flex items-center gap-3">
            <h1>Instructor Studio</h1>
            <span className="role-badge role-teacher">Faculty</span>
          </div>
          <p>
            Manage curriculum, review AI transcriptions, approve assessments & publish student material.
          </p>
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
            Sync
          </button>
          <Link to="/teacher/add-lecture" className="btn-primary">
            <PlusCircle size={18} />
            Add Lecture
          </Link>
        </div>
      </div>

      {notification && <div className="alert-success mb-4">{notification}</div>}
      {errorNotification && <div className="alert-error mb-4">{errorNotification}</div>}

      {/* Metric Cards */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon purple">
            <BookOpen size={24} />
          </div>
          <div>
            <div className="metric-value">{totalCourses}</div>
            <div className="metric-label">Active Courses</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon blue">
            <Video size={24} />
          </div>
          <div>
            <div className="metric-value">{totalLectures}</div>
            <div className="metric-label">Total Ingested</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon green">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <div className="metric-value">{publishedLectures}</div>
            <div className="metric-label">Published to Students</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon amber">
            <Clock size={24} />
          </div>
          <div>
            <div className="metric-value">{processedLectures - publishedLectures}</div>
            <div className="metric-label">Awaiting Approval</div>
          </div>
        </div>
      </div>

      {failedLectures > 0 && (
        <div className="alert-error my-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} />
            <span>
              {failedLectures} lecture(s) failed automated processing. Click "Retry" to run the pipeline again.
            </span>
          </div>
          <button onClick={() => setStatusFilter("failed")} className="btn-secondary btn-sm">
            View Failed
          </button>
        </div>
      )}

      {/* Lecture Queue & Management Section */}
      <div className="dashboard-section mt-6">
        <div className="section-header">
          <h2>Lecture Processing & Review Queue</h2>
          <div className="flex gap-2">
            <Link to="/teacher/quizzes" className="btn-secondary btn-sm">
              <HelpCircle size={15} />
              Review Quizzes
            </Link>
            <Link to="/teacher/add-lecture" className="btn-link">
              Upload New
            </Link>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="filter-bar mb-4">
          <div className="search-box flex-1">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search lectures by title or course name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="published">Published</option>
            <option value="review_required">Ready for Review</option>
            <option value="processing">Processing</option>
            <option value="failed">Failed</option>
          </select>
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
                {filteredLectures.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-6 text-muted">
                      No lectures match the filter.
                    </td>
                  </tr>
                ) : (
                  filteredLectures.map((lec) => (
                    <tr key={lec.id}>
                      <td>
                        <div className="table-main-title">{lec.title}</div>
                        <div className="table-sub-title">{lec.course_title || "General Course"}</div>
                        {lec.status === "failed" && lec.failure_reason && (
                          <small className="text-danger block mt-1">
                            {lec.failure_reason}
                          </small>
                        )}
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
                          {lec.segments?.length || 0} segs · {lec.topics?.length || 0} topics
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/teacher/lectures/${lec.id}/review`}
                            className="btn-action"
                            title="Inspect transcripts, topics & summaries"
                          >
                            <Eye size={15} />
                            <span>Review</span>
                          </Link>

                          {lec.status === "failed" && (
                            <button
                              onClick={() => handleRetryPipeline(lec.id)}
                              disabled={retryingId === lec.id}
                              className="btn-action"
                              title="Restart pipeline"
                            >
                              <RefreshCw
                                size={15}
                                className={retryingId === lec.id ? "spin" : ""}
                              />
                              <span>Retry</span>
                            </button>
                          )}

                          <button
                            onClick={() => setLectureToDelete(lec)}
                            className="btn-action text-danger"
                            title="Delete lecture"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DELETE CONFIRMATION MODAL */}
      {lectureToDelete && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="text-danger flex items-center gap-2">
                <AlertTriangle size={20} /> Delete Lecture
              </h3>
              <button onClick={() => setLectureToDelete(null)} className="btn-close">
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to delete lecture <strong>"{lectureToDelete.title}"</strong>?
              </p>
              <p className="text-sm text-danger mt-2">
                This will delete all transcripts, topics, summaries, and student quiz questions associated with this lecture.
              </p>
            </div>
            <div className="modal-footer">
              <button onClick={() => setLectureToDelete(null)} className="btn-secondary">
                Cancel
              </button>
              <button onClick={handleDeleteLecture} className="btn-danger">
                Delete Lecture
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
