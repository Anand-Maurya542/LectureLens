import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import {
  Brain,
  PlayCircle,
  Clock,
  BookOpen,
  AlertTriangle,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { formatSeconds } from "../../components/CitationCard";

export default function RevisionPlan() {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRecs() {
      try {
        const data = await api.getRevisionRecommendations();
        setRecommendations(data || []);
      } catch (err) {
        console.error("Failed to load recommendations:", err);
      } finally {
        setLoading(false);
      }
    }
    loadRecs();
  }, []);

  if (loading) {
    return <div className="page-loading"><div className="spinner" /> Preparing your study plan...</div>;
  }

  return (
    <div className="dashboard-page max-w-4xl">
      <div className="dashboard-header">
        <div>
          <div className="flex items-center gap-2">
            <Brain size={28} className="text-purple-600" />
            <h1>My Study Plan</h1>
          </div>
          <p>
            Personalised review suggestions based on your quiz results. Focus your study time on topics where you need more practice.
          </p>
        </div>
      </div>

      {recommendations.length === 0 ? (
        <div className="empty-state">
          <Sparkles size={48} />
          <h3>You are all caught up!</h3>
          <p>No review topics needed right now. Take quizzes after lectures to get personalised revision suggestions.</p>
          <Link to="/student" className="btn-primary mt-4">
            Explore Lectures
          </Link>
        </div>
      ) : (
        <div className="revision-list">
          {recommendations.map((rec, idx) => (
            <div key={idx} className="revision-card">
              <div className="revision-card-top">
                <span className="badge-lecture-title">{rec.lecture_title}</span>
                <span className="badge-weakness">
                  Review Priority: {Math.round(rec.weakness_score * 100)}%
                </span>
              </div>

              <h3 className="revision-topic-title">
                Topic {rec.topic_id}: {rec.topic_title}
              </h3>

              <div className="revision-reason-box">
                <AlertTriangle size={16} className="text-amber-500" />
                <span>{rec.reason}</span>
              </div>

              <div className="revision-actions mt-4">
                <Link to={rec.timestamp_url} className="btn-primary">
                  <PlayCircle size={16} />
                  <span>
                    Watch Explanation at {formatSeconds(rec.suggested_start_time)}
                  </span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

