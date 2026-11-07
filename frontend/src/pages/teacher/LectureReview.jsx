import React, { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../../api/client";
import VideoPlayer from "../../components/VideoPlayer";
import { StatusBadge, UncertaintyPill } from "../../components/StatusBadge";
import {
  groupSegmentsIntoParagraphs,
  formatSeconds,
  exportTranscriptFile,
  copyTranscriptToClipboard,
  highlightSearchText,
} from "../../utils/transcriptUtils";
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
  CheckCircle2,
  XCircle,
  Copy,
  Download,
  Search,
  AlignLeft,
  List,
  RotateCcw,
  BookOpen,
  ChevronDown,
  ShieldCheck,
} from "lucide-react";

export default function LectureReview() {
  const { id } = useParams();
  const [lecture, setLecture] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("transcript"); // transcript | topics | summaries

  // Video sync and transcript playback tracking
  const [currentTime, setCurrentTime] = useState(0);
  const [autoScroll, setAutoScroll] = useState(true);
  const [viewMode, setViewMode] = useState("segments"); // "segments" | "paragraphs"
  const [searchFilter, setSearchFilter] = useState("");
  const [showOriginalComparison, setShowOriginalComparison] = useState(false);

  // Segment editing state
  const [editingSegIndex, setEditingSegIndex] = useState(null);
  const [editText, setEditText] = useState("");
  const [editingTopicId, setEditingTopicId] = useState(null);
  const [editTopicTitle, setEditTopicTitle] = useState("");

  // Approval & action state
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [copiedSuccess, setCopiedSuccess] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [courseGlossary, setCourseGlossary] = useState([]);

  const playerRef = useRef(null);
  const activeItemRef = useRef(null);
  const transcriptContainerRef = useRef(null);

  const fetchLecture = async () => {
    try {
      const data = await api.getLecture(id);
      setLecture(data);
      if (data?.course_id) {
        try {
          const gRes = await api.getCourseGlossary(data.course_id);
          if (gRes?.glossary) {
            setCourseGlossary(gRes.glossary);
          }
        } catch {
          // Non-blocking
        }
      }
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

  const segments = lecture?.segments || [];
  const paragraphs = React.useMemo(() => {
    if (lecture?.paragraphs && lecture.paragraphs.length > 0) {
      return lecture.paragraphs;
    }
    return groupSegmentsIntoParagraphs(segments);
  }, [lecture?.paragraphs, segments]);

  const activeSegmentIndex = segments.findIndex(
    (s) => currentTime >= s.start && currentTime <= s.end
  );

  const activeParagraphIndex = paragraphs.findIndex(
    (p) => currentTime >= p.start && currentTime <= p.end
  );

  useEffect(() => {
    if (autoScroll && activeItemRef.current && transcriptContainerRef.current) {
      activeItemRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [activeSegmentIndex, activeParagraphIndex, autoScroll, viewMode]);

  const handleSeek = (sec) => {
    if (playerRef.current) {
      playerRef.current.seekTo(sec);
    }
  };

  const handleSaveSegment = async (segIndex) => {
    if (!editText.trim()) return;
    setSaving(true);
    setSaveMessage("");
    try {
      await api.editTranscript(id, segIndex, editText.trim());
      setSaveMessage("Correction saved to database and search chunks re-indexed!");
      setEditingSegIndex(null);
      await fetchLecture();
    } catch (err) {
      alert(err.message || "Failed to save correction");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMessage(""), 4000);
    }
  };

  const handleRevertToOriginal = async (segIndex, originalText) => {
    if (!originalText) return;
    if (!window.confirm("Revert this segment back to the original AI-generated text?")) return;
    setSaving(true);
    try {
      await api.editTranscript(id, segIndex, originalText);
      setSaveMessage("Reverted to original AI transcript.");
      setEditingSegIndex(null);
      await fetchLecture();
    } catch (err) {
      alert(err.message || "Failed to revert segment");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMessage(""), 3500);
    }
  };

  const handleApproveTranscript = async (publishToStudents = false) => {
    setSaving(true);
    try {
      const res = await api.approveTranscript(id, {
        publish_to_students: publishToStudents,
      });
      setSaveMessage(res.message || "Transcript approved successfully!");
      await fetchLecture();
    } catch (err) {
      alert(err.message || "Failed to approve transcript");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMessage(""), 4000);
    }
  };

  const handleRejectTranscript = async () => {
    if (!rejectionReason.trim()) return;
    setSaving(true);
    try {
      await api.rejectTranscript(id, rejectionReason.trim());
      setSaveMessage("Transcript marked as rejected for revision.");
      setRejectModalOpen(false);
      setRejectionReason("");
      await fetchLecture();
    } catch (err) {
      alert(err.message || "Failed to reject transcript");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMessage(""), 4000);
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

  const handleCopyTranscript = async () => {
    const items = viewMode === "paragraphs" ? paragraphs : segments;
    const ok = await copyTranscriptToClipboard(items, lecture?.title);
    if (ok) {
      setCopiedSuccess(true);
      setTimeout(() => setCopiedSuccess(false), 2500);
    }
  };

  const handleExport = (format) => {
    setShowExportMenu(false);
    exportTranscriptFile(segments, paragraphs, lecture?.title, format);
  };

  const filteredSegments = segments.filter((s) =>
    (s.text || "").toLowerCase().includes(searchFilter.toLowerCase().trim())
  );

  const filteredParagraphs = paragraphs.filter((p) =>
    (p.text || "").toLowerCase().includes(searchFilter.toLowerCase().trim())
  );

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" /> Loading lecture review studio...
      </div>
    );
  }

  if (!lecture) {
    return <div className="p-8">Lecture not found.</div>;
  }

  const isProcessing = lecture.status === "queued" || lecture.status === "processing";
  const transcriptStatus = lecture.transcript_status || "ai_generated";
  const editedCount = segments.filter((s) => s.is_edited).length;

  return (
    <div className="dashboard-page">
      {/* Top Banner */}
      <div className="review-top-bar">
        <div>
          <div className="flex items-center gap-3">
            <h2>{lecture.title}</h2>
            <StatusBadge status={lecture.status} isPublished={lecture.is_published} />
            <span
              className={`badge ${
                transcriptStatus === "approved"
                  ? "badge-success"
                  : transcriptStatus === "rejected"
                  ? "badge-danger"
                  : transcriptStatus === "in_review"
                  ? "badge-warning"
                  : "badge-secondary"
              }`}
              style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
            >
              <ShieldCheck size={12} />
              Transcript: {transcriptStatus.replace(/_/g, " ").toUpperCase()}
            </span>
          </div>
          <p className="text-muted mt-1">
            Course: <strong>{lecture.course_title}</strong> · Language:{" "}
            <strong>{lecture.language?.toUpperCase() || "EN"}</strong>
            {courseGlossary.length > 0 && (
              <span> · Technical Glossary: <strong>{courseGlossary.length} terms active</strong></span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {lecture.status === "failed" && (
            <button onClick={handleRetry} className="btn-secondary">
              <RefreshCw size={16} /> Retry Pipeline
            </button>
          )}

          {/* Transcript Approval Buttons */}
          {transcriptStatus !== "approved" && !isProcessing && (
            <>
              <button
                type="button"
                onClick={() => handleApproveTranscript(false)}
                disabled={saving}
                className="btn-secondary"
                style={{ borderColor: "#10b981", color: "#059669" }}
                title="Mark transcript verified & approved"
              >
                <CheckCircle2 size={16} /> Approve Transcript
              </button>
              <button
                type="button"
                onClick={() => setRejectModalOpen(true)}
                disabled={saving}
                className="btn-secondary"
                style={{ borderColor: "#ef4444", color: "#dc2626" }}
                title="Flag transcript for revision"
              >
                <XCircle size={16} /> Flag Revision
              </button>
            </>
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
              Click <strong>Retry Pipeline</strong> above to restart audio extraction.
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
            Faster-Whisper is transcribing audio with glossary vocabulary, generating multilingual
            embeddings, segmenting semantic topic boundaries, and creating search vectors.
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
                onTimeUpdate={(t) => setCurrentTime(t)}
              />

              <div className="player-meta-box">
                <div className="meta-row">
                  <span>Source Type</span>
                  <strong>{lecture.source_type === "youtube" ? "YouTube Video" : "Uploaded Media"}</strong>
                </div>
                <div className="meta-row">
                  <span>Detected Segments</span>
                  <strong>{segments.length} ({editedCount} edited)</strong>
                </div>
                <div className="meta-row">
                  <span>Grouped Paragraphs</span>
                  <strong>{paragraphs.length}</strong>
                </div>
                <div className="meta-row">
                  <span>Semantic Topics</span>
                  <strong>{lecture.topics?.length || 0}</strong>
                </div>
                {courseGlossary.length > 0 && (
                  <div className="meta-row" style={{ borderTop: "1px solid #e2e8f0", paddingTop: "8px" }}>
                    <span>Active Technical Terms</span>
                    <strong style={{ color: "#6366f1" }}>{courseGlossary.length} terms</strong>
                  </div>
                )}
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
                Transcript ({segments.length})
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

            {/* TAB 1: TRANSCRIPT MANAGEMENT & CORRECTION */}
            {activeTab === "transcript" && (
              <div className="transcript-panel">
                {/* Toolbar */}
                <div className="transcript-toolbar">
                  <div className="transcript-search-box">
                    <Search size={15} className="search-icon" />
                    <input
                      type="text"
                      placeholder="Search words in transcript..."
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                    />
                    {searchFilter && (
                      <button
                        type="button"
                        className="search-clear-btn"
                        onClick={() => setSearchFilter("")}
                      >
                        ×
                      </button>
                    )}
                  </div>

                  <div className="transcript-actions">
                    {/* View Mode Switcher */}
                    <div className="view-mode-toggle">
                      <button
                        type="button"
                        className={`btn-mode ${viewMode === "segments" ? "active" : ""}`}
                        onClick={() => setViewMode("segments")}
                        title="Edit individual short speech segments"
                      >
                        <List size={13} /> Segments
                      </button>
                      <button
                        type="button"
                        className={`btn-mode ${viewMode === "paragraphs" ? "active" : ""}`}
                        onClick={() => setViewMode("paragraphs")}
                        title="Preview student readable paragraph flow"
                      >
                        <AlignLeft size={13} /> Paragraphs
                      </button>
                    </div>

                    {/* Original Comparison Toggle */}
                    <label
                      className="auto-scroll-toggle"
                      style={{ cursor: "pointer" }}
                      title="Show original AI transcription vs corrected text"
                    >
                      <input
                        type="checkbox"
                        checked={showOriginalComparison}
                        onChange={(e) => setShowOriginalComparison(e.target.checked)}
                      />
                      <span>Compare AI</span>
                    </label>

                    {/* Auto-Scroll Toggle */}
                    <label className="auto-scroll-toggle" title="Follow playback position">
                      <input
                        type="checkbox"
                        checked={autoScroll}
                        onChange={(e) => setAutoScroll(e.target.checked)}
                      />
                      <span>Follow</span>
                    </label>

                    {/* Copy Button */}
                    <button
                      type="button"
                      onClick={handleCopyTranscript}
                      className="btn-toolbar-action"
                      title="Copy full transcript"
                    >
                      {copiedSuccess ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                      <span>{copiedSuccess ? "Copied" : "Copy"}</span>
                    </button>

                    {/* Export Dropdown */}
                    <div style={{ position: "relative" }}>
                      <button
                        type="button"
                        onClick={() => setShowExportMenu(!showExportMenu)}
                        className="btn-toolbar-action"
                        title="Download transcript file"
                      >
                        <Download size={14} />
                        <span>Export</span>
                        <ChevronDown size={12} />
                      </button>

                      {showExportMenu && (
                        <div className="export-dropdown-menu">
                          <button type="button" onClick={() => handleExport("txt")}>
                            📄 Text (.txt)
                          </button>
                          <button type="button" onClick={() => handleExport("srt")}>
                            🎬 Subtitles (.srt)
                          </button>
                          <button type="button" onClick={() => handleExport("vtt")}>
                            🌐 WebVTT (.vtt)
                          </button>
                          <button type="button" onClick={() => handleExport("json")}>
                            📦 Data (.json)
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Instruction banner */}
                <div className="list-help-banner">
                  <p>
                    💡 Click any timestamp to play video from that point. Click <strong>Edit</strong> to
                    correct misrecognized technical terms. Original AI transcripts are permanently preserved for audit.
                  </p>
                </div>

                {/* Scrollable Container */}
                <div
                  className="transcript-scroll"
                  ref={transcriptContainerRef}
                  style={{ maxHeight: "560px", overflowY: "auto" }}
                >
                  {/* SEGMENTS VIEW (Default for Editing) */}
                  {viewMode === "segments" && (
                    <div className="segments-review-stream">
                      {filteredSegments.length === 0 ? (
                        <p className="p-4 text-muted text-center">No segments found matching filter.</p>
                      ) : (
                        filteredSegments.map((seg, idx) => {
                          const isCurrent = activeSegmentIndex === idx;
                          const hasEdit = seg.is_edited;
                          return (
                            <div
                              key={seg.segment_index ?? idx}
                              ref={isCurrent ? activeItemRef : null}
                              className={`segment-review-item ${hasEdit ? "edited" : ""} ${
                                isCurrent ? "active-row" : ""
                              }`}
                            >
                              <div className="seg-meta">
                                <button
                                  type="button"
                                  onClick={() => handleSeek(seg.start)}
                                  className="btn-time-jump"
                                  title={`Seek to ${formatSeconds(seg.start)}`}
                                >
                                  <Clock size={12} />
                                  {formatSeconds(seg.start)} – {formatSeconds(seg.end)}
                                </button>
                                <UncertaintyPill avgLogprob={seg.avg_logprob} />
                                {hasEdit && (
                                  <span className="edited-badge" title="Manually corrected by faculty">
                                    Teacher Corrected
                                  </span>
                                )}
                              </div>

                              {editingSegIndex === idx ? (
                                <div className="inline-editor">
                                  {/* Original AI reference box */}
                                  <div
                                    style={{
                                      background: "#f1f5f9",
                                      border: "1px dashed #cbd5e1",
                                      borderRadius: "6px",
                                      padding: "8px 10px",
                                      fontSize: "0.82rem",
                                      color: "#64748b",
                                      marginBottom: "6px",
                                    }}
                                  >
                                    <strong>Original AI Output: </strong>
                                    <span>{seg.original_text || seg.text}</span>
                                  </div>

                                  <textarea
                                    rows={3}
                                    value={editText}
                                    onChange={(e) => setEditText(e.target.value)}
                                    placeholder="Enter corrected sentence or technical term..."
                                    style={{ width: "100%", padding: "8px", fontSize: "0.92rem" }}
                                  />

                                  <div className="editor-actions">
                                    {seg.is_edited && seg.original_text && (
                                      <button
                                        type="button"
                                        onClick={() => handleRevertToOriginal(idx, seg.original_text)}
                                        className="btn-sm btn-secondary"
                                        style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
                                      >
                                        <RotateCcw size={13} /> Revert to AI
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => setEditingSegIndex(null)}
                                      className="btn-sm btn-secondary"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
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
                                  <div style={{ flex: 1 }}>
                                    <p className="seg-text">
                                      {searchFilter
                                        ? highlightSearchText(seg.text, searchFilter)
                                        : seg.text}
                                    </p>

                                    {/* Optional side-by-side / underneath AI Comparison */}
                                    {showOriginalComparison && hasEdit && (
                                      <div
                                        style={{
                                          marginTop: "4px",
                                          fontSize: "0.78rem",
                                          color: "#94a3b8",
                                          textDecoration: "line-through",
                                        }}
                                      >
                                        AI original: {seg.original_text}
                                      </div>
                                    )}
                                  </div>

                                  <button
                                    onClick={() => {
                                      setEditingSegIndex(idx);
                                      setEditText(seg.text);
                                    }}
                                    className="btn-edit-icon"
                                    title="Correct recognized sentence"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {/* PARAGRAPHS VIEW (Preview of Student View) */}
                  {viewMode === "paragraphs" && (
                    <div className="paragraphs-stream">
                      {filteredParagraphs.length === 0 ? (
                        <p className="p-4 text-muted text-center">No paragraphs found matching filter.</p>
                      ) : (
                        filteredParagraphs.map((para, pIdx) => {
                          const isCurrent = activeParagraphIndex === pIdx;
                          return (
                            <div
                              key={para.paragraph_index ?? pIdx}
                              ref={isCurrent ? activeItemRef : null}
                              className={`transcript-para-card ${isCurrent ? "active-card" : ""}`}
                            >
                              <div className="para-header">
                                <button
                                  type="button"
                                  className="para-time-pill"
                                  onClick={() => handleSeek(para.start)}
                                  title={`Seek to ${formatSeconds(para.start)}`}
                                >
                                  <Clock size={12} />
                                  <span>
                                    {formatSeconds(para.start)} – {formatSeconds(para.end)}
                                  </span>
                                </button>
                                {para.is_edited && (
                                  <span className="instructor-corrected-pill">Teacher Edited</span>
                                )}
                              </div>
                              <p className="para-body-text">
                                {searchFilter
                                  ? highlightSearchText(para.text, searchFilter)
                                  : para.text}
                              </p>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
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
                            disabled={saving}
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
                          <Edit2 size={14} />
                        </button>
                      </div>
                    )}

                    <div className="topic-segments-preview">
                      {top.segments?.slice(0, 3).map((s, i) => (
                        <p key={i}>• {s.text}</p>
                      ))}
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
                    <div className="summary-badge">Section {summ.topic_id} Key Points</div>
                    <p className="summary-text">{summ.summary_text}</p>
                    <ul className="key-points-list mt-2">
                      {summ.key_points?.map((kp, kIdx) => (
                        <li key={kIdx}>{kp}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* REJECTION REASON MODAL */}
      {rejectModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: "480px" }}>
            <div className="modal-header">
              <h3 className="flex items-center gap-2" style={{ color: "#ef4444" }}>
                <XCircle size={20} /> Flag Transcript for Revision
              </h3>
              <button onClick={() => setRejectModalOpen(false)} className="btn-close">
                ×
              </button>
            </div>
            <div className="modal-body">
              <p style={{ margin: "0 0 10px", fontSize: "0.9rem" }}>
                Provide feedback or reason for rejecting this transcript so instructors/contributors can address issues before student publication:
              </p>
              <textarea
                rows={4}
                required
                placeholder="e.g. Technical jargon in Topic 2 misrecognized; audio quality in first 5 minutes caused incomplete sentences."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                style={{ width: "100%", padding: "10px", borderRadius: "6px" }}
              />
            </div>
            <div className="modal-footer">
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectTranscript}
                disabled={saving || !rejectionReason.trim()}
                className="btn-danger"
              >
                Submit Flag
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
