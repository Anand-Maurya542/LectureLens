import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../../api/client";
import {
  HelpCircle,
  CheckCircle2,
  XCircle,
  Award,
  ArrowLeft,
  RotateCcw,
  Sparkles,
} from "lucide-react";

export default function QuizExperience() {
  const { id } = useParams();
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [attemptResult, setAttemptResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function fetchQuizzes() {
      try {
        const data = await api.getLectureQuizzes(id);
        setQuestions(data || []);
      } catch (err) {
        console.error("Failed to load quizzes:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchQuizzes();
  }, [id]);

  const handleSelectOption = (questionId, option) => {
    if (attemptResult) return; // Prevent changing after submission
    setAnswers({
      ...answers,
      [questionId]: option,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (Object.keys(answers).length < questions.length) {
      if (!confirm("You have not answered all questions. Submit anyway?")) {
        return;
      }
    }

    setSubmitting(true);
    try {
      const result = await api.submitQuizAttempt(id, answers);
      setAttemptResult(result);
    } catch (err) {
      alert(err.message || "Failed to submit quiz attempt");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setAnswers({});
    setAttemptResult(null);
  };

  if (loading) {
    return <div className="page-loading"><div className="spinner" /> Loading quiz module...</div>;
  }

  if (questions.length === 0) {
    return (
      <div className="dashboard-page max-w-3xl">
        <Link to={`/student/lectures/${id}`} className="btn-link mb-4 inline-flex items-center gap-1">
          <ArrowLeft size={16} /> Back to Lecture
        </Link>
        <div className="empty-state">
          <HelpCircle size={48} />
          <h3>No approved quizzes available</h3>
          <p>Your instructor has not approved test questions for this lecture yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page max-w-3xl">
      <Link to={`/student/lectures/${id}`} className="btn-link mb-4 inline-flex items-center gap-1">
        <ArrowLeft size={16} /> Back to Lecture Workspace
      </Link>

      <div className="dashboard-header">
        <div>
          <h1>Lecture Knowledge Check</h1>
          <p>Test your understanding of core concepts from this lecture.</p>
        </div>
      </div>

      {/* Attempt Score Banner */}
      {attemptResult && (
        <div className="quiz-result-banner mb-6">
          <div className="result-score-circle">
            <Award size={32} />
            <span className="score-num">{attemptResult.percentage}%</span>
          </div>
          <div className="result-text">
            <h3>
              {attemptResult.percentage >= 70 ? "Excellent Mastery! 🎉" : "Review Recommended 💡"}
            </h3>
            <p>
              You got <strong>{attemptResult.correct_count}</strong> out of{" "}
              <strong>{attemptResult.total_questions}</strong> questions correct.
            </p>
            {attemptResult.weak_topics?.length > 0 && (
              <Link to="/student/revision" className="btn-secondary btn-sm mt-2 inline-flex">
                View Revision Recommendations
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Questions Form */}
      <form onSubmit={handleSubmit} className="quiz-form">
        {questions.map((q, idx) => {
          const resultItem = attemptResult?.results?.find((r) => r.question_id === q.id);
          const selectedAnswer = answers[q.id];

          return (
            <div
              key={q.id}
              className={`quiz-card ${
                resultItem ? (resultItem.is_correct ? "graded-correct" : "graded-incorrect") : ""
              }`}
            >
              <div className="quiz-num">
                Question {idx + 1} of {questions.length}
              </div>
              <h3 className="quiz-prompt">{q.question}</h3>

              <div className="options-stack mt-4">
                {q.options?.map((opt, oIdx) => {
                  const isSelected = selectedAnswer === opt;
                  let optionClass = "option-btn";
                  if (isSelected) optionClass += " selected";

                  if (resultItem) {
                    if (opt === resultItem.correct_answer) {
                      optionClass += " is-correct-answer";
                    } else if (isSelected && !resultItem.is_correct) {
                      optionClass += " is-wrong-answer";
                    }
                  }

                  return (
                    <button
                      key={oIdx}
                      type="button"
                      disabled={!!attemptResult}
                      className={optionClass}
                      onClick={() => handleSelectOption(q.id, opt)}
                    >
                      <span className="opt-marker">{String.fromCharCode(65 + oIdx)}</span>
                      <span className="opt-label">{opt}</span>
                    </button>
                  );
                })}
              </div>

              {/* Post-submission explanation */}
              {resultItem && (
                <div className="quiz-explanation-box mt-4">
                  <div className="flex items-center gap-2 mb-1">
                    {resultItem.is_correct ? (
                      <span className="text-green-600 font-semibold flex items-center gap-1">
                        <CheckCircle2 size={16} /> Correct!
                      </span>
                    ) : (
                      <span className="text-red-500 font-semibold flex items-center gap-1">
                        <XCircle size={16} /> Incorrect (Correct answer: {resultItem.correct_answer})
                      </span>
                    )}
                  </div>
                  <p>{resultItem.explanation}</p>
                </div>
              )}
            </div>
          );
        })}

        <div className="quiz-form-footer mt-6">
          {attemptResult ? (
            <button type="button" onClick={handleReset} className="btn-secondary">
              <RotateCcw size={16} /> Retake Quiz
            </button>
          ) : (
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full justify-center"
            >
              {submitting ? "Evaluating Responses..." : "Submit Answers"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

