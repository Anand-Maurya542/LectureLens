import { useState } from "react";

export default function App() {
  const [file, setFile] = useState(null);
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [language, setLanguage] = useState("");

  async function handleTranscribe(event) {
    event.preventDefault();

    if (!file) {
      setError("Please select an audio or video file.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setLoading(true);
    setError("");
    setSegments([]);

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/transcribe",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Transcription failed.");
      }

      setSegments(data.segments ?? []);
      setLanguage(data.language ?? "unknown");
    } catch (err) {
      setError(err.message || "Could not connect to the backend.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{
      maxWidth: 900,
      margin: "40px auto",
      padding: 20,
      fontFamily: "Arial, sans-serif",
    }}>
      <h1>LectureLens 🎓</h1>
      <p>Turn your lectures into searchable learning material.</p>

      <form onSubmit={handleTranscribe}>
        <input
          type="file"
          accept="audio/*,video/*,.mov,.m4a"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setSegments([]);
            setError("");
          }}
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
        <p role="alert" style={{ color: "red" }}>{error}</p>
      )}

      {segments.length > 0 && (
        <section>
          <h2>Transcript</h2>
          <p>Detected language: {language}</p>

          {segments.map((segment, index) => (
            <article
              key={`${segment.start}-${index}`}
              style={{
                padding: 12,
                marginBottom: 10,
                border: "1px solid #ddd",
                borderRadius: 8,
              }}
            >
              <small>
                {Math.floor(segment.start / 60)}:
                {String(Math.floor(segment.start % 60))
                  .padStart(2, "0")}
                {" — "}
                {Math.floor(segment.end / 60)}:
                {String(Math.floor(segment.end % 60))
                  .padStart(2, "0")}
              </small>
              <p>{segment.text}</p>
            </article>
          ))}
        </section>
      )}

      {!loading && segments.length === 0 && !error && (
        <p>Your transcript will appear here after processing.</p>
      )}
    </main>
  );
}