import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../../api/client";
import { StatusBadge } from "../../components/StatusBadge";
import {
  BookOpen,
  Video,
  CheckCircle2,
  Users,
  PlusCircle,
  HelpCircle,
  Clock,
  Sparkles,
  ExternalLink,
  ChevronLeft,
  X,
  Check,
  Trash2,
  Eye,
  FileText,
  AlertCircle,
} from "lucide-react";

export default function TeacherCourseWorkspace() {
  const { id: courseId } = useParams();
  const [courseData, setCourseData] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [activeTab, setActiveTab] = useState("lectures"); // lectures | quizzes | students
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMsg, setActionMsg] = useState("");

  // Add Lecture Modal
  const [showAddLectureModal, setShowAddLectureModal] = useState(false);
  const [lectureTitle, setLectureTitle] = useState("");
  const [lectureDesc, setLectureDesc] = useState("");
  const [lectureType, setLectureType] = useState("youtube"); // youtube | upload
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [mediaFile, setMediaFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Add Custom Quiz Question Modal
  const [showAddQuizModal, setShowAddQuizModal] = useState(false);
  const [selectedLectureForQuiz, setSelectedLectureForQuiz] = useState("");
  const [quizQuestion, setQuizQuestion] = useState("");
  const [quizOptions, setQuizOptions] = useState(["", "", "", ""]);
  const [correctOptionIdx, setCorrectOptionIdx] = useState(0);
  const [quizExplanation, setQuizExplanation] = useState("");
  const [quizDifficulty, setQuizDifficulty] = useState("medium");
  const [creatingQuiz, setCreatingQuiz] = useState(false);

  // AI Quiz Generation State
  const [generatingForLectureId, setGeneratingForLectureId] = useState(null);

  const loadWorkspace = async () => {
    try {
      const data = await api.getCourseContent(courseId);
      setCourseData(data);
      if (data.lectures && data.lectures.length > 0) {
        setSelectedLectureForQuiz(data.lectures[0].id);
      }

      // Load student quiz submissions
      try {
        const subData = await api.getCourseQuizSubmissions(courseId);
        setSubmissions(subData.submissions || []);
      } catch (err) {
        console.warn("Could not load submissions:", err);
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

  const showNotification = (msg, isErr = false) => {
    if (isErr) {
      setError(msg);
      setActionMsg("");
    } else {
      setActionMsg(msg);
      setError("");
    }
    setTimeout(() => {
      setActionMsg("");
      setError("");
    }, 4500);
  };

  const handleTogglePublish = async (lectureId, currentPublished) => {
    try {
      await api.updatePublication(lectureId, !currentPublished);
      showNotification(`Lecture ${!currentPublished ? "published" : "unpublished"} successfully.`);
      await loadWorkspace();
    } catch (err) {
      showNotification(err.message || "Failed to update publication status", true);
    }
  };

  const handleCreateLecture = async (e) => {
    e.preventDefault();
    if (!lectureTitle.trim()) return;
    setUploading(true);

    try {
      if (lectureType === "youtube") {
        if (!youtubeUrl.trim()) throw new Error("YouTube URL is required.");
        await api.createYouTubeLecture({
          title: lectureTitle.trim(),
          description: lectureDesc.trim(),
          course_id: courseId,
          youtube_url: youtubeUrl.trim(),
        });
      } else {
        if (!mediaFile) throw new Error("Please select an audio/video file.");
        const formData = new FormData();
        formData.append("title", lectureTitle.trim());
        formData.append("description", lectureDesc.trim());
        formData.append("course_id", courseId);
        formData.append("file", mediaFile);
        await api.uploadLecture(formData);
      }

      showNotification("Lecture added! Lecture preparation started.");
      setShowAddLectureModal(false);
      setLectureTitle("");
      setLectureDesc("");
      setYoutubeUrl("");
      setMediaFile(null);
      await loadWorkspace();
    } catch (err) {
      showNotification(err.message || "Failed to add lecture", true);
    } finally {
      setUploading(false);
    }
  };

  const handleGenerateAIQuiz = async (lectureId) => {
    setGeneratingForLectureId(lectureId);
    try {
      const res = await api.generateQuizzes(lectureId);
      showNotification(res.message || "Draft quizzes generated!");
      await loadWorkspace();
    } catch (err) {
      showNotification(err.message || "Failed to generate quizzes", true);
    } finally {
      setGeneratingForLectureId(null);
    }
  };

  const handleCreateCustomQuiz = async (e) => {
    e.preventDefault();
    if (!quizQuestion.trim() || !selectedLectureForQuiz) return;
    const filledOptions = quizOptions.map((o) => o.trim()).filter(Boolean);
    if (filledOptions.length < 2) {
      showNotification("Please provide at least 2 options", true);
      return;
    }
    const correctAns = filledOptions[correctOptionIdx] || filledOptions[0];

    setCreatingQuiz(true);
    try {
      await api.createQuizQuestion(selectedLectureForQuiz, {
        question: quizQuestion.trim(),
        options: filledOptions,
        correct_answer: correctAns,
        explanation: quizExplanation.trim(),
        difficulty: quizDifficulty,
        is_approved: true,
      });
      showNotification("Quiz question created and published!");
      setShowAddQuizModal(false);
      setQuizQuestion("");
      setQuizOptions(["", "", "", ""]);
      setQuizExplanation("");
      await loadWorkspace();
    } catch (err) {
      showNotification(err.message || "Failed to create quiz question", true);
    } finally {
      setCreatingQuiz(false);
    }
  };

  const handleToggleQuizApproval = async (quizId, currentApproved) => {
    try {
      await api.approveQuiz(quizId, { is_approved: !currentApproved });
      showNotification(`Quiz question ${!currentApproved ? "approved" : "unapproved"}.`);
      await loadWorkspace();
    } catch (err) {
      showNotification(err.message || "Failed to update quiz approval", true);
    }
  };

  const handleDeleteQuiz = async (quizId) => {
    try {
      await api.deleteQuiz(quizId);
      showNotification("Quiz question deleted.");
      await loadWorkspace();
    } catch (err) {
      showNotification(err.message || "Failed to delete quiz", true);
    }
  };

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" /> Loading course workspace...
      </div>
    );
  }

  if (error || !courseData) {
    return (
      <div className="dashboard-page max-w-5xl">
        <div className="alert-error mb-4">{error || "Course workspace not accessible"}</div>
        <Link to="/teacher/courses" className="btn-secondary">
          <ChevronLeft size={16} /> Back to Courses
        </Link>
      </div>
    );
  }

  const { course, lectures = [], quizzes = [], enrolled_students = [] } = courseData;

  return (
    <div className="dashboard-page max-w-5xl">
      {/* Top Navigation Back Link */}
      <div className="mb-3">
        <Link
          to="/teacher/courses"
          className="text-sm font-semibold flex items-center gap-1 text-muted hover:text-primary"
          style={{ textDecoration: "none" }}
        >
          <ChevronLeft size={16} /> Back to My Courses
        </Link>
      </div>

      {/* Course Workspace Header */}
      <div className="dashboard-header">
        <div>
          <div className="flex items-center gap-3">
            <h1>{course.title}</h1>
            <code style={{ fontSize: "0.88rem", padding: "2px 8px", background: "rgba(99, 102, 241, 0.1)", borderRadius: "6px" }}>
              Code: {course.code}
            </code>
            <span className={`badge ${course.status === "active" ? "badge-success" : "badge-warning"}`}>
              {course.status?.toUpperCase() || "ACTIVE"}
            </span>
          </div>
          <p className="mt-1">{course.description || "Add lectures, review transcripts, and manage quizzes for your students."}</p>
        </div>
        <div className="header-actions">
          <button onClick={() => setShowAddLectureModal(true)} className="btn-primary">
            <PlusCircle size={16} /> Add Lecture
          </button>
        </div>
      </div>

      {actionMsg && <div className="alert-success mb-4">{actionMsg}</div>}
      {error && <div className="alert-error mb-4">{error}</div>}

      {/* Workspace Navigation Tabs */}
      <div className="admin-nav-tabs mb-6">
        <button
          onClick={() => setActiveTab("lectures")}
          className={`tab-btn ${activeTab === "lectures" ? "active" : ""}`}
        >
          <Video size={17} />
          Lectures ({lectures.length})
        </button>
        <button
          onClick={() => setActiveTab("quizzes")}
          className={`tab-btn ${activeTab === "quizzes" ? "active" : ""}`}
        >
          <HelpCircle size={17} />
          Quizzes ({quizzes.length})
        </button>
        <button
          onClick={() => setActiveTab("students")}
          className={`tab-btn ${activeTab === "students" ? "active" : ""}`}
        >
          <Users size={17} />
          Enrolled Students ({enrolled_students.length})
        </button>
      </div>

      {/* TAB 1: LECTURES */}
      {activeTab === "lectures" && (
        <div className="admin-tab-content">
          <div className="dashboard-section">
            <div className="section-header">
              <div>
                <h2>Course Lectures</h2>
                <p className="text-muted text-sm mt-1">
                  Upload audio/video recordings or YouTube links. Transcripts, topics, and summaries are generated automatically.
                </p>
              </div>
              <button onClick={() => setShowAddLectureModal(true)} className="btn-primary btn-sm">
                <PlusCircle size={15} /> Add Lecture
              </button>
            </div>

            {lectures.length === 0 ? (
              <div className="empty-state">
                <Video size={44} style={{ opacity: 0.4 }} />
                <h3>No lectures uploaded yet</h3>
                <p>Add your first course lecture from a YouTube video or recorded audio/video file.</p>
                <button onClick={() => setShowAddLectureModal(true)} className="btn-primary mt-3">
                  <PlusCircle size={16} /> Add Lecture
                </button>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Lecture Title</th>
                      <th>Source</th>
                      <th>Status</th>
                      <th>Published</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lectures.map((l) => (
                      <tr key={l.id}>
                        <td>
                          <div style={{ fontWeight: "600", color: "var(--text-main, #0f172a)" }}>
                            {l.title}
                          </div>
                          <div style={{ fontSize: "0.8rem", color: "var(--text-muted, #64748b)" }}>
                            {l.topics?.length || 0} topics · {l.segments?.length || 0} transcript segments
                          </div>
                        </td>
                        <td>
                          <span className="badge">
                            {l.source_type === "youtube" ? "📺 YouTube" : "📁 File"}
                          </span>
                        </td>
                        <td>
                          <StatusBadge status={l.status} />
                        </td>
                        <td>
                          <button
                            onClick={() => handleTogglePublish(l.id, l.is_published)}
                            className={`badge ${l.is_published ? "badge-success cursor-pointer" : "badge-warning cursor-pointer"}`}
                            title="Click to toggle student publication"
                            style={{ border: "none" }}
                          >
                            {l.is_published ? "Published (Visible)" : "Draft (Hidden)"}
                          </button>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                            <button
                              onClick={() => handleGenerateAIQuiz(l.id)}
                              disabled={generatingForLectureId === l.id}
                              className="btn-action"
                              title="Generate Quizzes from Lecture"
                              style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
                            >
                              <Sparkles size={14} color="#8b5cf6" />
                              <span>{generatingForLectureId === l.id ? "Drafting..." : "Generate Quiz"}</span>
                            </button>
                            <Link
                              to={`/teacher/lectures/${l.id}/review`}
                              className="btn-action"
                              title="Review & edit transcript"
                              style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
                            >
                              <ExternalLink size={14} /> Review
                            </Link>
                          </div>
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

      {/* TAB 2: QUIZZES & ASSIGNMENTS */}
      {activeTab === "quizzes" && (
        <div className="admin-tab-content">
          <div className="dashboard-section mb-6">
            <div className="section-header">
              <div>
                <h2>Course Quizzes</h2>
                <p className="text-muted text-sm mt-1">
                  Create questions or generate quizzes from lecture content. Only approved questions are visible to students.
                </p>
              </div>
              <button
                onClick={() => setShowAddQuizModal(true)}
                disabled={lectures.length === 0}
                className="btn-primary btn-sm"
              >
                <PlusCircle size={15} /> Add Question
              </button>
            </div>

            {quizzes.length === 0 ? (
              <div className="empty-state">
                <HelpCircle size={44} style={{ opacity: 0.4 }} />
                <h3>No quizzes created yet</h3>
                <p>Generate questions automatically from lecture topics or create custom questions.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Question & Options</th>
                      <th>Correct Answer</th>
                      <th>Difficulty</th>
                      <th>Status</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quizzes.map((q) => (
                      <tr key={q.id}>
                        <td style={{ maxWidth: "320px" }}>
                          <div style={{ fontWeight: "600" }}>{q.question}</div>
                          <div style={{ fontSize: "0.78rem", color: "var(--text-muted, #64748b)", marginTop: "4px" }}>
                            Options: {q.options?.join(" · ")}
                          </div>
                        </td>
                        <td>
                          <span style={{ fontSize: "0.85rem", color: "#10b981", fontWeight: "600" }}>
                            {q.correct_answer}
                          </span>
                        </td>
                        <td>
                          <span className="badge">{q.difficulty?.toUpperCase()}</span>
                        </td>
                        <td>
                          <button
                            onClick={() => handleToggleQuizApproval(q.id, q.is_approved)}
                            className={`badge ${q.is_approved ? "badge-success cursor-pointer" : "badge-warning cursor-pointer"}`}
                            style={{ border: "none" }}
                            title="Click to toggle student visibility"
                          >
                            {q.is_approved ? "Approved (Live)" : "Draft"}
                          </button>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            onClick={() => handleDeleteQuiz(q.id)}
                            className="btn-action text-danger"
                            title="Delete question"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Student Submissions & Performance Audit */}
          <div className="dashboard-section">
            <div className="section-header">
              <div>
                <h2>Student Quiz Submissions & Performance</h2>
                <p className="text-muted text-sm mt-1">
                  Track student quiz attempts, grades, and topic error patterns in this course.
                </p>
              </div>
              <span className="badge-count">{submissions.length} Submissions</span>
            </div>

            {submissions.length === 0 ? (
              <div className="empty-state">
                <CheckCircle2 size={38} style={{ opacity: 0.4 }} />
                <p>No student submissions recorded for this course yet.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Lecture Assessment</th>
                      <th>Score</th>
                      <th>Correct / Total</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.map((sub, idx) => (
                      <tr key={idx}>
                        <td>
                          <strong>{sub.student_name}</strong>
                        </td>
                        <td>{sub.lecture_title}</td>
                        <td>
                          <span
                            className={`badge ${
                              sub.score >= 80 ? "badge-success" : sub.score >= 50 ? "badge-warning" : "badge-danger"
                            }`}
                          >
                            {sub.score}%
                          </span>
                        </td>
                        <td>
                          {sub.correct_count} / {sub.total_questions}
                        </td>
                        <td className="text-sm text-muted">
                          {sub.created_at ? new Date(sub.created_at).toLocaleString() : "Recent"}
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

      {/* TAB 3: ENROLLED STUDENTS */}
      {activeTab === "students" && (
        <div className="admin-tab-content">
          <div className="dashboard-section">
            <div className="section-header">
              <div>
                <h2>Enrolled Students</h2>
                <p className="text-muted text-sm mt-1">
                  Students with approved enrollment who can access published lectures and attempt quizzes.
                </p>
              </div>
              <span className="badge-count">{enrolled_students.length} Students</span>
            </div>

            {enrolled_students.length === 0 ? (
              <div className="empty-state">
                <Users size={44} style={{ opacity: 0.4 }} />
                <h3>No enrolled students yet</h3>
                <p>Share your course code (<strong>{course.code}</strong>) with students so they can request enrollment.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Student Name</th>
                      <th>Email</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enrolled_students.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <strong>{s.name}</strong>
                        </td>
                        <td>
                          <code>{s.email}</code>
                        </td>
                        <td>
                          <span className="badge badge-success">Approved Active</span>
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

      {/* MODAL: ADD LECTURE TO THIS COURSE */}
      {showAddLectureModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="flex items-center gap-2">
                <PlusCircle size={20} className="text-primary" /> Add Lecture to {course.title}
              </h3>
              <button onClick={() => setShowAddLectureModal(false)} className="btn-close">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateLecture}>
              <div className="modal-body">
                <div className="form-group mb-3">
                  <label>Lecture Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Lecture 4: Self-Attention & Transformers"
                    value={lectureTitle}
                    onChange={(e) => setLectureTitle(e.target.value)}
                  />
                </div>

                <div className="form-group mb-3">
                  <label>Description</label>
                  <textarea
                    rows={2}
                    placeholder="Lecture abstract and syllabus topics..."
                    value={lectureDesc}
                    onChange={(e) => setLectureDesc(e.target.value)}
                  />
                </div>

                <div className="form-group mb-3">
                  <label>Media Source Type</label>
                  <div className="flex gap-4 mt-1">
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                      <input
                        type="radio"
                        name="mediaType"
                        value="youtube"
                        checked={lectureType === "youtube"}
                        onChange={() => setLectureType("youtube")}
                      />
                      <span>YouTube Video URL</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                      <input
                        type="radio"
                        name="mediaType"
                        value="upload"
                        checked={lectureType === "upload"}
                        onChange={() => setLectureType("upload")}
                      />
                      <span>Upload Recording (MP4/MP3)</span>
                    </label>
                  </div>
                </div>

                {lectureType === "youtube" ? (
                  <div className="form-group mb-2">
                    <label>YouTube Video Link *</label>
                    <input
                      type="url"
                      required
                      placeholder="https://www.youtube.com/watch?v=..."
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                    />
                  </div>
                ) : (
                  <div className="form-group mb-2">
                    <label>Recording File (MP4, MP3, WAV, MKV, M4A) *</label>
                    <input
                      type="file"
                      required
                      accept="audio/*,video/*"
                      onChange={(e) => setMediaFile(e.target.files[0])}
                    />
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowAddLectureModal(false)}
                  className="btn-secondary"
                  disabled={uploading}
                >
                  Cancel
                </button>
                <button type="submit" disabled={uploading} className="btn-primary">
                  {uploading ? "Uploading & Processing..." : "Add Lecture"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD CUSTOM QUIZ QUESTION */}
      {showAddQuizModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="flex items-center gap-2">
                <HelpCircle size={20} className="text-primary" /> Create Quiz Question
              </h3>
              <button onClick={() => setShowAddQuizModal(false)} className="btn-close">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateCustomQuiz}>
              <div className="modal-body">
                <div className="form-group mb-3">
                  <label>Associated Lecture *</label>
                  <select
                    value={selectedLectureForQuiz}
                    onChange={(e) => setSelectedLectureForQuiz(e.target.value)}
                  >
                    {lectures.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group mb-3">
                  <label>Question Text *</label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Enter assessment question..."
                    value={quizQuestion}
                    onChange={(e) => setQuizQuestion(e.target.value)}
                  />
                </div>

                <div className="form-group mb-3">
                  <label>Options (Select the correct option):</label>
                  {quizOptions.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2 mt-2">
                      <input
                        type="radio"
                        name="correctOpt"
                        checked={correctOptionIdx === idx}
                        onChange={() => setCorrectOptionIdx(idx)}
                      />
                      <input
                        type="text"
                        required
                        placeholder={`Option ${idx + 1}`}
                        value={opt}
                        onChange={(e) => {
                          const updated = [...quizOptions];
                          updated[idx] = e.target.value;
                          setQuizOptions(updated);
                        }}
                      />
                    </div>
                  ))}
                </div>

                <div className="form-group mb-3">
                  <label>Explanation / Feedback</label>
                  <input
                    type="text"
                    placeholder="Why this answer is correct..."
                    value={quizExplanation}
                    onChange={(e) => setQuizExplanation(e.target.value)}
                  />
                </div>

                <div className="form-group mb-2">
                  <label>Difficulty</label>
                  <select
                    value={quizDifficulty}
                    onChange={(e) => setQuizDifficulty(e.target.value)}
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowAddQuizModal(false)}
                  className="btn-secondary"
                  disabled={creatingQuiz}
                >
                  Cancel
                </button>
                <button type="submit" disabled={creatingQuiz} className="btn-primary">
                  {creatingQuiz ? "Saving..." : "Save & Publish Question"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

