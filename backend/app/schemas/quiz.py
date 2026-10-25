from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class QuizQuestionCreate(BaseModel):
    lecture_id: str
    topic_id: Optional[int] = None
    question_type: str = "mcq"  # "mcq" or "short_answer"
    question: str = Field(..., min_length=5)
    options: list[str] = []
    correct_answer: str = Field(..., min_length=1)
    explanation: Optional[str] = ""
    difficulty: str = "medium"  # "easy", "medium", "hard"
    is_approved: bool = False


class QuizQuestionOut(BaseModel):
    id: str
    lecture_id: str
    topic_id: Optional[int] = None
    question_type: str = "mcq"
    question: str
    options: list[str] = []
    # For students taking the quiz, do not reveal correct_answer or explanation until submitted
    correct_answer: Optional[str] = None
    explanation: Optional[str] = None
    difficulty: str = "medium"
    is_approved: bool = False
    created_at: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class QuizApprovalRequest(BaseModel):
    is_approved: bool
    question: Optional[str] = None
    options: Optional[list[str]] = None
    correct_answer: Optional[str] = None
    explanation: Optional[str] = None
    difficulty: Optional[str] = None


class QuizAttemptSubmit(BaseModel):
    answers: dict[str, str]  # question_id -> student_selected_answer


class QuizResultItem(BaseModel):
    question_id: str
    question: str
    selected_answer: str
    correct_answer: str
    is_correct: bool
    explanation: str
    topic_id: Optional[int] = None


class QuizAttemptOut(BaseModel):
    id: str
    student_id: str
    lecture_id: str
    score: float
    percentage: float
    total_questions: int
    correct_count: int
    results: list[QuizResultItem]
    weak_topics: list[int] = []
    created_at: str

    model_config = ConfigDict(from_attributes=True)
