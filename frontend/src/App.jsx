import { useState } from "react";

const API_URL = "http://127.0.0.1:8000";

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export default function App() {
  const [file, setFile] = useState(null);
  const [segments, setSegments] = useState([]);
  const [topics, setTopics] = useState([]);
  const [language, setLanguage] = useState("");
  const [loading, setLoading] = useState(false);
  const [segmentLoading, setSegmentLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleTranscribe(event) {
    event.preventDefault();

    if (!file) {
      setError("Please select a lecture file.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setLoading(true);
    setError("");
    setSegments([]);
    setTopics([]);

    try {
      const response = await fetch(`${API_URL}/transcribe`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Transcription failed.");
      }

      setSegments(data.segments ?? []);
      setLanguage(data.language ?? "unknown");

      if (!data.segments?.length) {
        setError("No speech segments were detected.");
      }
    } catch (err) {
      setError(err.message || "Could not connect to the backend.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateTopics() {
    setSegmentLoading(true);
    setError("");
    setTopics([]);

    try {
      const response = await fetch(`${API_URL}/segment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ segments }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Topic generation failed.");
      }

      setTopics(data.topics ?? []);
    } catch (err) {
      setError(err.message || "Could not generate topics.");
    } finally {
      setSegmentLoading(false);
    }
  }

  return (
    <main
      style={{
        maxWidth: 900,
        margin: "40px auto",
        padding: 20,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1>LectureLens 🎓</h1>
      <p>Turn your lectures into searchable learning material.</p>

      <form onSubmit={handleTranscribe}>
        <input
          type="file"
          accept="audio/*,video/*,.mov,.m4a"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setSegments([]);
            setTopics([]);
            setError("");
          }}
          required
        />

        <button
          type="submit"
          disabled={!file || loading}
          style={{ marginLeft: 10 }}
        >
          {loading ? "Transcribing..." : "Transcribe Lecture"}
        </button>
      </form>

      {error && (
        <p role="alert" style={{ color: "crimson" }}>
          {error}
        </p>
      )}

      {segments.length > 0 && (
        <section>
          <h2>Transcript</h2>
          <p>Detected language: {language}</p>

          <button
            type="button"
            onClick={handleGenerateTopics}
            disabled={segmentLoading || loading}
          >
            {segmentLoading ? "Generating Topics..." : "Generate Topics"}
          </button>

          {segments.map((segment, index) => (
            <article
              key={`${segment.start}-${index}`}
              style={{
                border: "1px solid #888",
                borderRadius: 8,
                padding: 12,
                marginTop: 10,
              }}
            >
              <small>
                {formatTime(segment.start)} — {formatTime(segment.end)}
              </small>
              <p>{segment.text}</p>
            </article>
          ))}
        </section>
      )}

      {topics.length > 0 && (
        <section style={{ marginTop: 30 }}>
          <h2>Lecture Topics 🧠</h2>
          <p>Detected {topics.length} topic sections.</p>

          {topics.map((topic) => (
            <article
              key={topic.topic_id}
              style={{
                border: "1px solid #888",
                borderRadius: 10,
                padding: 16,
                marginTop: 12,
              }}
            >
              <h3>
                Topic {topic.topic_id}: {topic.title}
              </h3>

              <p>
                <strong>Time:</strong>{" "}
                {formatTime(topic.start)} — {formatTime(topic.end)}
              </p>

              {topic.segments?.map((segment, index) => (
                <p key={`${segment.start}-${index}`}>
                  {segment.text}
                </p>
              ))}
            </article>
          ))}
        </section>
      )}
    </main>
  );
}