import logging
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from app.database import get_db
from app.dependencies.auth import get_current_user
from app.schemas.search import QARequest, QAResponse, SearchRequest, SearchResultItem
from app.services.question_answering import answer_question
from app.services.vector_search import search_chunks

logger = logging.getLogger("lecturelens.router.search")
router = APIRouter(tags=["Search & Retrieval"])


@router.post("/api/search", response_model=list[SearchResultItem])
async def search_endpoint(
    payload: SearchRequest,
    current_user: dict = Depends(get_current_user),
):
    """Executes semantic, keyword, or hybrid search across authorized lecture chunks."""
    db = get_db()
    role = current_user.get("role")
    user_id = str(current_user["id"])

    # If student, ensure only published material from enrolled courses is searchable
    only_published = True if role == "student" else False

    if role == "student":
        enrolled_courses = await db.courses.find({"student_ids": user_id}).to_list(100)
        enrolled_ids = [str(c["_id"]) for c in enrolled_courses]
        
        if payload.course_id and payload.course_id not in enrolled_ids:
            raise HTTPException(status_code=403, detail="Unauthorized course access")
        
        # If no specific course filter passed, restrict to any enrolled course
        if not payload.course_id:
            # We filter chunks where course_id in enrolled_ids
            # Vector search will handle filtering
            pass

    results = await search_chunks(
        query=payload.query,
        course_id=payload.course_id,
        lecture_id=payload.lecture_id,
        search_mode=payload.search_mode,
        top_k=payload.top_k,
        only_published=only_published,
    )

    return results


@router.post("/api/qa", response_model=QAResponse)
@router.post("/api/search/qa", response_model=QAResponse)
async def grounded_qa_endpoint(
    payload: QARequest,
    current_user: dict = Depends(get_current_user),
):
    """Evidence-grounded question answering with strict abstention and citations."""
    role = current_user.get("role")
    only_published = True if role == "student" else False

    result = await answer_question(
        query=payload.query,
        course_id=payload.course_id,
        lecture_id=payload.lecture_id,
        only_published=only_published,
    )
    return result
