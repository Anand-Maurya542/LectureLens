import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { formatSeconds } from "../../components/CitationCard";
import {
  Search,
  Sparkles,
  PlayCircle,
  Clock,
  Filter,
  Layers,
  ShieldAlert,
  Brain,
} from "lucide-react";

export default function GlobalSearch() {
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [query, setQuery] = useState("");
  const [searchMode, setSearchMode] = useState("vector"); // vector | keyword | hybrid
  const [activeView, setActiveView] = useState("search"); // search | qa
  const [results, setResults] = useState([]);
  const [qaResult, setQaResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    async function loadCourses() {
      try {
        const c = await api.getCourses();
        setCourses(c || []);
      } catch (err) {
        console.error("Failed to load courses:", err);
      }
    }
    loadCourses();
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setSearched(true);
    setResults([]);
    setQaResult(null);

    try {
      if (activeView === "search") {
        const data = await api.search(query.trim(), {
          course_id: selectedCourse || undefined,
          search_mode: searchMode,
          top_k: 6,
        });
        setResults(data || []);
      } else {
        const qaData = await api.askQuestion(query.trim(), {
          course_id: selectedCourse || undefined,
        });
        setQaResult(qaData);
      }
    } catch (err) {
      alert(err.message || "Search failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-page max-w-5xl">
      <div className="dashboard-header">
        <div>
          <h1>Atlas Vector Search & Grounded Q&A</h1>
          <p>
            Perform semantic neural retrieval across all your enrolled lectures using MongoDB Atlas
            Vector Search, keyword lexical matching, or ask questions grounded strictly in transcripts.
          </p>
        </div>
      </div>

      {/* Main Search Box */}
      <div className="card-box mb-6">
        {/* Toggle between Vector Search & Grounded QA */}
        <div className="search-mode-tabs mb-4">
          <button
            type="button"
            className={`search-mode-tab ${activeView === "search" ? "active" : ""}`}
            onClick={() => setActiveView("search")}
          >
            <Search size={16} />
            <span>Semantic Passage Retrieval</span>
          </button>
          <button
            type="button"
            className={`search-mode-tab ${activeView === "qa" ? "active" : ""}`}
            onClick={() => setActiveView("qa")}
          >
            <Brain size={16} />
            <span>Evidence-Grounded Q&A (RAG)</span>
          </button>
        </div>

        <form onSubmit={handleSearch}>
          <div className="search-bar-row">
            <div className="search-input-wrap">
              <Search size={20} className="search-icon" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  activeView === "search"
                    ? "Enter concept, formula, or phrase to retrieve passages..."
                    : "Ask any academic question across your lectures..."
                }
                required
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Retrieving..." : activeView === "search" ? "Search" : "Ask AI"}
            </button>
          </div>

          {/* Filters Bar */}
          <div className="search-filters-row mt-4">
            <div className="filter-item">
              <label>Course Scope:</label>
              <select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
              >
                <option value="">All Enrolled Courses</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>

            {activeView === "search" && (
              <div className="filter-item">
                <label>Retrieval Mode:</label>
                <select
                  value={searchMode}
                  onChange={(e) => setSearchMode(e.target.value)}
                >
                  <option value="vector">Atlas Vector Search (Semantic Cosine)</option>
                  <option value="hybrid">Hybrid Search (Vector + Keyword RRF)</option>
                  <option value="keyword">Keyword Lexical Search (Exact match)</option>
                </select>
              </div>
            )}
          </div>
        </form>
      </div>

      {/* Results View */}
      {loading && (
        <div className="page-loading">
          <div className="spinner" />
          <span>Executing {searchMode} search across 384-d embeddings...</span>
        </div>
      )}

      {/* Q&A RESULT BOX */}
      {activeView === "qa" && qaResult && !loading && (
        <div className="qa-grounded-result-card">
          <div className="qa-badge-row">
            <span className={`grounded-badge ${qaResult.is_grounded ? "grounded" : "abstain"}`}>
              {qaResult.is_grounded ? "Grounded in Lecture Evidence" : "Abstained / Insufficient Context"}
            </span>
            {qaResult.confidence > 0 && (
              <span className="confidence-pill">
                Relevance: {(qaResult.confidence * 100).toFixed(1)}%
              </span>
            )}
          </div>

          <h3 className="qa-answer-text mt-3">{qaResult.answer}</h3>

          {qaResult.citations?.length > 0 && (
            <div className="qa-citations-section mt-5">
              <h4>Supporting Lecture Citations:</h4>
              <div className="citations-grid mt-2">
                {qaResult.citations.map((c, i) => (
                  <div key={i} className="citation-box">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-semibold">{c.lecture_title}</span>
                      <Link to={c.timestamp_url} className="citation-time-btn">
                        <Clock size={12} />
                        <span>{formatSeconds(c.start)} – {formatSeconds(c.end)}</span>
                        <PlayCircle size={14} />
                      </Link>
                    </div>
                    <p className="citation-quote">"{c.text}"</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SEARCH RESULTS LIST */}
      {activeView === "search" && searched && !loading && (
        <div className="search-results-section">
          <div className="section-header">
            <h3>Search Results ({results.length})</h3>
            <span className="text-muted">Ranked by relevance score</span>
          </div>

          {results.length === 0 ? (
            <div className="empty-state">
              <Search size={40} />
              <p>No matching lecture passages found. Try adjusting your query or filters.</p>
            </div>
          ) : (
            <div className="results-list">
              {results.map((item) => (
                <div key={item.chunk_id} className="search-result-card">
                  <div className="result-meta-row">
                    <div className="lecture-info">
                      <span className="lecture-title">{item.lecture_title}</span>
                      {item.topic_title && (
                        <span className="topic-pill">Section: {item.topic_title}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="score-pill">
                        Score: {item.score?.toFixed(3)}
                      </span>
                      <Link
                        to={item.timestamp_url}
                        className="btn-jump-player"
                        title="Jump video to this timestamp"
                      >
                        <Clock size={13} />
                        <span>{formatSeconds(item.start)}</span>
                        <PlayCircle size={15} />
                      </Link>
                    </div>
                  </div>

                  <p className="result-passage">{item.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

