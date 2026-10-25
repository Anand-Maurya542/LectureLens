import React, { useRef, useEffect, forwardRef, useImperativeHandle } from "react";

const VideoPlayer = forwardRef(function VideoPlayer(
  { sourceType, mediaUrl, youtubeVideoId, onTimeUpdate },
  ref
) {
  const mediaRef = useRef(null);
  const iframeRef = useRef(null);

  useImperativeHandle(ref, () => ({
    seekTo: (seconds) => {
      if (sourceType === "youtube") {
        if (iframeRef.current && iframeRef.current.contentWindow) {
          iframeRef.current.contentWindow.postMessage(
            JSON.stringify({
              event: "command",
              func: "seekTo",
              args: [seconds, true],
            }),
            "*"
          );
        }
      } else if (mediaRef.current) {
        mediaRef.current.currentTime = seconds;
        mediaRef.current.play().catch(() => {});
      }
    },
  }));

  if (sourceType === "youtube" && youtubeVideoId) {
    const embedSrc = `https://www.youtube-nocookie.com/embed/${youtubeVideoId}?enablejsapi=1&rel=0&autoplay=0`;
    return (
      <div className="player-wrapper">
        <iframe
          ref={iframeRef}
          src={embedSrc}
          title="YouTube Lecture Player"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="video-element"
        />
      </div>
    );
  }

  // Uploaded media
  const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
  const fullMediaUrl = mediaUrl
    ? mediaUrl.startsWith("http")
      ? mediaUrl
      : `${API_BASE}${mediaUrl}`
    : null;

  if (!fullMediaUrl) {
    return (
      <div className="player-placeholder">
        <p>No media stream available for this lecture.</p>
      </div>
    );
  }

  const isAudio =
    fullMediaUrl.endsWith(".mp3") ||
    fullMediaUrl.endsWith(".wav") ||
    fullMediaUrl.endsWith(".ogg");

  return (
    <div className="player-wrapper">
      {isAudio ? (
        <div className="audio-player-box">
          <div className="audio-icon">🎙️</div>
          <audio
            ref={mediaRef}
            src={fullMediaUrl}
            controls
            className="audio-element"
            onTimeUpdate={(e) => onTimeUpdate && onTimeUpdate(e.target.currentTime)}
          />
        </div>
      ) : (
        <video
          ref={mediaRef}
          src={fullMediaUrl}
          controls
          className="video-element"
          onTimeUpdate={(e) => onTimeUpdate && onTimeUpdate(e.target.currentTime)}
        />
      )}
    </div>
  );
});

export default VideoPlayer;

