import React from "react";
import { PlayCircle, Clock } from "lucide-react";

export function formatSeconds(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export default function CitationCard({ citation, onJump }) {
  return (
    <div className="citation-card">
      <div className="citation-header">
        <span className="citation-lecture">{citation.lecture_title}</span>
        {citation.topic_title && (
          <span className="citation-topic">Section: {citation.topic_title}</span>
        )}
        <button
          type="button"
          onClick={() => onJump && onJump(citation.start)}
          className="citation-time-btn"
          title="Jump video to this timestamp"
        >
          <Clock size={13} />
          <span>
            {formatSeconds(citation.start)} – {formatSeconds(citation.end)}
          </span>
          <PlayCircle size={14} className="play-icon" />
        </button>
      </div>
      <p className="citation-quote">"{citation.text}"</p>
    </div>
  );
}

