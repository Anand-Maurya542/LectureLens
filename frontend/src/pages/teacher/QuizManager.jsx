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
} from "lucide-react";

export default function QuizManager() {
  const [lectures, setLectures] = useState([]);
  const [selectedLectureId, setSelectedLectureId] = useState("");
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

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

  const handleToggleApproval = async (quizId, currentApproved) => {
    try {
      await api.approveQuiz(quizId, { is_approved: !currentApproved });
      await loadQuizzes(selectedLectureId);
    } catch (err) {
      alert(err.message || "Failed to update quiz approval");
    }
  };

  const handleSaveEdit = async (quizId) => {
    try {
      await api.approveQuiz(quizId, {
        question: editForm.question,
        correct_answer: editForm.correct_answer,
        explanation: editForm.explanation,
        is_approved: editForm.is_approved,
      });
      setEditingId(null);
      await loadQuizzes(selectedLectureId);
    } catch (err) {
      alert(err.message || "Failed to save question edit");
    }
  };

  if (loading) {
    return <div className="page-loading"><div className="spinner" /> Loading quiz review center...</div>;
  }

  return (
    <div className="dashboard-page max-w-5xl">
      <div className="dashboard-header">
        <div>
          <h1>Quiz Review & Assessment Gate</h1>
          <p>
            Verify and approve AI-generated test questions. Unapproved questions remain hidden
            from students to ensure pedagogical validity.
          </p>
        </div>
      </div>

      {/* Lecture Selector */}
      <div className="card-box mb-6">
        <label>Select Lecture to Review Quizzes:</label>
        <select
          value={selectedLectureId}
          onChange={(e) => setSelectedLectureId(e.target.value)}
          className="mt-2"
        >
          {lectures.map((l) => (
            <option key={l.id} value={l.id}>
              {l.title} ({l.course_title || "General"})
            </option>
          ))}
        </select>
      </div>

      {quizzes.length === 0 ? (
        <div className="empty-state">
          <HelpCircle size={48} />
          <h3>No quiz questions generated for this lecture yet</h3>
          <p>Once a lecture finishes topic segmentation, draft questions appear here for teacher approval.</p>
        </div>
      ) : (
        <div className="quiz-list">
          {quizzes.map((q, idx) => (
            <div key={q.id} className={`quiz-review-card ${q.is_approved ? "approved" : "pending"}`}>
              <div className="quiz-card-top">
                <div className="quiz-index-badge">
                  Question {idx + 1} · Topic {q.topic_id || "1"} · {q.difficulty?.toUpperCase()}
                </div>
                <div className="quiz-status-pill">
                  {q.is_approved ? (
                    <span className="badge-approved">
                      <CheckCircle2 size={15} /> Approved (Student Visible)
                    </span>
                  ) : (
                    <span className="badge-pending">
                      <ShieldCheck size={15} /> Pending Review (Hidden from Students)
                    </span>
                  )}
                </div>
              </div>

              {editingId === q.id ? (
                <div className="inline-editor mt-4">
                  <div className="form-group">
                    <label>Question Prompt</label>
                    <input
                      type="text"
                      value={editForm.question}
                      onChange={(e) => setEditForm({ ...editForm, question: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Correct Answer</label>
                    <input
                      type="text"
                      value={editForm.correct_answer}
                      onChange={(e) => setEditForm({ ...editForm, correct_answer: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Explanation / Rationale</label>
                    <textarea
                      rows={2}
                      value={editForm.explanation}
                      onChange={(e) => setEditForm({ ...editForm, explanation: e.target.value })}
                    />
                  </div>
                  <div className="editor-actions">
                    <button onClick={() => setEditingId(null)} className="btn-sm btn-secondary">
                      Cancel
                    </button>
                    <button onClick={() => handleSaveEdit(q.id)} className="btn-sm btn-primary">
                      <Save size={14} /> Save Question
                    </button>
                  </div>
                </div>
              ) : (
                <div className="quiz-content mt-3">
                  <h3 className="quiz-question-title">{q.question}</h3>

                  <div className="options-grid">
                    {q.options?.map((opt, oIdx) => {
                      const isCorrect = opt === q.correct_answer;
                      return (
                        <div key={oIdx} className={`option-preview-pill ${isCorrect ? "correct" : ""}`}>
                          <span className="opt-letter">{String.fromCharCode(65 + oIdx)}.</span>
                          <span className="opt-text">{opt}</span>
                          {isCorrect && <Check size={16} className="text-green-500 ml-auto" />}
                        </div>
                      );
                    })}
                  </div>

                  {q.explanation && (
                    <div className="explanation-box mt-3">
                      <strong>Pedagogical Explanation:</strong>
                      <p>{q.explanation}</p>
                    </div>
                  )}

                  <div className="quiz-actions mt-4">
                    <button
                      onClick={() => {
                        setEditingId(q.id);
                        setEditForm({
                          question: q.question,
                          correct_answer: q.correct_answer,
                          explanation: q.explanation,
                          is_approved: q.is_approved,
                        });
                      }}
                      className="btn-secondary btn-sm"
                    >
                      <Edit2 size={14} /> Edit Prompt
                    </button>

                    <button
                      onClick={() => handleToggleApproval(q.id, q.is_approved)}
                      className={`btn-sm ${q.is_approved ? "btn-danger" : "btn-primary"}`}
                    >
                      {q.is_approved ? (
                        <>
                          <XCircle size={15} /> Reject Question
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={15} /> Approve for Students
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

