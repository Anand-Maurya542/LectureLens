from typing import Optional
from pydantic import BaseModel, Field


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=2)
    course_id: Optional[str] = None
    lecture_id: Optional[str] = None
    search_mode: str = "vector"  # "vector", "keyword", "hybrid"
    top_k: int = 5


class SearchResultItem(BaseModel):
    chunk_id: str
    lecture_id: str
    lecture_title: str
    course_id: str
    course_title: Optional[str] = None
    topic_id: Optional[int] = None
    topic_title: Optional[str] = None
    start: float
    end: float
    text: str
    score: float
    search_mode: str
    timestamp_url: Optional[str] = None
    source_type: str = "upload"


class Citation(BaseModel):
    lecture_id: str
    lecture_title: str
    topic_title: Optional[str] = None
    start: float
    end: float
    text: str
    timestamp_url: Optional[str] = None


class QARequest(BaseModel):
    query: str = Field(..., min_length=2)
    lecture_id: Optional[str] = None
    course_id: Optional[str] = None


class QAResponse(BaseModel):
    query: str
    answer: str
    citations: list[Citation] = []
    is_grounded: bool = True
    confidence: float = 1.0

