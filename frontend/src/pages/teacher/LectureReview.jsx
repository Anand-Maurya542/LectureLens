import React, { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../../api/client";
import VideoPlayer from "../../components/VideoPlayer";
import { StatusBadge, UncertaintyPill } from "../../components/StatusBadge";
import { formatSeconds } from "../../components/CitationCard";
import {
  Check,
  Edit2,
  Save,
  Globe,
  Lock,
  RefreshCw,
  Clock,
  Sparkles,
  Layers,
  FileText,
  AlertCircle,
} from "lucide-react";

export default function LectureReview() {
  const { id } = useParams();
  const [lecture, setLecture] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("transcript"); // transcript | topics | summaries
  const [editingSegIndex, setEditingSegIndex] = useState(null);
  const [editText, setEditText] = useState("");
  const [editingTopicId, setEditingTopicId] = useState(null);
  const [editTopicTitle, setEditTopicTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const playerRef = useRef(null);

  const fetchLecture = async () => {
    try {
      const data = await api.getLecture(id);
      setLecture(data);
    } catch (err) {
      console.error("Failed to load lecture:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLecture();
    // Poll while processing
    const interval = setInterval(() => {
      if (lecture?.status === "queued" || lecture?.status === "processing") {
        fetchLecture();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [id, lecture?.status]);

  const handleSeek = (sec) => {
    if (playerRef.current) {
      playerRef.current.seekTo(sec);
    }
  };

  const handleSaveSegment = async (segIndex) => {
    setSaving(true);
    setSaveMessage("");
    try {
      await api.editTranscript(id, segIndex, editText);
      setSaveMessage("Segment corrected and search index updated!");
      setEditingSegIndex(null);
      await fetchLecture();
    } catch (err) {
      alert(err.message || "Failed to save correction");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMessage(""), 3500);
    }
  };

  const handleSaveTopic = async (topicId) => {
    setSaving(true);
    try {
      await api.editTopic(id, topicId, {
        topic_index: topicId,
        new_title: editTopicTitle,
      });
      setEditingTopicId(null);
      await fetchLecture();
    } catch (err) {
      alert(err.message || "Failed to save topic");
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublish = async () => {
    const nextState = !lecture.is_published;
    try {
      const updated = await api.updatePublication(id, nextState);
      setLecture(updated);
    } catch (err) {
      alert(err.message || "Failed to update publication status");
    }
  };

  const handleRetry = async () => {
    try {
      await api.retryLecture(id);
      await fetchLecture();
    } catch (err) {
      alert(err.message || "Failed to retry pipeline");
    }
  };

  if (loading) {
    return <div className="page-loading"><div className="spinner" /> Loading lecture review studio...</div>;
  }

  if (!lecture) {
    return <div className="p-8">Lecture not found.</div>;
  }

  const isProcessing = lecture.status === "queued" || lecture.status === "processing";

  return (
    <div className="dashboard-page">
      {/* Top Banner */}
      <div className="review-top-bar">
        <div>
          <div className="flex items-center gap-3">
            <h2>{lecture.title}</h2>
            <StatusBadge status={lecture.status} isPublished={lecture.is_published} />
          </div>
          <p className="text-muted">
            Course: <strong>{lecture.course_title}</strong> · Language: {lecture.language?.toUpperCase() || "EN"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {lecture.status === "failed" && (
            <button onClick={handleRetry} className="btn-secondary">
              <RefreshCw size={16} /> Retry Pipeline
            </button>
          )}

          <button
            onClick={handleTogglePublish}
            disabled={isProcessing}
            className={`btn-publish ${lecture.is_published ? "unpublish" : "publish"}`}
          >
            {lecture.is_published ? (
              <>
                <Lock size={16} /> Unpublish (Hide from Students)
              </>
            ) : (
              <>
                <Globe size={16} /> Approve & Publish to Students
              </>
            )}
          </button>
        </div>
      </div>

      {lecture.status === "failed" && (
        <div
          className="alert-error my-3"
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "0.75rem",
            padding: "1rem",
            borderRadius: "8px",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
          }}
        >
          <AlertCircle size={20} style={{ flexShrink: 0, marginTop: "2px" }} />
          <div>
            <strong>Processing Failure: </strong>
            <span>{lecture.failure_reason || "An error occurred during audio processing/transcription."}</span>
            <div style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "#b91c1c" }}>
              The caption extractor has been updated. Click <strong>Retry Pipeline</strong> above to restart processing.
            </div>
          </div>
        </div>
      )}

      {saveMessage && <div className="alert-success my-3">{saveMessage}</div>}

      {isProcessing ? (
        <div className="pipeline-processing-card">
          <div className="spinner large" />
          <h3>AI Processing Pipeline Running...</h3>
          <p>
            Faster-Whisper is transcribing audio segments, computing multilingual sentence
            embeddings, segmenting thematic topic boundaries, and generating search vectors.
          </p>
          <small>Status refreshes automatically.</small>
        </div>
      ) : (
        <div className="review-layout">
          {/* Left Column: Media Player */}
          <div className="review-left">
            <div className="sticky-player">
              <VideoPlayer
                ref={playerRef}
                sourceType={lecture.source_type}
                mediaUrl={lecture.media_url}
                youtubeVideoId={lecture.youtube_video_id}
              />

              <div className="player-meta-box">
                <div className="meta-row">
                  <span>Source Type</span>
                  <strong>{lecture.source_type === "youtube" ? "YouTube Video" : "Uploaded Audio/Video"}</strong>
                </div>
                <div className="meta-row">
                  <span>Detected Segments</span>
                  <strong>{lecture.segments?.length || 0}</strong>
                </div>
                <div className="meta-row">
                  <span>Semantic Topics</span>
                  <strong>{lecture.topics?.length || 0}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Review Workspace */}
          <div className="review-right">
            {/* Tabs */}
            <div className="sub-tabs">
              <button
                className={`sub-tab ${activeTab === "transcript" ? "active" : ""}`}
                onClick={() => setActiveTab("transcript")}
              >
                <FileText size={16} />
                Transcript ({lecture.segments?.length || 0})
              </button>
              <button
                className={`sub-tab ${activeTab === "topics" ? "active" : ""}`}
                onClick={() => setActiveTab("topics")}
              >
                <Layers size={16} />
                Topics ({lecture.topics?.length || 0})
              </button>
              <button
                className={`sub-tab ${activeTab === "summaries" ? "active" : ""}`}
                onClick={() => setActiveTab("summaries")}
              >
                <Sparkles size={16} />
                Summaries ({lecture.summaries?.length || 0})
              </button>
            </div>

            {/* TAB 1: TRANSCRIPT */}
            {activeTab === "transcript" && (
              <div className="transcript-review-list">
                <div className="list-help-banner">
                  <p>
                    💡 Click any timestamp to play from that moment. Click <strong>Edit</strong> to fix
                    misrecognitions. Changes are logged and update vector search immediately.
                  </p>
                </div>

                {lecture.segments?.map((seg, idx) => (
                  <div key={idx} className={`segment-review-item ${seg.is_edited ? "edited" : ""}`}>
                    <div className="seg-meta">
                      <button
                        type="button"
                        onClick={() => handleSeek(seg.start)}
                        className="btn-time-jump"
                      >
                        <Clock size={12} />
                        {formatSeconds(seg.start)} – {formatSeconds(seg.end)}
                      </button>
                      <UncertaintyPill avgLogprob={seg.avg_logprob} />
                      {seg.is_edited && <span className="edited-badge">Teacher Edited</span>}
                    </div>

                    {editingSegIndex === idx ? (
                      <div className="inline-editor">
                        <textarea
                          rows={2}
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                        />
                        <div className="editor-actions">
                          <button
                            onClick={() => setEditingSegIndex(null)}
                            className="btn-sm btn-secondary"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSaveSegment(idx)}
                            disabled={saving}
                            className="btn-sm btn-primary"
                          >
                            <Save size={14} /> Save Correction
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="seg-body">
                        <p>{seg.text}</p>
                        <button
                          onClick={() => {
                            setEditingSegIndex(idx);
                            setEditText(seg.text);
                          }}
                          className="btn-edit-icon"
                          title="Correct transcript text"
                        >
                          <Edit2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* TAB 2: TOPICS */}
            {activeTab === "topics" && (
              <div className="topics-review-list">
                {lecture.topics?.map((top) => (
                  <div key={top.topic_id} className="topic-review-card">
                    <div className="topic-card-header">
                      <div className="topic-time-badge">
                        Topic {top.topic_id} ({formatSeconds(top.start)} – {formatSeconds(top.end)})
                      </div>
                      <button
                        onClick={() => handleSeek(top.start)}
                        className="btn-sm btn-secondary"
                      >
                        Jump to Section
                      </button>
                    </div>

                    {editingTopicId === top.topic_id ? (
                      <div className="inline-editor mt-2">
                        <input
                          type="text"
                          value={editTopicTitle}
                          onChange={(e) => setEditTopicTitle(e.target.value)}
                        />
                        <div className="editor-actions">
                          <button
                            onClick={() => setEditingTopicId(null)}
                            className="btn-sm btn-secondary"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSaveTopic(top.topic_id)}
                            className="btn-sm btn-primary"
                          >
                            Save Title
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center mt-2">
                        <h4 className="topic-title">{top.title}</h4>
                        <button
                          onClick={() => {
                            setEditingTopicId(top.topic_id);
                            setEditTopicTitle(top.title);
                          }}
                          className="btn-edit-icon"
                        >
                          <Edit2 size={14} /> Edit Title
                        </button>
                      </div>
                    )}

                    <div className="topic-segments-preview">
                      <small>Covered Passages:</small>
                      {top.segments?.slice(0, 3).map((s, i) => (
                        <p key={i}>• {s.text}</p>
                      ))}
                      {top.segments?.length > 3 && (
                        <span className="text-muted">+ {top.segments.length - 3} more segments</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB 3: SUMMARIES */}
            {activeTab === "summaries" && (
              <div className="summaries-review-list">
                {lecture.summaries?.map((summ, idx) => (
                  <div key={idx} className="summary-card">
                    <div className="summary-badge">Section {summ.topic_id} Summary</div>
                    <p className="summary-text">{summ.summary_text}</p>
                    <div className="key-points-list">
                      <strong>Salient Points:</strong>
                      <ul>
                        {summ.key_points?.map((kp, kIdx) => (
                          <li key={kIdx}>{kp}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

