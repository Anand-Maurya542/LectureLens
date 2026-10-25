from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class CourseCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=150)
    description: Optional[str] = ""
    code: Optional[str] = None  # If not provided, will be auto-generated


class CourseUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None


class CourseEnroll(BaseModel):
    code: str = Field(..., min_length=4, max_length=20)


class CourseOut(BaseModel):
    id: str
    title: str
    description: str = ""
    code: str
    teacher_id: str
    teacher_name: Optional[str] = None
    student_count: int = 0
    lecture_count: int = 0
    created_at: str

    model_config = ConfigDict(from_attributes=True)
