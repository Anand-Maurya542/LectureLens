import datetime
from enum import Enum
from typing import Any, Optional, Union
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserRole(str, Enum):
    TEACHER = "teacher"
    STUDENT = "student"
    ADMIN = "admin"


class UserRegister(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6)
    role: Optional[UserRole] = UserRole.STUDENT
    teacher_invite_code: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    name: Optional[str] = "User"
    email: Optional[str] = ""
    role: Optional[Any] = "student"
    status: Optional[str] = "active"
    phone: Optional[str] = ""
    department: Optional[str] = ""
    institution: Optional[str] = ""
    avatar_url: Optional[str] = ""
    bio: Optional[str] = ""
    admin_created: Optional[bool] = False
    activation_token: Optional[str] = None
    invitation_link: Optional[str] = None
    assigned_course_ids: list[str] = []
    assigned_courses: list[dict[str, Any]] = []
    preferences: Optional[dict[str, Any]] = None
    notification_settings: Optional[dict[str, Any]] = None
    created_at: Optional[Union[datetime.datetime, str]] = ""
    updated_at: Optional[Union[datetime.datetime, str]] = None

    model_config = ConfigDict(from_attributes=True, arbitrary_types_allowed=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class UserProfileUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    bio: Optional[str] = Field(None, max_length=500)


class PasswordChangeRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=6)


class UserSettingsUpdate(BaseModel):
    learning_preferences: Optional[dict[str, Any]] = None
    notification_settings: Optional[dict[str, Any]] = None


class AccountDeleteRequest(BaseModel):
    password: str = Field(..., min_length=1)


class AdminUserUpdate(BaseModel):
    role: Optional[UserRole] = None
    status: Optional[str] = None  # active, inactive, suspended


class AdminStatsOut(BaseModel):
    total_users: int = 0
    total_students: int = 0
    total_teachers: int = 0
    total_admins: int = 0
    total_courses: int = 0
    total_lectures: int = 0
    total_processed: int = 0
    total_pending: int = 0
    total_failed: int = 0
    total_quizzes: int = 0
    total_quiz_attempts: int = 0
    pending_teacher_applications: int = 0
    pending_enrollment_requests: int = 0
    recent_activity: list[dict[str, Any]] = []

    model_config = ConfigDict(from_attributes=True, arbitrary_types_allowed=True)


class AdminTeacherCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: Optional[str] = None  # Optional: if omitted, teacher establishes password via secure invitation link
    phone: Optional[str] = ""
    department: Optional[str] = ""
    institution: Optional[str] = ""
    bio: Optional[str] = ""
    avatar_url: Optional[str] = ""
    course_ids: list[str] = Field(default_factory=list)
    assigned_course_id: Optional[str] = None


class AdminTeacherUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    department: Optional[str] = None
    institution: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    status: Optional[str] = None
    course_ids: Optional[list[str]] = None


class TeacherInvitationVerifyOut(BaseModel):
    valid: bool = True
    is_valid: bool = True
    email: str
    name: str
    phone: Optional[str] = ""
    department: Optional[str] = ""
    institution: Optional[str] = ""
    avatar_url: Optional[str] = ""
    assigned_courses: list[dict[str, Any]] = []

    model_config = ConfigDict(from_attributes=True, arbitrary_types_allowed=True)


class TeacherAccountActivate(BaseModel):
    token: str = Field(..., min_length=10)
    password: str = Field(..., min_length=6)


class TeacherApplicationCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6)
    department: Optional[str] = Field("", max_length=100)
    institution: Optional[str] = Field("", max_length=150)
    bio: Optional[str] = Field("", max_length=500)
    requested_course_id: Optional[str] = None


class TeacherApplicationReject(BaseModel):
    rejection_reason: Optional[str] = Field("Application requirements not met", max_length=300)


class TeacherApplicationOut(BaseModel):
    id: str
    name: Optional[str] = "Applicant"
    email: Optional[str] = ""
    department: Optional[str] = ""
    institution: Optional[str] = ""
    bio: Optional[str] = ""
    status: Optional[str] = "pending"  # pending, approved, rejected
    rejection_reason: Optional[str] = None
    requested_course_id: Optional[str] = None
    requested_course_title: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[Union[datetime.datetime, str]] = None
    created_at: Optional[Union[datetime.datetime, str]] = ""
    updated_at: Optional[Union[datetime.datetime, str]] = None

    model_config = ConfigDict(from_attributes=True, arbitrary_types_allowed=True)


class TeacherApplicationStatusOut(BaseModel):
    email: str
    name: Optional[str] = None
    status: str
    department: Optional[str] = None
    institution: Optional[str] = None
    rejection_reason: Optional[str] = None
    created_at: Optional[Union[datetime.datetime, str]] = None
    reviewed_at: Optional[Union[datetime.datetime, str]] = None
    message: str

    model_config = ConfigDict(from_attributes=True, arbitrary_types_allowed=True)

