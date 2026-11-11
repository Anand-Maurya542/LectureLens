import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import {
  BookOpen,
  Plus,
  Users,
  Video,
  CheckCircle2,
  Clock,
  XCircle,
  Search,
  ArrowRight,
  Sparkles,
  HelpCircle,
} from "lucide-react";

export default function StudentCourses() {
  const [activeTab, setActiveTab] = useState("catalog"); // catalog | requests
  const [courses, setCourses] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [enrollCode, setEnrollCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [enrollingCode, setEnrollingCode] = useState(false);
  const [requestingCourseId, setRequestingCourseId] = useState(null);
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");

  const loadData = async () => {
    try {
      const [coursesData, enrollmentsData] = await Promise.all([
        api.getCourses(true), // catalog=true
        api.getMyEnrollments(),
      ]);
      setCourses(coursesData || []);
      setEnrollments(enrollmentsData || []);
    } catch (err) {
      console.error("Failed to load student course catalog:", err);
      setActionError(err.message || "Failed to load courses");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showNotification = (msg, isErr = false) => {
    if (isErr) {
      setActionError(msg);
      setActionMessage("");
    } else {
      setActionMessage(msg);
      setActionError("");
    }
    setTimeout(() => {
      setActionMessage("");
      setActionError("");
    }, 4500);
  };

  const handleEnrollByCode = async (e) => {
    e.preventDefault();
    if (!enrollCode.trim() || enrollingCode) return;
    const code = enrollCode.trim().toUpperCase();
    setEnrollingCode(true);
    try {
      await api.enrollCourse(code);
      showNotification(`Joining request for ${code} submitted! Waiting for approval.`);
      setEnrollCode("");
      await loadData();
    } catch (err) {
      showNotification(err.message || "Invalid or inactive course code", true);
    } finally {
      setEnrollingCode(false);
    }
  };

  const handleRequestEnrollment = async (courseId, courseTitle) => {
    setRequestingCourseId(courseId);
    try {
      await api.requestCourseEnrollment(courseId);
      showNotification(`Joining request for "${courseTitle}" submitted. Waiting for approval.`);
      await loadData();
    } catch (err) {
      showNotification(err.message || "Failed to submit joining request", true);
    } finally {
      setRequestingCourseId(null);
    }
  };

  const filteredCourses = courses.filter((c) => {
    if (!searchTerm) return true;
    return (
      c.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.teacher_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const pendingRequests = enrollments.filter((e) => e.status === "pending");

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" /> Loading courses...
      </div>
    );
  }

  return (
    <div className="dashboard-page max-w-5xl">
      <div className="dashboard-header">
        <div>
          <h1>Explore Courses</h1>
          <p>
            Browse available courses, join with a code or submit a request, and check your joining status.
          </p>
        </div>
      </div>

      {actionMessage && <div className="alert-success mb-4">{actionMessage}</div>}
      {actionError && <div className="alert-error mb-4">{actionError}</div>}

      {/* Code Enrollment Fast Bar */}
      <div className="enroll-banner mb-6">
        <form onSubmit={handleEnrollByCode} className="enroll-form">
          <BookOpen size={18} className="text-primary" />
          <input
            type="text"
            placeholder="Have a course code (e.g. CS401)? Enter here to join..."
            value={enrollCode}
            onChange={(e) => setEnrollCode(e.target.value)}
          />
          <button type="submit" disabled={enrollingCode} className="btn-primary btn-sm">
            {enrollingCode ? "Joining..." : "Join with Code"}
          </button>
        </form>
      </div>

      {/* Tabs */}
      <div className="admin-nav-tabs mb-6">
        <button
          onClick={() => setActiveTab("catalog")}
          className={`tab-btn ${activeTab === "catalog" ? "active" : ""}`}
        >
          <BookOpen size={17} />
          Available Courses ({courses.length})
        </button>
        <button
          onClick={() => setActiveTab("requests")}
          className={`tab-btn ${activeTab === "requests" ? "active" : ""}`}
        >
          <Clock size={17} />
          My Joining Requests
          {pendingRequests.length > 0 && (
            <span
              style={{
                marginLeft: "8px",
                background: "#f59e0b",
                color: "#000",
                fontSize: "0.72rem",
                fontWeight: "700",
                padding: "2px 8px",
                borderRadius: "999px",
              }}
            >
              {pendingRequests.length} pending
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: CATALOG */}
      {activeTab === "catalog" && (
        <div>
          <div className="table-controls mb-4">
            <div className="search-bar">
              <Search size={18} className="search-icon" />
              <input
                type="text"
                placeholder="Search by course title, code (e.g. CS501), or faculty..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {filteredCourses.length === 0 ? (
            <div className="empty-state">
              <BookOpen size={48} style={{ opacity: 0.4 }} />
              <h3>No courses found</h3>
              <p>No active courses match your current search.</p>
            </div>
          ) : (
            <div className="courses-grid">
              {filteredCourses.map((c) => {
                const status = c.user_enrollment_status;
                const isApproved = status === "approved";
                const isPending = status === "pending";
                const isRejected = status === "rejected";

                return (
                  <div key={c.id} className="course-card student">
                    <div className="course-card-header">
                      <div className="course-icon">
                        <BookOpen size={20} />
                      </div>
                      <span className="badge">Code: {c.code}</span>
                    </div>

                    <h3 className="course-title">{c.title}</h3>
                    <p className="course-desc">
                      {c.description || "Course lectures, interactive transcripts & quizzes."}
                    </p>

                    <div className="course-card-footer">
                      <span>Teacher: {c.teacher_name || "Faculty"}</span>
                      <span className="font-semibold">{c.lecture_count} Lectures</span>
                    </div>

                    <div className="mt-4 pt-3 border-t">
                      {isApproved ? (
                        <Link
                          to={`/student/courses/${c.id}`}
                          className="btn-primary w-full justify-center flex items-center gap-2"
                          style={{ textDecoration: "none" }}
                        >
                          <CheckCircle2 size={16} />
                          <span>Open Course</span>
                          <ArrowRight size={15} />
                        </Link>
                      ) : isPending ? (
                        <div
                          style={{
                            background: "rgba(245, 158, 11, 0.12)",
                            color: "#d97706",
                            padding: "8px 12px",
                            borderRadius: "6px",
                            fontSize: "0.85rem",
                            fontWeight: "600",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "6px",
                          }}
                        >
                          <Clock size={15} />
                          <span>Joining Request Pending Approval</span>
                        </div>
                      ) : isRejected ? (
                        <button
                          onClick={() => handleRequestEnrollment(c.id, c.title)}
                          disabled={requestingCourseId === c.id}
                          className="btn-secondary w-full justify-center flex items-center gap-2"
                        >
                          <XCircle size={15} color="#ef4444" />
                          <span>Declined · Request Again</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleRequestEnrollment(c.id, c.title)}
                          disabled={requestingCourseId === c.id}
                          className="btn-primary w-full justify-center flex items-center gap-2"
                        >
                          <Plus size={16} />
                          <span>{requestingCourseId === c.id ? "Sending Request..." : "Request to Join"}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MY ENROLLMENT REQUESTS */}
      {activeTab === "requests" && (
        <div className="admin-tab-content">
          <div className="dashboard-section">
            <div className="section-header">
              <h2>My Joining Requests</h2>
              <span className="badge-count">{enrollments.length} Total Requests</span>
            </div>

            {enrollments.length === 0 ? (
              <div className="empty-state">
                <Clock size={44} style={{ opacity: 0.4 }} />
                <h3>No joining requests yet</h3>
                <p>Browse available courses and click "Request to Join" to get started.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Course</th>
                      <th>Course Code</th>
                      <th>Request Date</th>
                      <th>Status</th>
                      <th style={{ textAlign: "right" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enrollments.map((en) => (
                      <tr key={en.id}>
                        <td>
                          <div style={{ fontWeight: "600", color: "var(--text-main, #0f172a)" }}>
                            {en.course_title}
                          </div>
                        </td>
                        <td>
                          <code>{en.course_code}</code>
                        </td>
                        <td>
                          <div style={{ fontSize: "0.85rem" }}>
                            {en.created_at ? new Date(en.created_at).toLocaleDateString() : "Recent"}
                          </div>
                        </td>
                        <td>
                          {en.status === "pending" && (
                            <span className="badge badge-warning flex items-center gap-1" style={{ width: "fit-content" }}>
                              <Clock size={12} /> Pending Approval
                            </span>
                          )}
                          {en.status === "approved" && (
                            <span className="badge badge-success flex items-center gap-1" style={{ width: "fit-content" }}>
                              <CheckCircle2 size={12} /> Approved
                            </span>
                          )}
                          {en.status === "rejected" && (
                            <div>
                              <span className="badge badge-danger flex items-center gap-1" style={{ width: "fit-content" }}>
                                <XCircle size={12} /> Not Approved
                              </span>
                              {en.rejection_reason && (
                                <div style={{ fontSize: "0.75rem", color: "#ef4444", marginTop: "3px" }}>
                                  Reason: {en.rejection_reason}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {en.status === "approved" ? (
                            <Link
                              to={`/student/courses/${en.course_id}`}
                              className="btn-action"
                              style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
                            >
                              <span>Open Course</span>
                              <ArrowRight size={13} />
                            </Link>
                          ) : (
                            <span style={{ fontSize: "0.78rem", color: "var(--text-muted, #64748b)" }}>
                              Waiting for approval
                            </span>
                          )}
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

