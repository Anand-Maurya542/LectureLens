import React, { useState, useEffect, useRef } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { api } from "../../api/client";
import VideoPlayer from "../../components/VideoPlayer";
import { formatSeconds } from "../../components/CitationCard";
import {
  Clock,
  Search,
  BookOpen,
  Layers,
  Sparkles,
  HelpCircle,
  MessageSquare,
  PlayCircle,
  CheckCircle,
} from "lucide-react";

export default function LectureViewer() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [lecture, setLecture] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("transcript"); // transcript | topics | summaries | qa
  const [searchFilter, setSearchFilter] = useState("");
  const [qaQuery, setQaQuery] = useState("");
  const [qaResponse, setQaResponse] = useState(null);
  const [qaLoading, setQaLoading] = useState(false);

  const playerRef = useRef(null);

  useEffect(() => {
    async function loadLecture() {
      try {
        const data = await api.getLecture(id);
        setLecture(data);
      } catch (err) {
        console.error("Failed to load lecture:", err);
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

  const handleSeek = (seconds) => {
    if (playerRef.current) {
      playerRef.current.seekTo(seconds);
    }
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

  if (loading) {
    return <div className="page-loading"><div className="spinner" /> Loading lecture player...</div>;
  }

  if (!lecture) {
    return <div className="p-8">Lecture not found or not published.</div>;
  }

  const filteredSegments = (lecture.segments || []).filter((s) =>
    s.text.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="dashboard-page">
      {/* Top Banner */}
      <div className="viewer-top-bar">
        <div>
          <h2>{lecture.title}</h2>
          <p className="text-muted">
            Course: <strong>{lecture.course_title}</strong> · Language: {lecture.language?.toUpperCase() || "EN"}
          </p>
        </div>
        <Link
          to={`/student/lectures/${id}/quiz`}
          className="btn-primary"
        >
          <HelpCircle size={16} />
          <span>Take Section Quiz</span>
        </Link>
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
            />

            <div className="media-quick-topics">
              <span className="text-xs font-semibold text-muted">JUMP TO SECTION:</span>
              <div className="topic-jump-chips">
                {lecture.topics?.map((top) => (
                  <button
                    key={top.topic_id}
                    onClick={() => handleSeek(top.start)}
                    className="topic-chip"
                    title={top.title}
                  >
                    <span>{top.topic_id}. {top.title.slice(0, 25)}...</span>
                  </button>
                ))}
              </div>
            </div>
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

          {/* TAB 1: TRANSCRIPT */}
          {activeTab === "transcript" && (
            <div className="transcript-panel">
              <div className="search-filter-box">
                <Search size={15} />
                <input
                  type="text"
                  placeholder="Filter lecture transcript..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                />
              </div>

              <div className="transcript-scroll">
                {filteredSegments.length === 0 ? (
                  <p className="p-4 text-muted">No matching phrases found.</p>
                ) : (
                  filteredSegments.map((seg, idx) => (
                    <div
                      key={idx}
                      className="transcript-row"
                      onClick={() => handleSeek(seg.start)}
                    >
                      <button className="time-pill">
                        <Clock size={12} />
                        {formatSeconds(seg.start)}
                      </button>
                      <p className="seg-text">{seg.text}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 2: TOPICS */}
          {activeTab === "topics" && (
            <div className="topics-scroll">
              {lecture.topics?.map((top) => (
                <div key={top.topic_id} className="topic-student-card">
                  <div className="flex justify-between items-center">
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

