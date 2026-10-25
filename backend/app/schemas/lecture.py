from typing import Optional, Any
from pydantic import BaseModel, ConfigDict, Field


class SegmentItem(BaseModel):
    id: Optional[str] = None
    start: float
    end: float
    text: str
    avg_logprob: Optional[float] = None
    no_speech_prob: Optional[float] = None
    compression_ratio: Optional[float] = None
    is_edited: bool = False
    original_text: Optional[str] = None


class TopicItem(BaseModel):
    id: Optional[str] = None
    topic_id: int
    title: str
    start: float
    end: float
    segments: list[SegmentItem] = []
    is_edited: bool = False


class SummaryItem(BaseModel):
    id: Optional[str] = None
    topic_id: Optional[int] = None
    summary_type: str = "extractive"
    summary_text: str
    key_points: list[str] = []
    is_approved: bool = True


class LectureCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    description: Optional[str] = ""
    course_id: str
    source_type: str = "upload"  # "upload" or "youtube"
    youtube_url: Optional[str] = None
    consent_granted: bool = True


class LectureOut(BaseModel):
    id: str
    title: str
    description: str = ""
    course_id: str
    course_title: Optional[str] = None
    teacher_id: str
    teacher_name: Optional[str] = None
    source_type: str = "upload"
    youtube_url: Optional[str] = None
    youtube_video_id: Optional[str] = None
    media_url: Optional[str] = None
    status: str = "queued"  # queued, processing, review_required, published, failed
    failure_reason: Optional[str] = None
    language: Optional[str] = None
    language_probability: Optional[float] = None
    duration: Optional[float] = 0.0
    is_published: bool = False
    segments: list[SegmentItem] = []
    topics: list[TopicItem] = []
    summaries: list[SummaryItem] = []
    created_at: str
    updated_at: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class TranscriptCorrectionRequest(BaseModel):
    segment_index: int
    new_text: str = Field(..., min_length=1)


class TopicCorrectionRequest(BaseModel):
    topic_index: int
    new_title: str = Field(..., min_length=2)
    start: Optional[float] = None
    end: Optional[float] = None


class PublicationUpdateRequest(BaseModel):
    is_published: bool
