import React, { useState, useEffect } from "react";
import { api } from "../../api/client";
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  Edit2,
  Save,
  ShieldCheck,
  Check,
  Video,
  PlusCircle,
  Sparkles,
  Trash2,
  X,
  AlertCircle,
} from "lucide-react";

export default function QuizManager() {
  const [lectures, setLectures] = useState([]);
  const [selectedLectureId, setSelectedLectureId] = useState("");
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [generating, setGenerating] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  // Create custom question modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState("");
  const [newOptions, setNewOptions] = useState(["", "", "", ""]);
  const [newCorrectAnswer, setNewCorrectAnswer] = useState("");
  const [newExplanation, setNewExplanation] = useState("");
  const [newDifficulty, setNewDifficulty] = useState("medium");
  const [savingNewQ, setSavingNewQ] = useState(false);

  useEffect(() => {
    async function fetchLectures() {
      try {
        const lecs = await api.getLectures();
        setLectures(lecs || []);
        if (lecs?.length > 0) {
          setSelectedLectureId(lecs[0].id);
        }
      } catch (err) {
        console.error("Failed to load lectures:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchLectures();
  }, []);

  const loadQuizzes = async (lecId) => {
    if (!lecId) return;
    try {
      const data = await api.getLectureQuizzes(lecId);
      setQuizzes(data || []);
    } catch (err) {
      console.error("Failed to load quizzes:", err);
    }
  };

  useEffect(() => {
    if (selectedLectureId) {
      loadQuizzes(selectedLectureId);
    }
  }, [selectedLectureId]);

  const showMsg = (msg, isErr = false) => {
    if (isErr) {
      setError(msg);
      setFeedback("");
    } else {
      setFeedback(msg);
      setError("");
    }
    setTimeout(() => {
      setFeedback("");
      setError("");
    }, 4500);
  };

  const handleToggleApproval = async (quizId, currentApproved) => {
    try {
      await api.approveQuiz(quizId, { is_approved: !currentApproved });
      showMsg(`Question ${!currentApproved ? "approved for students" : "unapproved (hidden)"}`);
      await loadQuizzes(selectedLectureId);
    } catch (err) {
      showMsg(err.message || "Failed to update quiz approval", true);
    }
  };

  const handleSaveEdit = async (quizId) => {
    try {
      await api.approveQuiz(quizId, {
        question: editForm.question,
        options: editForm.options,
        correct_answer: editForm.correct_answer,
        explanation: editForm.explanation,
        difficulty: editForm.difficulty,
        is_approved: editForm.is_approved,
      });
      setEditingId(null);
      showMsg("Question edits saved successfully.");
      await loadQuizzes(selectedLectureId);
    } catch (err) {
      showMsg(err.message || "Failed to save question edit", true);
    }
  };

  const handleDeleteQuestion = async (quizId) => {
    if (!window.confirm("Are you sure you want to delete this question?")) return;
    try {
      await api.deleteQuizQuestion(quizId);
      showMsg("Question deleted.");
      await loadQuizzes(selectedLectureId);
    } catch (err) {
      showMsg(err.message || "Failed to delete question", true);
    }
  };

  const handleGenerateAIQuizzes = async () => {
    if (!selectedLectureId) return;
    setGenerating(true);
    try {
      const res = await api.generateQuizDrafts(selectedLectureId);
      showMsg(res.message || "Draft quiz questions generated from lecture topics.");
      await loadQuizzes(selectedLectureId);
    } catch (err) {
      showMsg(err.message || "Failed to generate quizzes", true);
    } finally {
      setGenerating(false);
    }
  };

  const handleCreateCustomQuestion = async (e) => {
    e.preventDefault();
    if (!newQuestionText.trim() || !newCorrectAnswer.trim()) {
      showMsg("Question text and correct answer are required.", true);
      return;
    }
    const cleanOptions = newOptions.map((o) => o.trim()).filter(Boolean);
    if (!cleanOptions.includes(newCorrectAnswer.trim())) {
      cleanOptions.unshift(newCorrectAnswer.trim());
    }

    setSavingNewQ(true);
    try {
      await api.createQuizQuestion(selectedLectureId, {
        lecture_id: selectedLectureId,
        question: newQuestionText.trim(),
        options: cleanOptions,
        correct_answer: newCorrectAnswer.trim(),
        explanation: newExplanation.trim(),
        difficulty: newDifficulty,
        is_approved: true, // Teacher-created questions are approved by default
      });
      showMsg("Custom assessment question created and approved.");
      setShowCreateModal(false);
      setNewQuestionText("");
      setNewOptions(["", "", "", ""]);
      setNewCorrectAnswer("");
      setNewExplanation("");
      await loadQuizzes(selectedLectureId);
    } catch (err) {
      showMsg(err.message || "Failed to create question", true);
    } finally {
      setSavingNewQ(false);
    }
  };

  const approvedCount = quizzes.filter((q) => q.is_approved).length;

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" /> Loading quiz manager...
      </div>
    );
  }

  return (
    <div className="dashboard-page max-w-5xl">
      <div className="dashboard-header">
        <div>
          <h1>Manage Lecture Quizzes</h1>
          <p>
            Review, edit, and approve quiz questions. Only approved questions are visible to students.
          </p>
        </div>
        <div className="header-actions">
          <button
            onClick={handleGenerateAIQuizzes}
            disabled={generating || !selectedLectureId}
            className="btn-secondary"
            title="Generate questions from lecture topics"
          >
            <Sparkles size={16} />
            {generating ? "Generating..." : "Generate Quizzes"}
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            disabled={!selectedLectureId}
            className="btn-primary"
          >
            <PlusCircle size={16} />
            Add Question
          </button>
        </div>
      </div>

      {feedback && <div className="alert-success mb-4">{feedback}</div>}
      {error && <div className="alert-error mb-4">{error}</div>}

      {/* Lecture Selector & Summary Pill */}
      <div className="card-box mb-6">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div className="flex-1 min-w-[260px]">
            <label className="font-semibold block mb-1">Select Lecture:</label>
            <select
              value={selectedLectureId}
              onChange={(e) => setSelectedLectureId(e.target.value)}
              className="w-full"
            >
              {lectures.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title} ({l.course_title || "General"})
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <span className="badge badge-success">
              {approvedCount} Approved (Visible to Students)
            </span>
            <span className="badge badge-warning">
              {quizzes.length - approvedCount} Drafts (Hidden)
            </span>
          </div>
        </div>
      </div>

      {quizzes.length === 0 ? (
        <div className="empty-state">
          <HelpCircle size={48} />
          <h3>No quiz questions for this lecture yet</h3>
          <p>Click "Generate Quizzes" to create draft questions from lecture topics, or "Add Question" to write your own.</p>
          <div className="flex gap-3 justify-center mt-4">
            <button
              onClick={handleGenerateAIQuizzes}
              disabled={generating}
              className="btn-primary"
            >
              <Sparkles size={16} />
              {generating ? "Generating..." : "Generate Quizzes"}
            </button>
            <button onClick={() => setShowCreateModal(true)} className="btn-secondary">
              <PlusCircle size={16} />
              Create Custom Question
            </button>
          </div>
        </div>
      ) : (
        <div className="quiz-list">
          {quizzes.map((q, idx) => (
            <div
              key={q.id}
              className={`quiz-review-card ${q.is_approved ? "approved" : "pending"}`}
            >
              <div className="quiz-card-header">
                <div className="flex items-center gap-2">
                  <span className="question-number">Q{idx + 1}</span>
                  <span className={`difficulty-tag ${q.difficulty || "medium"}`}>
                    {q.difficulty?.toUpperCase() || "MEDIUM"}
                  </span>
                  {q.topic_id && <span className="topic-tag">Topic {q.topic_id}</span>}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleApproval(q.id, q.is_approved)}
                    className={`btn-approval ${q.is_approved ? "is-approved" : "is-pending"}`}
                  >
                    {q.is_approved ? (
                      <>
                        <CheckCircle2 size={16} />
                        Approved
                      </>
                    ) : (
                      <>
                        <ShieldCheck size={16} />
                        Click to Approve
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      if (editingId === q.id) {
                        setEditingId(null);
                      } else {
                        setEditingId(q.id);
                        setEditForm({ ...q });
                      }
                    }}
                    className="btn-icon"
                    title="Edit question text and options"
                  >
                    <Edit2 size={16} />
                  </button>

                  <button
                    onClick={() => handleDeleteQuestion(q.id)}
                    className="btn-icon text-danger"
                    title="Delete question"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {editingId === q.id ? (
                <div className="edit-quiz-form mt-4">
                  <div className="form-group mb-3">
                    <label>Question Prompt:</label>
                    <input
                      type="text"
                      value={editForm.question || ""}
                      onChange={(e) => setEditForm({ ...editForm, question: e.target.value })}
                    />
                  </div>

                  <div className="form-group mb-3">
                    <label>Correct Answer:</label>
                    <input
                      type="text"
                      value={editForm.correct_answer || ""}
                      onChange={(e) =>
                        setEditForm({ ...editForm, correct_answer: e.target.value })
                      }
                    />
                  </div>

                  <div className="form-group mb-3">
                    <label>Options (comma separated):</label>
                    <input
                      type="text"
                      value={editForm.options?.join(", ") || ""}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          options: e.target.value.split(",").map((s) => s.trim()),
                        })
                      }
                    />
                  </div>

                  <div className="form-group mb-3">
                    <label>Explanation / Evidence citation:</label>
                    <textarea
                      rows={2}
                      value={editForm.explanation || ""}
                      onChange={(e) =>
                        setEditForm({ ...editForm, explanation: e.target.value })
                      }
                    />
                  </div>

                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setEditingId(null)} className="btn-secondary btn-sm">
                      Cancel
                    </button>
                    <button
                      onClick={() => handleSaveEdit(q.id)}
                      className="btn-primary btn-sm"
                    >
                      <Save size={15} /> Save Changes
                    </button>
                  </div>
                </div>
              ) : (
                <div className="quiz-card-content mt-3">
                  <h4 className="question-text">{q.question}</h4>
                  <div className="options-grid">
                    {q.options?.map((opt, i) => {
                      const isCorrect =
                        opt.trim().toLowerCase() === q.correct_answer?.trim().toLowerCase();
                      return (
                        <div key={i} className={`option-item ${isCorrect ? "correct" : ""}`}>
                          <span className="opt-letter">
                            {String.fromCharCode(65 + i)}
                          </span>
                          <span className="opt-text">{opt}</span>
                          {isCorrect && (
                            <span className="correct-badge">
                              <Check size={14} /> Correct
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {q.explanation && (
                    <div className="explanation-box mt-3">
                      <strong>Explanation:</strong> {q.explanation}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* MODAL: CREATE CUSTOM QUESTION */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div className="modal-card max-w-lg">
            <div className="modal-header">
              <h3>Create Custom Quiz Question</h3>
              <button onClick={() => setShowCreateModal(false)} className="btn-close">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateCustomQuestion}>
              <div className="modal-body">
                <div className="form-group mb-3">
                  <label>Question Prompt:</label>
                  <input
                    type="text"
                    placeholder="Enter question text..."
                    value={newQuestionText}
                    onChange={(e) => setNewQuestionText(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group mb-3">
                  <label>Correct Answer:</label>
                  <input
                    type="text"
                    placeholder="Exact correct answer..."
                    value={newCorrectAnswer}
                    onChange={(e) => setNewCorrectAnswer(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group mb-3">
                  <label>Distractor Options (Wrong Answers):</label>
                  {newOptions.slice(0, 3).map((opt, idx) => (
                    <input
                      key={idx}
                      type="text"
                      className="mb-2"
                      placeholder={`Distractor Option ${idx + 1}...`}
                      value={opt}
                      onChange={(e) => {
                        const copy = [...newOptions];
                        copy[idx] = e.target.value;
                        setNewOptions(copy);
                      }}
                    />
                  ))}
                </div>

                <div className="form-group mb-3">
                  <label>Explanation / Rationale:</label>
                  <textarea
                    rows={2}
                    placeholder="Explain why this answer is correct..."
                    value={newExplanation}
                    onChange={(e) => setNewExplanation(e.target.value)}
                  />
                </div>

                <div className="form-group mb-2">
                  <label>Difficulty Level:</label>
                  <select
                    value={newDifficulty}
                    onChange={(e) => setNewDifficulty(e.target.value)}
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
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" disabled={savingNewQ} className="btn-primary">
                  {savingNewQ ? "Saving..." : "Create & Approve"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
