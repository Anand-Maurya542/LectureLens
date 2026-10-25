import logging
from typing import Optional
from fastapi import APIRouter, Depends
from app.dependencies.auth import get_current_user, require_student
from app.schemas.revision import RevisionRecommendation
from app.services.revision import generate_student_revision_recommendations

logger = logging.getLogger("lecturelens.router.revision")
router = APIRouter(prefix="/api/revision", tags=["Personalized Revision"])


@router.get("/recommendations", response_model=list[RevisionRecommendation])
async def get_revision_recommendations(
    course_id: Optional[str] = None,
    student: dict = Depends(require_student),
):
    """Provides transparent, rule-based weak topic recommendations
    derived from student's past quiz attempts.
    """
    recs = await generate_student_revision_recommendations(
        student_id=str(student["id"]),
        course_id=course_id,
    )
    return recs

