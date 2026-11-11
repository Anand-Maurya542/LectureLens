import React from "react";

export function StatusBadge({ status, isPublished }) {
  const configs = {
    queued: { label: "Waiting to Start", color: "#3b82f6", bg: "#eff6ff" },
    processing: { label: "Preparing Lecture...", color: "#d97706", bg: "#fffbeb" },
    review_required: { label: "Ready for Review", color: "#8b5cf6", bg: "#f5f3ff" },
    published: { label: "Published", color: "#10b981", bg: "#ecfdf5" },
    failed: { label: "Needs Attention", color: "#ef4444", bg: "#fef2f2" },
  };

  const current = configs[status] || { label: status, color: "#6b7280", bg: "#f3f4f6" };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 9999,
        fontSize: "0.8rem",
        fontWeight: 600,
        color: current.color,
        backgroundColor: current.bg,
        border: `1px solid ${current.color}40`,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          backgroundColor: current.color,
          animation: status === "processing" ? "pulse 1.5s infinite" : "none",
        }}
      />
      {current.label}
      {isPublished && status !== "published" && (
        <span style={{ fontSize: "0.75rem", opacity: 0.85 }}>(Live)</span>
      )}
    </span>
  );
}

export function UncertaintyPill({ avgLogprob }) {
  if (avgLogprob === undefined || avgLogprob === null) return null;

  let label = "Clear";
  let color = "#10b981";
  let bg = "#ecfdf5";

  if (avgLogprob < -0.5) {
    label = "Needs Review";
    color = "#ef4444";
    bg = "#fef2f2";
  } else if (avgLogprob < -0.2) {
    label = "Listen & Check";
    color = "#f59e0b";
    bg = "#fffbeb";
  }

  return (
    <span
      title={`Audio clarity: ${label}`}
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: "0.72rem",
        fontWeight: 600,
        color: color,
        backgroundColor: bg,
        marginLeft: 8,
      }}
    >
      {label}
    </span>
  );
}

