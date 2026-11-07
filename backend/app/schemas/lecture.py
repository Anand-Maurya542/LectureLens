import datetime
from typing import Optional, Any, Union
from pydantic import BaseModel, ConfigDict, Field, model_validator


class SegmentItem(BaseModel):
    id: Optional[str] = None
    segment_index: Optional[int] = None
    start: float
    end: float
    text: str
    avg_logprob: Optional[float] = None
    no_speech_prob: Optional[float] = None
    compression_ratio: Optional[float] = None
    is_edited: bool = False
    original_text: Optional[str] = None
    corrected_by: Optional[str] = None
    corrected_at: Optional[Union[datetime.datetime, str]] = None


class ParagraphItem(BaseModel):
    paragraph_index: int
    start: float
    end: float
    text: str
    original_text: Optional[str] = None
    is_edited: bool = False
    segment_indices: list[int] = []


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
    transcript_status: str = "ai_generated"  # ai_generated, in_review, approved, rejected
    transcript_approved_by: Optional[str] = None
    transcript_approved_at: Optional[Union[datetime.datetime, str]] = None
    transcript_rejection_reason: Optional[str] = None
    segments: list[SegmentItem] = []
    paragraphs: list[ParagraphItem] = []
    topics: list[TopicItem] = []
    summaries: list[SummaryItem] = []
    created_at: Optional[Union[datetime.datetime, str]] = ""
    updated_at: Optional[Union[datetime.datetime, str]] = None

    model_config = ConfigDict(from_attributes=True, arbitrary_types_allowed=True)


class TranscriptCorrectionRequest(BaseModel):
    segment_index: int
    new_text: Optional[str] = None
    text: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def populate_text(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if not data.get("new_text") and data.get("text"):
                data["new_text"] = data["text"]
            elif not data.get("text") and data.get("new_text"):
                data["text"] = data["new_text"]
        return data


class TranscriptBatchCorrectionRequest(BaseModel):
    corrections: list[TranscriptCorrectionRequest] = []
    updates: list[TranscriptCorrectionRequest] = []

    @model_validator(mode="before")
    @classmethod
    def populate_corrections(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if not data.get("corrections") and data.get("updates"):
                data["corrections"] = data["updates"]
            elif not data.get("updates") and data.get("corrections"):
                data["updates"] = data["corrections"]
        return data


class TranscriptApprovalRequest(BaseModel):
    publish_to_students: bool = True
    publish_immediately: Optional[bool] = None
    notes: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def populate_publish(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "publish_immediately" in data and "publish_to_students" not in data:
                data["publish_to_students"] = bool(data["publish_immediately"])
        return data


class TranscriptRejectionRequest(BaseModel):
    rejection_reason: str = Field("Transcript requires revision", min_length=2)


class TopicCorrectionRequest(BaseModel):
    topic_index: int
    new_title: str = Field(..., min_length=2)
    start: Optional[float] = None
    end: Optional[float] = None


class PublicationUpdateRequest(BaseModel):
    is_published: bool
