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
      setError("Please confirm that you have permission to share this lecture recording.");
      return;
    }

    if (!courseId) {
      setError("Please select a course for this lecture.");
      return;
    }

    setSubmitting(true);

    try {
      let createdLecture;
      if (sourceType === "youtube") {
        if (!youtubeUrl.trim()) {
          throw new Error("Please enter a valid YouTube link.");
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
          throw new Error("Please select an audio or video recording file.");
        }
        const formData = new FormData();
        formData.append("title", title);
        formData.append("course_id", courseId);
        formData.append("description", description);
        formData.append("language_hint", languageHint);
        formData.append("file", file);
        createdLecture = await api.uploadLecture(formData);
      }

      // Redirect immediately to the review page where preparation status is displayed
      navigate(`/teacher/lectures/${createdLecture.id}/review`);
    } catch (err) {
      setError(err.message || "We couldn't prepare the lecture. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <div className="dashboard-page max-w-4xl">
      <div className="dashboard-header">
        <div>
          <h1>Add a New Lecture</h1>
          <p>Add a YouTube video or upload a recording to create learning material.</p>
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
            <span>Add from YouTube</span>
          </button>
          <button
            type="button"
            className={`source-tab ${sourceType === "upload" ? "active" : ""}`}
            onClick={() => setSourceType("upload")}
          >
            <UploadCloud size={20} />
            <span>Upload Audio or Video</span>
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
              <label>Select Course *</label>
              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                required
              >
                {courses.length === 0 && <option value="">No active courses found</option>}
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
                placeholder="e.g. Introduction to Database Normalization"
              />
            </div>
          </div>

          <div className="form-group">
            <label>About This Lecture</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Briefly describe what this lecture covers..."
            />
          </div>

          {sourceType === "youtube" ? (
            <div className="form-group highlight-box">
              <label>
                <Video size={16} /> Paste YouTube Link *
              </label>
              <input
                type="url"
                required
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
              />
              <small className="help-text">
                We will prepare the transcript and organise your lecture into topics. This may take a few minutes.
              </small>
              <div style={{ fontSize: "0.82rem", color: "#64748b", marginTop: "6px" }}>
                💡 Tip: Make sure the YouTube video has English or Hindi subtitles enabled. If not, you can upload subtitles or a recording directly after adding.
              </div>
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
                    <strong>Click to select audio or video recording</strong>
                    <p>Supported formats: MP4, MP3, WAV, M4A, MOV, WebM (up to 500MB)</p>
                  </div>
                )}
              </label>

              <div className="form-group mt-4">
                <label>Spoken Language</label>
                <select
                  value={languageHint}
                  onChange={(e) => setLanguageHint(e.target.value)}
                >
                  <option value="auto">Automatic detection</option>
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
                <strong>Recording Permission:</strong> I confirm that I have permission to share this lecture
                recording for educational use within this course.
              </span>
            </label>
          </div>

          <div className="form-actions mt-6">
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full justify-center"
            >
              <span>{submitting ? "Preparing Lecture..." : "Prepare Lecture"}</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
