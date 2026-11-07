import React, { useState, useEffect, useRef } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { api } from "../../api/client";
import VideoPlayer from "../../components/VideoPlayer";
import {
  groupSegmentsIntoParagraphs,
  formatSeconds,
  exportTranscriptFile,
  copyTranscriptToClipboard,
  highlightSearchText,
} from "../../utils/transcriptUtils";
import {
  Clock,
  Search,
  BookOpen,
  Layers,
  Sparkles,
  HelpCircle,
  MessageSquare,
  PlayCircle,
  Copy,
  Download,
  Check,
  List,
  AlignLeft,
  ChevronDown,
  RotateCcw,
} from "lucide-react";

export default function LectureViewer() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [lecture, setLecture] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [activeTab, setActiveTab] = useState("transcript"); // transcript | topics | summaries | qa

  // Video sync and transcript playback tracking
  const [currentTime, setCurrentTime] = useState(0);
  const [autoScroll, setAutoScroll] = useState(true);
  const [viewMode, setViewMode] = useState("paragraphs"); // "paragraphs" | "segments"
  const [searchFilter, setSearchFilter] = useState("");
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  // Grounded QA state
  const [qaQuery, setQaQuery] = useState("");
  const [qaResponse, setQaResponse] = useState(null);
  const [qaLoading, setQaLoading] = useState(false);

  const playerRef = useRef(null);
  const activeItemRef = useRef(null);
  const transcriptContainerRef = useRef(null);

  useEffect(() => {
    async function loadLecture() {
      try {
        setLoading(true);
        setErrorMessage("");
        const data = await api.getLecture(id);
        setLecture(data);
      } catch (err) {
        console.error("Failed to load lecture:", err);
        setErrorMessage(
          err.message || "Unable to load this lecture. Please verify your course enrollment."
        );
      } finally {
        setLoading(false);
      }
    }
    loadLecture();
  }, [id]);

  // Jump to URL timestamp parameter if provided (e.g. ?t=45)
  useEffect(() => {
    const tParam = searchParams.get("t");
    if (tParam && playerRef.current) {
      const sec = parseFloat(tParam);
      if (!isNaN(sec)) {
        setTimeout(() => playerRef.current?.seekTo(sec), 800);
      }
    }
  }, [searchParams, lecture]);

  // Derived paragraphs from lecture segments
  const segments = lecture?.segments || [];
  const paragraphs = React.useMemo(() => {
    if (lecture?.paragraphs && lecture.paragraphs.length > 0) {
      return lecture.paragraphs;
    }
    return groupSegmentsIntoParagraphs(segments);
  }, [lecture?.paragraphs, segments]);

  // Calculate currently active segment and paragraph based on video currentTime
  const activeSegmentIndex = segments.findIndex(
    (s) => currentTime >= s.start && currentTime <= s.end
  );

  const activeParagraphIndex = paragraphs.findIndex(
    (p) => currentTime >= p.start && currentTime <= p.end
  );

  // Automatically scroll active transcript item into view during playback
  useEffect(() => {
    if (autoScroll && activeItemRef.current && transcriptContainerRef.current) {
      activeItemRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [activeSegmentIndex, activeParagraphIndex, autoScroll, viewMode]);

  const handleSeek = (seconds) => {
    if (playerRef.current) {
      playerRef.current.seekTo(seconds);
    }
  };

  const handleCopyTranscript = async () => {
    const itemsToCopy = viewMode === "paragraphs" ? paragraphs : segments;
    const success = await copyTranscriptToClipboard(itemsToCopy, lecture?.title);
    if (success) {
      setCopiedSuccess(true);
      setTimeout(() => setCopiedSuccess(false), 2500);
    }
  };

  const handleExport = (format) => {
    setShowExportMenu(false);
    exportTranscriptFile(segments, paragraphs, lecture?.title, format);
  };

  const handleAskQuestion = async (e) => {
    e.preventDefault();
    if (!qaQuery.trim()) return;
    setQaLoading(true);
    setQaResponse(null);
    try {
      const res = await api.askQuestion(qaQuery.trim(), {
        lecture_id: id,
        course_id: lecture?.course_id,
      });
      setQaResponse(res);
    } catch (err) {
      alert(err.message || "Failed to retrieve grounded answer");
    } finally {
      setQaLoading(false);
    }
  };

  // Filtered segments & paragraphs for search
  const filteredSegments = segments.filter((s) =>
    (s.text || "").toLowerCase().includes(searchFilter.toLowerCase().trim())
  );

  const filteredParagraphs = paragraphs.filter((p) =>
    (p.text || "").toLowerCase().includes(searchFilter.toLowerCase().trim())
  );

  const searchMatchCount = searchFilter.trim()
    ? viewMode === "paragraphs"
      ? filteredParagraphs.length
      : filteredSegments.length
    : null;

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" /> Loading lecture player & transcript...
      </div>
    );
  }

  if (errorMessage || !lecture) {
    return (
      <div className="p-8 text-center" style={{ padding: "40px 20px" }}>
        <h3 style={{ color: "#b91c1c", marginBottom: "8px" }}>Lecture Unavailable</h3>
        <p style={{ color: "var(--text-muted, #64748b)", marginBottom: "16px" }}>
          {errorMessage || "Lecture not found or has not been approved for student view."}
        </p>
        <Link to="/student/courses" className="btn-secondary">
          Return to My Courses
        </Link>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      {/* Top Banner */}
      <div className="viewer-top-bar">
        <div>
          <h2>{lecture.title}</h2>
          <p className="text-muted">
            Course: <strong>{lecture.course_title}</strong> · Language:{" "}
            <span className="badge" style={{ textTransform: "uppercase" }}>
              {lecture.language || "EN"}
            </span>
            {lecture.duration > 0 && ` · Duration: ${formatSeconds(lecture.duration)}`}
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <Link to={`/student/lectures/${id}/quiz`} className="btn-primary">
            <HelpCircle size={16} />
            <span>Take Lecture Quiz</span>
          </Link>
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="viewer-grid">
        {/* Left: Video Player */}
        <div className="viewer-media-panel">
          <div className="sticky-player">
            <VideoPlayer
              ref={playerRef}
              sourceType={lecture.source_type}
              mediaUrl={lecture.media_url}
              youtubeVideoId={lecture.youtube_video_id}
              onTimeUpdate={(t) => setCurrentTime(t)}
            />

            {lecture.topics && lecture.topics.length > 0 && (
              <div className="media-quick-topics">
                <div className="quick-topics-header">
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Layers size={14} style={{ color: "var(--primary, #6366f1)" }} />
                    <span className="quick-topics-title">Jump to Section</span>
                    <span className="badge-count-sm">{lecture.topics.length}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab("topics")}
                    className="view-all-topics-btn"
                  >
                    View All Topics →
                  </button>
                </div>
                <div className="topic-jump-chips">
                  {lecture.topics.slice(0, 10).map((top) => (
                    <button
                      key={top.topic_id}
                      onClick={() => handleSeek(top.start)}
                      className="topic-chip"
                      title={`${top.title} (${formatSeconds(top.start)})`}
                    >
                      <span className="chip-time">{formatSeconds(top.start)}</span>
                      <span className="chip-title">{top.title}</span>
                    </button>
                  ))}
                  {lecture.topics.length > 10 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab("topics")}
                      className="topic-chip more-chip"
                      title="Open full Topics tab"
                    >
                      +{lecture.topics.length - 10} more...
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Interactive Tabs */}
        <div className="viewer-tabs-panel">
          <div className="sub-tabs">
            <button
              className={`sub-tab ${activeTab === "transcript" ? "active" : ""}`}
              onClick={() => setActiveTab("transcript")}
            >
              <BookOpen size={16} />
              Transcript
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
              Key Summaries
            </button>
            <button
              className={`sub-tab ${activeTab === "qa" ? "active" : ""}`}
              onClick={() => setActiveTab("qa")}
            >
              <MessageSquare size={16} />
              Ask AI (Grounded)
            </button>
          </div>

          {/* TAB 1: ADVANCED TRANSCRIPT */}
          {activeTab === "transcript" && (
            <div className="transcript-panel">
              {/* Transcript Controls Bar */}
              <div className="transcript-toolbar">
                <div className="transcript-search-box">
                  <Search size={15} className="search-icon" />
                  <input
                    type="text"
                    placeholder="Search keywords in English, Hindi, Hinglish..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                  />
                  {searchFilter && (
                    <button
                      type="button"
                      className="search-clear-btn"
                      onClick={() => setSearchFilter("")}
                      title="Clear search"
                    >
                      ×
                    </button>
                  )}
                  {searchMatchCount !== null && (
                    <span className="search-match-badge">
                      {searchMatchCount} match{searchMatchCount === 1 ? "" : "es"}
                    </span>
                  )}
                </div>

                <div className="transcript-actions">
                  {/* View Mode Switcher */}
                  <div className="view-mode-toggle" title="Switch layout format">
                    <button
                      type="button"
                      className={`btn-mode ${viewMode === "paragraphs" ? "active" : ""}`}
                      onClick={() => setViewMode("paragraphs")}
                    >
                      <AlignLeft size={13} /> Paragraphs
                    </button>
                    <button
                      type="button"
                      className={`btn-mode ${viewMode === "segments" ? "active" : ""}`}
                      onClick={() => setViewMode("segments")}
                    >
                      <List size={13} /> Segments
                    </button>
                  </div>

                  {/* Auto-Scroll Toggle */}
                  <label className="auto-scroll-toggle" title="Auto-scroll transcript with video">
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
                    title="Copy full transcript to clipboard"
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
                      title="Export transcript to file"
                    >
                      <Download size={14} />
                      <span>Export</span>
                      <ChevronDown size={12} />
                    </button>

                    {showExportMenu && (
                      <div className="export-dropdown-menu">
                        <button type="button" onClick={() => handleExport("txt")}>
                          📄 Text (.txt) - Paragraphs
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

              {/* Scrollable Transcript Content */}
              <div
                className="transcript-scroll"
                ref={transcriptContainerRef}
                style={{ maxHeight: "560px", overflowY: "auto", position: "relative" }}
              >
                {/* PARAGRAPH VIEW (Intelligently combined sentences) */}
                {viewMode === "paragraphs" && (
                  <div className="paragraphs-stream">
                    {filteredParagraphs.length === 0 ? (
                      <p className="p-4 text-muted text-center">
                        {searchFilter ? `No paragraphs match "${searchFilter}".` : "No transcript text available."}
                      </p>
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
                                title={`Play from ${formatSeconds(para.start)}`}
                              >
                                <PlayCircle size={12} />
                                <span>
                                  {formatSeconds(para.start)} – {formatSeconds(para.end)}
                                </span>
                              </button>
                              {para.is_edited && (
                                <span className="instructor-corrected-pill" title="Verified by Instructor">
                                  Instructor Verified
                                </span>
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

                {/* SEGMENT VIEW (Short timestamps) */}
                {viewMode === "segments" && (
                  <div className="segments-stream">
                    {filteredSegments.length === 0 ? (
                      <p className="p-4 text-muted text-center">
                        {searchFilter ? `No segments match "${searchFilter}".` : "No transcript segments available."}
                      </p>
                    ) : (
                      filteredSegments.map((seg, sIdx) => {
                        const isCurrent = activeSegmentIndex === sIdx;
                        return (
                          <div
                            key={seg.segment_index ?? sIdx}
                            ref={isCurrent ? activeItemRef : null}
                            className={`transcript-row ${isCurrent ? "active" : ""}`}
                            onClick={() => handleSeek(seg.start)}
                          >
                            <button
                              type="button"
                              className="time-pill"
                              title={`Seek to ${formatSeconds(seg.start)}`}
                            >
                              <Clock size={12} />
                              {formatSeconds(seg.start)}
                            </button>
                            <p className="seg-text">
                              {searchFilter
                                ? highlightSearchText(seg.text, searchFilter)
                                : seg.text}
                            </p>
                            {seg.is_edited && (
                              <span
                                style={{
                                  fontSize: "0.68rem",
                                  color: "#7c3aed",
                                  fontWeight: 600,
                                  flexShrink: 0,
                                }}
                              >
                                Edited
                              </span>
                            )}
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
            <div className="topics-scroll">
              {lecture.topics?.map((top) => (
                <div key={top.topic_id} className="topic-student-card">
                  <div className="flex justify-between items-center" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h4>
                      Topic {top.topic_id}: {top.title}
                    </h4>
                    <button
                      onClick={() => handleSeek(top.start)}
                      className="btn-sm btn-secondary"
                    >
                      <PlayCircle size={14} />
                      Play ({formatSeconds(top.start)})
                    </button>
                  </div>
                  <div className="topic-text-preview mt-2">
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
            <div className="summaries-scroll">
              {lecture.summaries?.map((summ, idx) => (
                <div key={idx} className="summary-card">
                  <div className="summary-badge">Section {summ.topic_id} Synthesis</div>
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

          {/* TAB 4: GROUNDED QA */}
          {activeTab === "qa" && (
            <div className="qa-panel">
              <form onSubmit={handleAskQuestion} className="qa-form">
                <input
                  type="text"
                  placeholder="Ask a question about this lecture..."
                  value={qaQuery}
                  onChange={(e) => setQaQuery(e.target.value)}
                />
                <button type="submit" disabled={qaLoading} className="btn-primary">
                  {qaLoading ? "Searching..." : "Ask"}
                </button>
              </form>

              {qaResponse && (
                <div className="qa-response-box mt-4">
                  <div className="qa-answer">
                    <strong>Grounded Response:</strong>
                    <p>{qaResponse.answer}</p>
                  </div>

                  {qaResponse.citations?.length > 0 && (
                    <div className="qa-citations mt-3">
                      <strong>Citations from Lecture:</strong>
                      {qaResponse.citations.map((c, cIdx) => (
                        <div key={cIdx} className="qa-citation-item">
                          <button
                            type="button"
                            onClick={() => handleSeek(c.start)}
                            className="btn-time-jump"
                          >
                            <Clock size={12} />
                            {formatSeconds(c.start)} – {formatSeconds(c.end)}
                          </button>
                          <p>"{c.text}"</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
