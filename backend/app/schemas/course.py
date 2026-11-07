import datetime
from typing import Optional, List, Union
from pydantic import BaseModel, ConfigDict, Field


class CourseCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=150)
    description: Optional[str] = ""
    code: Optional[str] = None  # If not provided, will be auto-generated
    thumbnail_url: Optional[str] = None
    status: str = "active"  # "active" or "inactive"
    teacher_id: Optional[str] = None  # If created by admin, can optionally assign instructor
    glossary: Optional[List[str]] = []


class CourseUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    code: Optional[str] = None
    thumbnail_url: Optional[str] = None
    status: Optional[str] = None  # "active" or "inactive"
    glossary: Optional[List[str]] = None


class CourseEnroll(BaseModel):
    code: str = Field(..., min_length=2, max_length=50)


class CourseEnrollmentRequest(BaseModel):
    course_id: str


class CourseEnrollmentReject(BaseModel):
    rejection_reason: Optional[str] = "Application requirements not met."


class CourseEnrollmentOut(BaseModel):
    id: str
    course_id: Optional[str] = ""
    course_title: Optional[str] = ""
    course_code: Optional[str] = ""
    user_id: Optional[str] = ""
    user_name: Optional[str] = ""
    user_email: Optional[str] = ""
    user_role: Optional[str] = "student"  # "student" | "teacher"
    status: Optional[str] = "pending"     # "pending" | "approved" | "rejected"
    rejection_reason: Optional[str] = None
    created_at: Optional[Union[datetime.datetime, str]] = ""
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[Union[datetime.datetime, str]] = None

    model_config = ConfigDict(from_attributes=True, arbitrary_types_allowed=True)


class CourseMemberUser(BaseModel):
    id: str
    name: Optional[str] = "User"
    email: Optional[str] = ""
    role: Optional[str] = "student"
    joined_at: Optional[Union[datetime.datetime, str]] = None

    model_config = ConfigDict(from_attributes=True, arbitrary_types_allowed=True)


class CourseMembersOut(BaseModel):
    course_id: Optional[str] = ""
    course_title: Optional[str] = ""
    course_code: Optional[str] = ""
    teachers: List[CourseMemberUser] = []
    students: List[CourseMemberUser] = []
    pending_requests: List[CourseEnrollmentOut] = []

    model_config = ConfigDict(from_attributes=True, arbitrary_types_allowed=True)


class CourseOut(BaseModel):
    id: str
    title: Optional[str] = "Untitled Course"
    description: Optional[str] = ""
    code: Optional[str] = ""
    thumbnail_url: Optional[str] = None
    status: Optional[str] = "active"  # "active" | "inactive"
    teacher_id: Optional[str] = ""
    teacher_name: Optional[str] = None
    teacher_ids: List[str] = []
    student_ids: List[str] = []
    student_count: int = 0
    lecture_count: int = 0
    pending_requests_count: int = 0
    glossary: List[str] = []
    user_enrollment_status: Optional[str] = None  # "approved" | "pending" | "rejected" | None
    created_at: Optional[Union[datetime.datetime, str]] = ""
    updated_at: Optional[Union[datetime.datetime, str]] = None

    model_config = ConfigDict(from_attributes=True, arbitrary_types_allowed=True)


class CourseEnrollResponse(BaseModel):
    success: bool = True
    status: str = "pending"  # "pending" or "approved"
    message: str = "Enrollment request submitted successfully."
    course_id: Optional[str] = None
    course_title: Optional[str] = None
    course_code: Optional[str] = None
    enrollment: Optional[CourseEnrollmentOut] = None

    model_config = ConfigDict(from_attributes=True, arbitrary_types_allowed=True)


class AdminAssignTeacher(BaseModel):
    teacher_id: str


class CourseGlossaryUpdate(BaseModel):
    glossary: List[str] = []
