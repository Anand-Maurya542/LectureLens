import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import {
  BookOpen,
  Plus,
  Users,
  Video,
  Copy,
  Check,
  ArrowRight,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  Sparkles,
  Layers,
} from "lucide-react";

export default function CourseManager() {
  const [activeTab, setActiveTab] = useState("my"); // my | catalog
  const [myCourses, setMyCourses] = useState([]);
  const [catalogCourses, setCatalogCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [code, setCode] = useState("");
  const [copiedCode, setCopiedCode] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [actionMsg, setActionMsg] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [requestingCourseId, setRequestingCourseId] = useState(null);

  const loadData = async () => {
    try {
      const [myData, catalogData] = await Promise.all([
        api.getCourses(false),
        api.getCourses(true),
      ]);
      setMyCourses(myData || []);
      setCatalogCourses(catalogData || []);
    } catch (err) {
      console.error("Failed to load courses:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api.createCourse({
        title: title.trim(),
        description: description.trim(),
        code: code.trim() ? code.trim().toUpperCase() : undefined,
      });
      setShowModal(false);
      setTitle("");
      setDescription("");
      setCode("");
      setActionMsg("Course created successfully!");
      setTimeout(() => setActionMsg(""), 4000);
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to create course");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestAssignment = async (courseId) => {
    setRequestingCourseId(courseId);
    try {
      await api.requestCourseEnrollment(courseId);
      setActionMsg("Assignment request submitted for admin review.");
      setTimeout(() => setActionMsg(""), 4000);
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to request course assignment");
      setTimeout(() => setError(""), 4500);
    } finally {
      setRequestingCourseId(null);
    }
  };

  const copyCode = (cCode) => {
    navigator.clipboard.writeText(cCode);
    setCopiedCode(cCode);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const filteredCatalog = catalogCourses.filter((c) => {
    if (!searchTerm) return true;
    return (
      c.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.teacher_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" /> Loading instructor course workspaces...
      </div>
    );
  }

  return (
    <div className="dashboard-page max-w-5xl">
      <div className="dashboard-header">
        <div>
          <h1>Faculty Course Workspaces</h1>
          <p>
            Manage course materials, review AI transcripts, create quizzes, and monitor student performance.
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          <Plus size={18} />
          Create New Course
        </button>
      </div>

      {actionMsg && <div className="alert-success mb-4">{actionMsg}</div>}
      {error && <div className="alert-error mb-4">{error}</div>}

      {/* Tabs */}
      <div className="admin-nav-tabs mb-6">
        <button
          onClick={() => setActiveTab("my")}
          className={`tab-btn ${activeTab === "my" ? "active" : ""}`}
        >
          <BookOpen size={17} />
          My Approved Courses ({myCourses.length})
        </button>
        <button
          onClick={() => setActiveTab("catalog")}
          className={`tab-btn ${activeTab === "catalog" ? "active" : ""}`}
        >
          <Layers size={17} />
          Browse Course Catalog ({catalogCourses.length})
        </button>
      </div>

      {/* TAB 1: MY APPROVED COURSES */}
      {activeTab === "my" && (
        <div>
          {myCourses.length === 0 ? (
            <div className="empty-state">
              <BookOpen size={48} style={{ opacity: 0.4 }} />
              <h3>No courses assigned yet</h3>
              <p>
                Create a new course or browse the course catalog to request assignment as an instructor.
              </p>
              <button onClick={() => setShowModal(true)} className="btn-primary mt-3">
                <Plus size={16} /> Create Course
              </button>
            </div>
          ) : (
            <div className="courses-grid">
              {myCourses.map((course) => (
                <div key={course.id} className="course-card">
                  <div className="course-card-header">
                    <div className="course-icon">
                      <BookOpen size={22} />
                    </div>
                    <button
                      onClick={() => copyCode(course.code)}
                      className="course-code-pill"
                      title="Click to copy student enrollment code"
                    >
                      <span>
                        Code: <strong>{course.code}</strong>
                      </span>
                      {copiedCode === course.code ? (
                        <Check size={14} color="#10b981" />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                  </div>

                  <h3 className="course-title">{course.title}</h3>
                  <p className="course-desc">
                    {course.description || "Course materials, transcripts, and quizzes."}
                  </p>

                  <div className="course-card-footer">
                    <div className="stat">
                      <Users size={16} />
                      <span>{course.student_count} Enrolled</span>
                    </div>
                    <div className="stat">
                      <Video size={16} />
                      <span>{course.lecture_count} Lectures</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t">
                    <Link
                      to={`/teacher/courses/${course.id}`}
                      className="btn-primary w-full justify-center flex items-center gap-2"
                      style={{ textDecoration: "none" }}
                    >
                      <span>Open Course Workspace</span>
                      <ArrowRight size={16} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: COURSE CATALOG & REQUEST ASSIGNMENT */}
      {activeTab === "catalog" && (
        <div>
          <div className="table-controls mb-4">
            <div className="search-bar">
              <Search size={18} className="search-icon" />
              <input
                type="text"
                placeholder="Search catalog by course title, code, or faculty..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="courses-grid">
            {filteredCatalog.map((course) => {
              const isApproved =
                course.user_enrollment_status === "approved" ||
                myCourses.some((m) => m.id === course.id);
              const isPending = course.user_enrollment_status === "pending";

              return (
                <div key={course.id} className="course-card">
                  <div className="course-card-header">
                    <div className="course-icon">
                      <BookOpen size={22} />
                    </div>
                    <span className="badge">Code: {course.code}</span>
                  </div>

                  <h3 className="course-title">{course.title}</h3>
                  <p className="course-desc">
                    {course.description || "Active platform course."}
                  </p>

                  <div className="course-card-footer">
                    <span>Lead: {course.teacher_name || "Faculty"}</span>
                    <span>{course.lecture_count} Lectures</span>
                  </div>

                  <div className="mt-4 pt-3 border-t">
                    {isApproved ? (
                      <Link
                        to={`/teacher/courses/${course.id}`}
                        className="btn-secondary w-full justify-center flex items-center gap-2"
                        style={{ textDecoration: "none" }}
                      >
                        <CheckCircle2 size={16} color="#10b981" />
                        <span>Open Workspace</span>
                      </Link>
                    ) : isPending ? (
                      <button disabled className="btn-secondary w-full justify-center flex items-center gap-2 opacity-75">
                        <Clock size={16} color="#f59e0b" />
                        <span>Request Pending Admin Review</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRequestAssignment(course.id)}
                        disabled={requestingCourseId === course.id}
                        className="btn-primary w-full justify-center flex items-center gap-2"
                      >
                        <Plus size={16} />
                        <span>{requestingCourseId === course.id ? "Submitting..." : "Request Course Assignment"}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Create Course Modal */}
      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h2>Create New Course</h2>
              <button onClick={() => setShowModal(false)} className="btn-close">
                ×
              </button>
            </div>

            {error && <div className="alert-error">{error}</div>}

            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div className="form-group mb-3">
                  <label>Course Title *</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. CS 502: Advanced Deep Learning"
                  />
                </div>

                <div className="form-group mb-3">
                  <label>Description</label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Course overview, syllabus, prerequisites..."
                  />
                </div>

                <div className="form-group mb-2">
                  <label>Custom Enrollment Code (Optional)</label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="e.g. CS502 (Leave empty to auto-generate)"
                  />
                  <small className="help-text">Unique code for student registration.</small>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting ? "Creating..." : "Save Course"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
