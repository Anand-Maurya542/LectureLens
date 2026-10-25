import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import {
  UploadCloud,
  Video,
  FileAudio,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";

export default function AddLecture() {
  const [sourceType, setSourceType] = useState("youtube"); // "upload" | "youtube"
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [file, setFile] = useState(null);
  const [consent, setConsent] = useState(false);
  const [languageHint, setLanguageHint] = useState("auto");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    async function fetchCourses() {
      try {
        const data = await api.getCourses();
        setCourses(data || []);
        if (data?.length > 0) {
          setCourseId(data[0].id);
        }
      } catch (err) {
        console.error("Failed to fetch courses:", err);
      }
    }
    fetchCourses();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!consent) {
      setError("Please confirm student and speaker consent before processing.");
      return;
    }

    if (!courseId) {
      setError("Please select a target course.");
      return;
    }

    setSubmitting(true);

    try {
      let createdLecture;
      if (sourceType === "youtube") {
        if (!youtubeUrl.trim()) {
          throw new Error("Please enter a valid YouTube lecture URL.");
        }
        createdLecture = await api.createYouTubeLecture({
          title,
          course_id: courseId,
          youtube_url: youtubeUrl.trim(),
          description,
          consent_granted: consent,
        });
      } else {
        if (!file) {
          throw new Error("Please select an audio or video file.");
        }
        const formData = new FormData();
        formData.append("title", title);
        formData.append("course_id", courseId);
        formData.append("description", description);
        formData.append("language_hint", languageHint);
        formData.append("file", file);
        createdLecture = await api.uploadLecture(formData);
      }

      // Redirect immediately to the review page where real-time pipeline status is displayed
      navigate(`/teacher/lectures/${createdLecture.id}/review`);
    } catch (err) {
      setError(err.message || "Failed to initiate lecture ingestion.");
      setSubmitting(false);
    }
  };

  return (
    <div className="dashboard-page max-w-4xl">
      <div className="dashboard-header">
        <div>
          <h1>Add New Lecture</h1>
          <p>Ingest lecture recordings via YouTube video or direct audio/video upload.</p>
        </div>
      </div>

      <div className="card-box">
        {/* Source Type Selector */}
        <div className="source-tabs">
          <button
            type="button"
            className={`source-tab ${sourceType === "youtube" ? "active" : ""}`}
            onClick={() => setSourceType("youtube")}
          >
            <Video size={20} />
            <span>YouTube Lecture URL</span>
          </button>
          <button
            type="button"
            className={`source-tab ${sourceType === "upload" ? "active" : ""}`}
            onClick={() => setSourceType("upload")}
          >
            <UploadCloud size={20} />
            <span>Upload Audio / Video</span>
          </button>
        </div>

        {error && (
          <div className="alert-error mt-4">
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6">
          <div className="form-grid">
            <div className="form-group">
              <label>Target Course *</label>
              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                required
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} ({c.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Lecture Title *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Lecture 4: Attention Mechanisms and Transformers"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Description & Notes</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Key lecture overview, covered chapters, or prerequisite reading..."
            />
          </div>

          {sourceType === "youtube" ? (
            <div className="form-group highlight-box">
              <label>
                <Video size={16} /> YouTube Video Link *
              </label>
              <input
                type="url"
                required
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
              />
              <small className="help-text">
                The pipeline will automatically ingest authorized caption transcripts and generate semantic topics.
              </small>
            </div>
          ) : (
            <div className="upload-dropzone">
              <input
                id="file-upload"
                type="file"
                accept="audio/*,video/*,.mp3,.wav,.m4a,.mp4,.mov,.webm"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                style={{ display: "none" }}
              />
              <label htmlFor="file-upload" className="dropzone-label">
                <FileAudio size={42} className="dropzone-icon" />
                {file ? (
                  <div>
                    <strong>{file.name}</strong>
                    <p>{(file.size / (1024 * 1024)).toFixed(1)} MB</p>
                  </div>
                ) : (
                  <div>
                    <strong>Click to select audio or video file</strong>
                    <p>Supported: MP4, MP3, WAV, M4A, MOV, WebM (up to 500MB)</p>
                  </div>
                )}
              </label>

              <div className="form-group mt-4">
                <label>Audio Language Hint</label>
                <select
                  value={languageHint}
                  onChange={(e) => setLanguageHint(e.target.value)}
                >
                  <option value="auto">Auto-detect Language</option>
                  <option value="en">English</option>
                  <option value="hi">Hindi (हिंदी)</option>
                </select>
              </div>
            </div>
          )}

          {/* Consent Checkbox */}
          <div className="consent-box mt-6">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                required
              />
              <span>
                <ShieldCheck size={16} className="inline-icon" />
                <strong>Institutional & Recording Consent:</strong> I confirm that this lecture recording
                complies with institutional privacy guidelines, speaker permission has been recorded, and
                materials are intended strictly for educational use within enrolled courses.
              </span>
            </label>
          </div>

          <div className="form-actions mt-6">
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full justify-center"
            >
              <span>{submitting ? "Initiating AI Pipeline..." : "Process Lecture & Generate Transcripts"}</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
