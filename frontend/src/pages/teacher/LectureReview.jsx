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
  Upload,
  Video,
  FileUp,
  X,
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

  // Transcript / Subtitle supply modal & actions
  const [supplyModalOpen, setSupplyModalOpen] = useState(false);
  const [supplyTab, setSupplyTab] = useState("file"); // "file" | "paste" | "media"
  const [selectedSubFile, setSelectedSubFile] = useState(null);
  const [selectedMediaFile, setSelectedMediaFile] = useState(null);
  const [pastedTranscriptText, setPastedTranscriptText] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const subFileInputRef = useRef(null);
  const mediaFileInputRef = useRef(null);

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
      alert(err.message || "Failed to retry lecture preparation");
    }
  };

  const handleUploadSubtitles = async (fileToUpload) => {
    const file = fileToUpload || selectedSubFile;
    if (!file) {
      alert("Please select a subtitle or transcript file first (.srt, .vtt, .txt, .json).");
      return;
    }
    setIsUploading(true);
    setUploadError("");
    try {
      const updated = await api.uploadSubtitles(id, file);
      setLecture(updated);
      setSaveMessage("Subtitles imported successfully! Transcript segments, topics, and summaries generated.");
      setSupplyModalOpen(false);
      setSelectedSubFile(null);
      setTimeout(() => setSaveMessage(""), 5000);
      await fetchLecture();
    } catch (err) {
      const msg = err.message || "Failed to upload subtitles";
      setUploadError(msg);
      alert(msg);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmitPastedText = async () => {
    if (!pastedTranscriptText.trim()) {
      alert("Please enter or paste transcript text.");
      return;
    }
    setIsUploading(true);
    setUploadError("");
    try {
      const updated = await api.submitTranscriptText(id, pastedTranscriptText.trim());
      setLecture(updated);
      setSaveMessage("Transcript text parsed and applied! Topics, summaries, and quizzes generated.");
      setSupplyModalOpen(false);
      setPastedTranscriptText("");
      setTimeout(() => setSaveMessage(""), 5000);
      await fetchLecture();
    } catch (err) {
      const msg = err.message || "Failed to parse and submit transcript text";
      setUploadError(msg);
      alert(msg);
    } finally {
      setIsUploading(false);
    }
  };

  const handleAttachMediaRecording = async (fileToUpload) => {
    const file = fileToUpload || selectedMediaFile;
    if (!file) {
      alert("Please select an audio or video file first.");
      return;
    }
    setIsUploading(true);
    setUploadError("");
    try {
      const updated = await api.attachMedia(id, file);
      setLecture(updated);
      setSaveMessage("Media recording attached! Lecture preparation started.");
      setSupplyModalOpen(false);
      setSelectedMediaFile(null);
      setTimeout(() => setSaveMessage(""), 5000);
      await fetchLecture();
    } catch (err) {
      const msg = err.message || "Failed to attach media recording";
      setUploadError(msg);
      alert(msg);
    } finally {
      setIsUploading(false);
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

        <div className="flex items-center gap-2" style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          {lecture.status === "failed" && (
            <button onClick={handleRetry} className="btn-secondary">
              <RefreshCw size={16} /> Retry Preparation
            </button>
          )}

          {/* Supply Subtitles / Script Button */}
          <button
            type="button"
            onClick={() => {
              setSupplyTab("file");
              setUploadError("");
              setSupplyModalOpen(true);
            }}
            disabled={isProcessing || isUploading}
            className="btn-secondary"
            title="Upload subtitle file (.srt/.vtt) or paste transcript text"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <Upload size={16} /> Add Subtitles or Notes
          </button>

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

      {/* Hidden file inputs for direct selection */}
      <input
        ref={subFileInputRef}
        type="file"
        accept=".srt,.vtt,.txt,.json,text/plain"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            setSelectedSubFile(file);
            handleUploadSubtitles(file);
          }
          e.target.value = "";
        }}
      />
      <input
        ref={mediaFileInputRef}
        type="file"
        accept="audio/*,video/*,.mp4,.mp3,.wav,.m4a,.webm,.mov"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            setSelectedMediaFile(file);
            handleAttachMediaRecording(file);
          }
          e.target.value = "";
        }}
      />

      {lecture.status === "failed" && (
        <div
          style={{
            margin: "1rem 0",
            padding: "1.25rem",
            borderRadius: "10px",
            background: "#fff",
            border: "1px solid #fecaca",
            boxShadow: "0 2px 8px rgba(239, 68, 68, 0.08)",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", marginBottom: "1rem" }}>
            <AlertCircle size={22} style={{ color: "#dc2626", flexShrink: 0, marginTop: "2px" }} />
            <div>
              <h4 style={{ margin: "0 0 4px", color: "#991b1b", fontSize: "1.05rem", fontWeight: 700 }}>
                Automatic Captions Unavailable for this Video
              </h4>
              <p style={{ margin: 0, fontSize: "0.875rem", color: "#7f1d1d" }}>
                {lecture.failure_reason || "Captions unavailable for this YouTube video (No transcript could be retrieved for this video.)."}
              </p>
            </div>
          </div>

          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              padding: "1rem",
            }}
          >
            <p style={{ margin: "0 0 0.75rem", fontWeight: 600, fontSize: "0.875rem", color: "#1e293b" }}>
              Provide the lecture transcript or recording using one of these options to finish course preparation:
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
                gap: "12px",
              }}
            >
              {/* Option 1: Subtitle file */}
              <div
                style={{
                  background: "#fff",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  padding: "14px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, color: "#4338ca", fontSize: "0.9rem", marginBottom: "6px" }}>
                    <FileText size={18} /> Option 1: Subtitle File
                  </div>
                  <p style={{ fontSize: "0.8rem", color: "#64748b", margin: "0 0 12px" }}>
                    Upload <strong>.srt</strong>, <strong>.vtt</strong>, or <strong>.txt</strong> subtitles. LectureLens will parse timestamps, topics, and summaries automatically.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => subFileInputRef.current?.click()}
                  disabled={isUploading}
                  className="btn-primary"
                  style={{ width: "100%", fontSize: "0.82rem", padding: "7px 12px", display: "flex", justifyContent: "center", alignItems: "center", gap: "6px" }}
                >
                  <Upload size={14} /> {isUploading ? "Uploading..." : "Upload .srt / .vtt File"}
                </button>
              </div>

              {/* Option 2: Paste text */}
              <div
                style={{
                  background: "#fff",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  padding: "14px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, color: "#047857", fontSize: "0.9rem", marginBottom: "6px" }}>
                    <Edit2 size={18} /> Option 2: Paste Transcript / Notes
                  </div>
                  <p style={{ fontSize: "0.8rem", color: "#64748b", margin: "0 0 12px" }}>
                    Paste raw text or timestamped notes copied from YouTube, Notion, or your slides. Sentence timing and paragraphs will be synthesized.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSupplyTab("paste");
                    setUploadError("");
                    setSupplyModalOpen(true);
                  }}
                  disabled={isUploading}
                  className="btn-secondary"
                  style={{ width: "100%", fontSize: "0.82rem", padding: "7px 12px", borderColor: "#059669", color: "#059669", display: "flex", justifyContent: "center", alignItems: "center", gap: "6px" }}
                >
                  <FileText size={14} /> Paste Transcript Text
                </button>
              </div>

              {/* Option 3: Attach Media Recording */}
              <div
                style={{
                  background: "#fff",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  padding: "14px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, color: "#b45309", fontSize: "0.9rem", marginBottom: "6px" }}>
                    <Video size={18} /> Option 3: Upload Recording
                  </div>
                  <p style={{ fontSize: "0.8rem", color: "#64748b", margin: "0 0 12px" }}>
                    Attach an audio/video recording (.mp4, .mp3, .wav) to transcribe speech using your course key terms.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => mediaFileInputRef.current?.click()}
                  disabled={isUploading}
                  className="btn-secondary"
                  style={{ width: "100%", fontSize: "0.82rem", padding: "7px 12px", borderColor: "#d97706", color: "#b45309", display: "flex", justifyContent: "center", alignItems: "center", gap: "6px" }}
                >
                  <Upload size={14} /> {isUploading ? "Uploading..." : "Attach Audio / Video"}
                </button>
              </div>
            </div>

            <div
              style={{
                marginTop: "12px",
                paddingTop: "10px",
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "8px",
              }}
            >
              <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                Or retry the automated YouTube caption extractor with updated browser headers:
              </span>
              <button
                type="button"
                onClick={handleRetry}
                disabled={isUploading}
                className="btn-secondary"
                style={{ fontSize: "0.8rem", padding: "5px 12px", display: "flex", alignItems: "center", gap: "5px" }}
              >
                <RefreshCw size={13} /> Retry Preparation
              </button>
            </div>
          </div>
        </div>
      )}

      {saveMessage && <div className="alert-success my-3">{saveMessage}</div>}

      {isProcessing ? (
        <div className="pipeline-processing-card">
          <div className="spinner large" />
          <h3>Preparing Your Lecture...</h3>
          <p>
            We are generating the transcript, organising into topics, and preparing key summaries and quizzes.
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
                  <span>Lecture Topics</span>
                  <strong>{lecture.topics?.length || 0}</strong>
                </div>
                {courseGlossary.length > 0 && (
                  <div className="meta-row" style={{ borderTop: "1px solid #e2e8f0", paddingTop: "8px" }}>
                    <span>Course Key Terms</span>
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
                        segments.length === 0 ? (
                          <div style={{ padding: "3rem 1.5rem", textAlign: "center" }}>
                            <FileText size={40} color="#94a3b8" style={{ margin: "0 auto 10px", display: "block" }} />
                            <h4 style={{ margin: "0 0 6px", color: "#334155", fontSize: "1.05rem" }}>No Transcript Available</h4>
                            <p style={{ fontSize: "0.85rem", color: "#64748b", maxWidth: "440px", margin: "0 auto 16px" }}>
                              Supply a subtitle file or paste transcript text to generate interactive segments, topics, summaries, and quizzes.
                            </p>
                            <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
                              <button
                                type="button"
                                onClick={() => subFileInputRef.current?.click()}
                                disabled={isUploading}
                                className="btn-primary"
                                style={{ fontSize: "0.82rem", padding: "7px 14px", display: "flex", alignItems: "center", gap: "6px" }}
                              >
                                <Upload size={14} /> Upload Subtitles (.srt/.vtt)
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSupplyTab("paste");
                                  setUploadError("");
                                  setSupplyModalOpen(true);
                                }}
                                disabled={isUploading}
                                className="btn-secondary"
                                style={{ fontSize: "0.82rem", padding: "7px 14px", display: "flex", alignItems: "center", gap: "6px" }}
                              >
                                <Edit2 size={14} /> Paste Transcript / Notes
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="p-4 text-muted text-center">No segments found matching "{searchFilter}".</p>
                        )
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
                        segments.length === 0 ? (
                          <div style={{ padding: "3rem 1.5rem", textAlign: "center" }}>
                            <FileText size={40} color="#94a3b8" style={{ margin: "0 auto 10px", display: "block" }} />
                            <h4 style={{ margin: "0 0 6px", color: "#334155", fontSize: "1.05rem" }}>No Paragraphs Available</h4>
                            <p style={{ fontSize: "0.85rem", color: "#64748b", maxWidth: "440px", margin: "0 auto 16px" }}>
                              Supply a subtitle file or paste transcript text to generate student readable paragraphs.
                            </p>
                          </div>
                        ) : (
                          <p className="p-4 text-muted text-center">No paragraphs found matching "{searchFilter}".</p>
                        )
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

      {/* SUPPLY TRANSCRIPT / SUBTITLES MODAL */}
      {supplyModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: "620px", width: "95%" }}>
            <div className="modal-header">
              <h3 className="flex items-center gap-2" style={{ color: "#3730a3", fontSize: "1.2rem", fontWeight: 700 }}>
                <Upload size={20} /> Supply Subtitles or Transcript
              </h3>
              <button
                onClick={() => {
                  setSupplyModalOpen(false);
                  setUploadError("");
                }}
                className="btn-close"
              >
                ×
              </button>
            </div>

            {/* Modal Subtabs */}
            <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid #e2e8f0", paddingBottom: "10px", marginBottom: "16px" }}>
              <button
                type="button"
                className={`sub-tab ${supplyTab === "file" ? "active" : ""}`}
                onClick={() => setSupplyTab("file")}
                style={{ fontSize: "0.85rem", padding: "6px 14px", display: "flex", alignItems: "center", gap: "6px" }}
              >
                <FileText size={15} /> Subtitle File (.srt/.vtt)
              </button>
              <button
                type="button"
                className={`sub-tab ${supplyTab === "paste" ? "active" : ""}`}
                onClick={() => setSupplyTab("paste")}
                style={{ fontSize: "0.85rem", padding: "6px 14px", display: "flex", alignItems: "center", gap: "6px" }}
              >
                <Edit2 size={15} /> Paste Transcript / Notes
              </button>
              <button
                type="button"
                className={`sub-tab ${supplyTab === "media" ? "active" : ""}`}
                onClick={() => setSupplyTab("media")}
                style={{ fontSize: "0.85rem", padding: "6px 14px", display: "flex", alignItems: "center", gap: "6px" }}
              >
                <Video size={15} /> Audio/Video File
              </button>
            </div>

            <div className="modal-body" style={{ maxHeight: "65vh", overflowY: "auto" }}>
              {uploadError && (
                <div className="alert-error mb-3" style={{ padding: "8px 12px", fontSize: "0.85rem" }}>
                  {uploadError}
                </div>
              )}

              {/* TAB 1: FILE UPLOAD */}
              {supplyTab === "file" && (
                <div>
                  <p style={{ margin: "0 0 12px", fontSize: "0.875rem", color: "#475569" }}>
                    Select a subtitle or transcript file from your computer. Supported formats: <strong>.srt</strong>, <strong>.vtt</strong>, <strong>.txt</strong>, or <strong>.json</strong>.
                  </p>

                  <div
                    style={{
                      border: "2px dashed #cbd5e1",
                      borderRadius: "8px",
                      padding: "24px 16px",
                      textAlign: "center",
                      background: "#f8fafc",
                      cursor: "pointer",
                      marginBottom: "14px",
                    }}
                    onClick={() => subFileInputRef.current?.click()}
                  >
                    <FileUp size={36} color="#6366f1" style={{ margin: "0 auto 10px", display: "block" }} />
                    <p style={{ margin: "0 0 4px", fontWeight: 600, color: "#1e293b", fontSize: "0.95rem" }}>
                      {selectedSubFile ? selectedSubFile.name : "Click to select a subtitle file"}
                    </p>
                    <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                      {selectedSubFile
                        ? `${(selectedSubFile.size / 1024).toFixed(1)} KB`
                        : "Browse SubRip (.srt), WebVTT (.vtt), or raw text (.txt)"}
                    </span>
                  </div>

                  <div style={{ background: "#f1f5f9", padding: "10px 14px", borderRadius: "6px", fontSize: "0.8rem", color: "#475569" }}>
                    💡 <strong>Pro Tip:</strong> Subtitle files preserve exact video playback timestamps, allowing students to click transcript segments and jump directly to key concepts in the video.
                  </div>
                </div>
              )}

              {/* TAB 2: PASTE TEXT */}
              {supplyTab === "paste" && (
                <div>
                  <p style={{ margin: "0 0 8px", fontSize: "0.875rem", color: "#475569" }}>
                    Paste your lecture transcript, speaker notes, or YouTube auto-captions text below:
                  </p>
                  <textarea
                    rows={8}
                    value={pastedTranscriptText}
                    onChange={(e) => setPastedTranscriptText(e.target.value)}
                    placeholder={`Paste transcript text here...

Supported styles:
1. Timestamped lines:
   [00:00] In this lecture we discuss integrity constraints.
   [01:15] Domain constraints ensure column data integrity...

2. Raw text:
   Relational model constraints specify restrictions on database states. We explore domain constraints, key constraints, and foreign key integrity.`}
                    style={{
                      width: "100%",
                      padding: "12px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      fontFamily: "monospace",
                      fontSize: "0.85rem",
                      lineHeight: "1.5",
                      boxSizing: "border-box",
                    }}
                  />
                  <small style={{ color: "#64748b", display: "block", marginTop: "4px" }}>
                    {pastedTranscriptText.trim().split(/\s+/).filter(Boolean).length} words detected.
                  </small>
                </div>
              )}

              {/* TAB 3: MEDIA RECORDING */}
              {supplyTab === "media" && (
                <div>
                  <p style={{ margin: "0 0 12px", fontSize: "0.875rem", color: "#475569" }}>
                    Upload an audio or video recording file. LectureLens will transcribe the audio, recognise course key terms, and organise the lecture into topics.
                  </p>

                  <div
                    style={{
                      border: "2px dashed #cbd5e1",
                      borderRadius: "8px",
                      padding: "24px 16px",
                      textAlign: "center",
                      background: "#f8fafc",
                      cursor: "pointer",
                      marginBottom: "14px",
                    }}
                    onClick={() => mediaFileInputRef.current?.click()}
                  >
                    <Video size={36} color="#d97706" style={{ margin: "0 auto 10px", display: "block" }} />
                    <p style={{ margin: "0 0 4px", fontWeight: 600, color: "#1e293b", fontSize: "0.95rem" }}>
                      {selectedMediaFile ? selectedMediaFile.name : "Click to select audio / video file"}
                    </p>
                    <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                      {selectedMediaFile
                        ? `${(selectedMediaFile.size / (1024 * 1024)).toFixed(2)} MB`
                        : "Supports .mp4, .mp3, .wav, .m4a, .webm, .mov"}
                    </span>
                  </div>

                  {courseGlossary.length > 0 && (
                    <div style={{ background: "#f1f5f9", padding: "10px 14px", borderRadius: "6px", fontSize: "0.8rem", color: "#475569" }}>
                      <strong>Active Course Key Terms:</strong>{" "}
                      {courseGlossary.map((g) => g.term).slice(0, 8).join(", ")}
                      {courseGlossary.length > 8 && ` (+${courseGlossary.length - 8} more)`}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ marginTop: "16px", paddingTop: "12px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                type="button"
                onClick={() => {
                  setSupplyModalOpen(false);
                  setUploadError("");
                }}
                disabled={isUploading}
                className="btn-secondary"
              >
                Cancel
              </button>

              {supplyTab === "file" && (
                <button
                  type="button"
                  onClick={() => handleUploadSubtitles()}
                  disabled={isUploading || !selectedSubFile}
                  className="btn-primary"
                >
                  {isUploading ? "Uploading & Processing..." : "Upload Subtitles"}
                </button>
              )}

              {supplyTab === "paste" && (
                <button
                  type="button"
                  onClick={handleSubmitPastedText}
                  disabled={isUploading || !pastedTranscriptText.trim()}
                  className="btn-primary"
                >
                  {isUploading ? "Parsing & Generating..." : "Apply Transcript"}
                </button>
              )}

              {supplyTab === "media" && (
                <button
                  type="button"
                  onClick={() => handleAttachMediaRecording()}
                  disabled={isUploading || !selectedMediaFile}
                  className="btn-primary"
                >
                  {isUploading ? "Uploading..." : "Upload Recording & Transcribe"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
