import React, { useState, useEffect } from "react";
import { api } from "../../api/client";
import { BookOpen, Plus, Users, Video, Copy, Check } from "lucide-react";

export default function CourseManager() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [code, setCode] = useState("");
  const [copiedCode, setCopiedCode] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const loadCourses = async () => {
    try {
      const data = await api.getCourses();
      setCourses(data || []);
    } catch (err) {
      console.error("Failed to load courses:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api.createCourse({
        title,
        description,
        code: code.trim() ? code.trim() : undefined,
      });
      setShowModal(false);
      setTitle("");
      setDescription("");
      setCode("");
      loadCourses();
    } catch (err) {
      setError(err.message || "Failed to create course");
    } finally {
      setSubmitting(false);
    }
  };

  const copyCode = (cCode) => {
    navigator.clipboard.writeText(cCode);
    setCopiedCode(cCode);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  if (loading) {
    return <div className="page-loading"><div className="spinner" /> Loading courses...</div>;
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div>
          <h1>Course Management</h1>
          <p>Create courses, manage student access, and organize lecture materials.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          <Plus size={18} />
          Create Course
        </button>
      </div>

      <div className="courses-grid">
        {courses.map((course) => (
          <div key={course.id} className="course-card">
            <div className="course-card-header">
              <div className="course-icon"><BookOpen size={22} /></div>
              <button
                onClick={() => copyCode(course.code)}
                className="course-code-pill"
                title="Click to copy enrollment code for students"
              >
                <span>Code: <strong>{course.code}</strong></span>
                {copiedCode === course.code ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
              </button>
            </div>

            <h3 className="course-title">{course.title}</h3>
            <p className="course-desc">{course.description || "No description provided."}</p>

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
          </div>
        ))}
      </div>

      {/* Create Course Modal */}
      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Create New Course</h2>
              <button onClick={() => setShowModal(false)} className="btn-close">×</button>
            </div>

            {error && <div className="alert-error">{error}</div>}

            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Course Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. CS 502: Advanced Deep Learning"
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Course overview and syllabus details..."
                />
              </div>

              <div className="form-group">
                <label>Custom Enrollment Code (Optional)</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. CS502 (Leave empty to auto-generate)"
                />
              </div>

              <div className="modal-actions">
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

