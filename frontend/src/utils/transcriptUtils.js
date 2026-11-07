import React from "react";

/**
 * Combines short consecutive speech segments into natural readable paragraphs.
 * Intelligently breaks at sentence boundaries (English and Hindi/Devanagari punctuation: . ? ! । ॥)
 * or when speaker pauses exceed natural speaking thresholds.
 */
export function groupSegmentsIntoParagraphs(segments = []) {
  if (!segments || segments.length === 0) return [];

  const paragraphs = [];
  let currentGroup = [];
  const sentenceEndPattern = /[.?!।॥]$/;

  const flush = () => {
    if (currentGroup.length === 0) return;

    const start = currentGroup[0].start;
    const end = currentGroup[currentGroup.length - 1].end;
    const text = currentGroup.map((s) => s.text?.trim()).filter(Boolean).join(" ");
    const originalText = currentGroup
      .map((s) => (s.original_text || s.text || "").trim())
      .filter(Boolean)
      .join(" ");
    const isEdited = currentGroup.some((s) => s.is_edited);
    const segmentIndices = currentGroup.map((s) => s.segment_index ?? 0);

    paragraphs.push({
      paragraph_index: paragraphs.length,
      start: Number(start.toFixed(2)),
      end: Number(end.toFixed(2)),
      text,
      original_text: originalText,
      is_edited: isEdited,
      segment_indices: segmentIndices,
      segments: [...currentGroup],
    });

    currentGroup = [];
  };

  segments.forEach((seg, idx) => {
    currentGroup.push(seg);

    const segText = (seg.text || "").trim();
    const endsSentence = sentenceEndPattern.test(segText);
    const duration = seg.end - currentGroup[0].start;
    const charCount = currentGroup.reduce((acc, s) => acc + (s.text?.length || 0), 0);
    const wordCount = currentGroup.reduce((acc, s) => acc + (s.text?.split(/\s+/).length || 0), 0);

    // Check pause before next segment
    let nextGap = 0;
    if (idx + 1 < segments.length) {
      nextGap = segments[idx + 1].start - seg.end;
    }

    const hasSpeakerPause = nextGap >= 1.6;

    if (
      (endsSentence && (duration >= 20 || charCount >= 280 || hasSpeakerPause)) ||
      duration >= 50 ||
      wordCount >= 75 ||
      (hasSpeakerPause && duration >= 12)
    ) {
      flush();
    }
  });

  flush();
  return paragraphs;
}

/**
 * Formats seconds into mm:ss or hh:mm:ss string
 */
export function formatSeconds(sec = 0) {
  if (isNaN(sec) || sec < 0) return "00:00";
  const total = Math.floor(sec);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Formats time for SubRip (.srt) 00:00:00,000
 */
function formatSrtTime(sec = 0) {
  const millis = Math.floor((sec - Math.floor(sec)) * 1000);
  const total = Math.floor(sec);
  const hours = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
}

/**
 * Formats time for WebVTT (.vtt) 00:00:00.000
 */
function formatVttTime(sec = 0) {
  const millis = Math.floor((sec - Math.floor(sec)) * 1000);
  const total = Math.floor(sec);
  const hours = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

/**
 * Generates and downloads transcript in specified format
 */
export function exportTranscriptFile(segments = [], paragraphs = [], title = "Lecture_Transcript", format = "txt") {
  const safeName = title.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50) || "Transcript";
  let content = "";
  let mimeType = "text/plain;charset=utf-8";
  let extension = "txt";

  if (format === "srt") {
    extension = "srt";
    mimeType = "application/x-subrip";
    content = segments
      .map((s, i) => `${i + 1}\n${formatSrtTime(s.start)} --> ${formatSrtTime(s.end)}\n${s.text?.trim() || ""}\n`)
      .join("\n");
  } else if (format === "vtt") {
    extension = "vtt";
    mimeType = "text/vtt";
    content =
      "WEBVTT - LectureLens Transcript\n\n" +
      segments
        .map((s, i) => `${i + 1}\n${formatVttTime(s.start)} --> ${formatVttTime(s.end)}\n${s.text?.trim() || ""}\n`)
        .join("\n");
  } else if (format === "json") {
    extension = "json";
    mimeType = "application/json";
    content = JSON.stringify(
      {
        title,
        exported_at: new Date().toISOString(),
        total_segments: segments.length,
        total_paragraphs: paragraphs.length,
        paragraphs,
        segments,
      },
      null,
      2
    );
  } else {
    // Standard TXT format with readable paragraphs and timestamps
    extension = "txt";
    mimeType = "text/plain;charset=utf-8";
    const header = `LECTURE TRANSCRIPT: ${title}\nExported from LectureLens on ${new Date().toLocaleDateString()}\n${"=".repeat(60)}\n\n`;
    const body = (paragraphs.length > 0 ? paragraphs : segments)
      .map((item) => `[${formatSeconds(item.start)} - ${formatSeconds(item.end)}]\n${item.text?.trim()}\n`)
      .join("\n");
    content = header + body;
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeName}.${extension}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Copies transcript text formatted with timestamps to clipboard
 */
export async function copyTranscriptToClipboard(items = [], title = "") {
  const header = title ? `LECTURE: ${title}\n\n` : "";
  const body = items
    .map((item) => `[${formatSeconds(item.start)}] ${item.text?.trim()}`)
    .join("\n\n");
  const fullText = header + body;

  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(fullText);
    return true;
  }
  return false;
}

/**
 * Highlights occurrences of query within text, supporting Hindi and English Unicode strings
 */
export function highlightSearchText(text = "", query = "") {
  if (!query || !query.trim() || !text) return text;

  const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);

  if (parts.length === 1) return text;

  return parts.map((part, index) =>
    regex.test(part)
      ? React.createElement(
          "mark",
          {
            key: index,
            className: "transcript-highlight",
            style: {
              background: "#fef08a",
              color: "#854d0e",
              padding: "0 3px",
              borderRadius: "3px",
              fontWeight: 600,
            },
          },
          part
        )
      : part
  );
}
