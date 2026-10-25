from typing import Optional
from pydantic import BaseModel


class RevisionRecommendation(BaseModel):
    topic_id: int
    topic_title: str
    lecture_id: str
    lecture_title: str
    course_id: str
    weakness_score: float  # 0.0 to 1.0 (higher = weaker)
    reason: str
    suggested_start_time: float
    summary_snippet: str
    timestamp_url: Optional[str] = None

