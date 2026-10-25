import pytest


@pytest.mark.asyncio
async def test_health_check(client):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_seed_users_and_login(client):
    # Test teacher login
    t_login = await client.post(
        "/api/auth/login",
        json={"email": "teacher@lecturelens.edu", "password": "TeacherPass123!"},
    )
    assert t_login.status_code == 200
    t_data = t_login.json()
    assert "access_token" in t_data
    assert t_data["user"]["role"] == "teacher"

    # Test student login
    s_login = await client.post(
        "/api/auth/login",
        json={"email": "student@lecturelens.edu", "password": "StudentPass123!"},
    )
    assert s_login.status_code == 200
    s_data = s_login.json()
    assert s_data["user"]["role"] == "student"


@pytest.mark.asyncio
async def test_role_based_access_control(client):
    # Student token
    s_login = await client.post(
        "/api/auth/login",
        json={"email": "student@lecturelens.edu", "password": "StudentPass123!"},
    )
    s_token = s_login.json()["access_token"]
    s_headers = {"Authorization": f"Bearer {s_token}"}

    # Student cannot create courses
    create_res = await client.post(
        "/api/courses",
        json={"title": "Unauthorized Course", "description": "Fail"},
        headers=s_headers,
    )
    assert create_res.status_code == 403

    # Teacher can create courses
    t_login = await client.post(
        "/api/auth/login",
        json={"email": "teacher@lecturelens.edu", "password": "TeacherPass123!"},
    )
    t_token = t_login.json()["access_token"]
    t_headers = {"Authorization": f"Bearer {t_token}"}

    create_ok = await client.post(
        "/api/courses",
        json={"title": "Natural Language Processing", "description": "Transformers and LLMs", "code": "NLP101"},
        headers=t_headers,
    )
    assert create_ok.status_code == 200
    assert create_ok.json()["code"] == "NLP101"


@pytest.mark.asyncio
async def test_course_listing_and_enrollment(client):
    t_login = await client.post(
        "/api/auth/login",
        json={"email": "teacher@lecturelens.edu", "password": "TeacherPass123!"},
    )
    t_headers = {"Authorization": f"Bearer {t_login.json()['access_token']}"}

    s_login = await client.post(
        "/api/auth/login",
        json={"email": "student@lecturelens.edu", "password": "StudentPass123!"},
    )
    s_headers = {"Authorization": f"Bearer {s_login.json()['access_token']}"}

    # Create new course by teacher
    course_res = await client.post(
        "/api/courses",
        json={"title": "Deep Learning Systems", "description": "GPU and Distributed ML", "code": "DLS999"},
        headers=t_headers,
    )
    course_id = course_res.json()["id"]

    # Student enrolls
    enroll_res = await client.post(
        "/api/courses/enroll",
        json={"code": "DLS999"},
        headers=s_headers,
    )
    assert enroll_res.status_code == 200

    # Student now sees this course
    s_courses = await client.get("/api/courses", headers=s_headers)
    assert s_courses.status_code == 200
    course_ids = [c["id"] for c in s_courses.json()]
    assert course_id in course_ids


@pytest.mark.asyncio
async def test_segment_endpoint_backward_compatibility(client):
    payload = {
        "segments": [
            {"start": 0.0, "end": 4.5, "text": "Welcome to neural networks class."},
            {"start": 4.5, "end": 9.0, "text": "We start with artificial neurons."},
            {"start": 9.0, "end": 14.0, "text": "Now we move to transformer attention mechanisms."},
            {"start": 14.0, "end": 18.0, "text": "Multi-head attention computes key query value."},
        ]
    }
    response = await client.post("/segment", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "topics" in data
    assert data["topic_count"] >= 1


@pytest.mark.asyncio
async def test_lecture_crud_and_editing(client):
    # Log in as teacher
    t_login = await client.post(
        "/api/auth/login",
        json={"email": "teacher@lecturelens.edu", "password": "TeacherPass123!"},
    )
    t_headers = {"Authorization": f"Bearer {t_login.json()['access_token']}"}

    # Get course
    courses = await client.get("/api/courses", headers=t_headers)
    course_id = courses.json()[0]["id"]

    # Create YouTube lecture
    create_yt = await client.post(
        "/api/lectures/youtube",
        json={
            "title": "Intro to Transformers",
            "course_id": course_id,
            "youtube_url": "https://www.youtube.com/watch?v=kCc8FmEb1nY",
            "description": "Attention is all you need deep dive",
        },
        headers=t_headers,
    )
    assert create_yt.status_code == 200
    lecture = create_yt.json()
    lecture_id = lecture["id"]
    assert lecture["source_type"] == "youtube"
    assert lecture["status"] == "queued"
    assert lecture["is_published"] is False

    # Simulate manual segments and topics for testing review endpoints
    from app.database import get_db
    from bson import ObjectId
    db = get_db()

    sample_segments = [
        {"segment_index": 0, "start": 0.0, "end": 5.0, "text": "Welcome to neural attention mechanisms.", "avg_logprob": -0.1},
        {"segment_index": 1, "start": 5.0, "end": 10.0, "text": "Self-attention replaces recurrence entirely.", "avg_logprob": -0.15},
        {"segment_index": 2, "start": 10.0, "end": 15.0, "text": "We compute queries keys and values.", "avg_logprob": -0.2},
    ]
    sample_topics = [
        {
            "topic_id": 1,
            "title": "Self-Attention Fundamentals",
            "start": 0.0,
            "end": 15.0,
            "segments": sample_segments,
        }
    ]
    await db.lectures.update_one(
        {"_id": ObjectId(lecture_id) if ObjectId.is_valid(lecture_id) else lecture_id},
        {"$set": {"status": "review_required", "segments": sample_segments, "topics": sample_topics}}
    )

    # Index chunks for search
    from app.services.vector_search import index_lecture_chunks
    await index_lecture_chunks(lecture_id, course_id, sample_topics, is_published=False)

    # Teacher corrects transcript segment
    edit_seg_res = await client.patch(
        f"/api/lectures/{lecture_id}/transcript",
        json={"segment_index": 0, "new_text": "Welcome to deep self-attention mechanisms."},
        headers=t_headers,
    )
    assert edit_seg_res.status_code == 200
    assert edit_seg_res.json()["segment"]["text"] == "Welcome to deep self-attention mechanisms."
    assert edit_seg_res.json()["segment"]["is_edited"] is True

    # Teacher corrects topic
    edit_top_res = await client.patch(
        f"/api/lectures/{lecture_id}/topics/1",
        json={"topic_index": 1, "new_title": "Self-Attention & Multi-Head Attention", "start": 0.0, "end": 15.0},
        headers=t_headers,
    )
    assert edit_top_res.status_code == 200
    assert edit_top_res.json()["topic"]["title"] == "Self-Attention & Multi-Head Attention"

    # Teacher publishes lecture
    publish_res = await client.patch(
        f"/api/lectures/{lecture_id}/publish",
        json={"is_published": True},
        headers=t_headers,
    )
    assert publish_res.status_code == 200
    assert publish_res.json()["is_published"] is True


@pytest.mark.asyncio
async def test_search_and_grounded_qa(client):
    s_login = await client.post(
        "/api/auth/login",
        json={"email": "student@lecturelens.edu", "password": "StudentPass123!"},
    )
    s_headers = {"Authorization": f"Bearer {s_login.json()['access_token']}"}

    # Vector search for attention
    search_res = await client.post(
        "/api/search",
        json={"query": "neural attention and query key values", "search_mode": "vector", "top_k": 3},
        headers=s_headers,
    )
    assert search_res.status_code == 200
    items = search_res.json()
    assert len(items) >= 1
    assert "score" in items[0]
    assert items[0]["timestamp_url"] is not None

    # Keyword search
    kw_res = await client.post(
        "/api/search",
        json={"query": "recurrence", "search_mode": "keyword", "top_k": 3},
        headers=s_headers,
    )
    assert kw_res.status_code == 200

    # Grounded Q&A with evidence
    qa_res = await client.post(
        "/api/qa",
        json={"query": "What replaces recurrence in transformers?"},
        headers=s_headers,
    )
    assert qa_res.status_code == 200
    qa_data = qa_res.json()
    assert qa_data["is_grounded"] is True
    assert len(qa_data["citations"]) > 0

    # Grounded Q&A abstention test (unrelated question)
    unrelated_res = await client.post(
        "/api/qa",
        json={"query": "What is the recipe for baking chocolate chip cookies?"},
        headers=s_headers,
    )
    assert unrelated_res.status_code == 200
    unrelated_data = unrelated_res.json()
    # System should state evidence is insufficient
    assert "insufficient evidence" in unrelated_data["answer"].lower() or unrelated_data["is_grounded"] is False


@pytest.mark.asyncio
async def test_quiz_lifecycle_and_analytics(client):
    t_login = await client.post(
        "/api/auth/login",
        json={"email": "teacher@lecturelens.edu", "password": "TeacherPass123!"},
    )
    t_headers = {"Authorization": f"Bearer {t_login.json()['access_token']}"}

    s_login = await client.post(
        "/api/auth/login",
        json={"email": "student@lecturelens.edu", "password": "StudentPass123!"},
    )
    s_headers = {"Authorization": f"Bearer {s_login.json()['access_token']}"}

    # Get lectures
    lecs = await client.get("/api/lectures", headers=t_headers)
    assert len(lecs.json()) > 0
    lecture_id = lecs.json()[0]["id"]
    course_id = lecs.json()[0]["course_id"]

    # Student requests quizzes before approval -> must be empty
    s_quiz_early = await client.get(f"/api/lectures/{lecture_id}/quizzes", headers=s_headers)
    assert s_quiz_early.status_code == 200
    assert len(s_quiz_early.json()) == 0

    # Teacher inserts a draft question and approves it
    from app.database import get_db
    db = get_db()
    draft_q = {
        "lecture_id": str(lecture_id),
        "topic_id": 1,
        "question_type": "mcq",
        "question": "What is the primary benefit of multi-head attention?",
        "options": ["Parallel representation subspaces", "Slower convergence", "Eliminates matrices"],
        "correct_answer": "Parallel representation subspaces",
        "explanation": "Allows joint attendance to information from different representation subspaces.",
        "difficulty": "medium",
        "is_approved": False,
    }
    insert_res = await db.quizzes.insert_one(draft_q)
    quiz_id = str(insert_res.inserted_id)

    # Teacher approves question
    approve_res = await client.patch(
        f"/api/quizzes/{quiz_id}/approve",
        json={"is_approved": True},
        headers=t_headers,
    )
    assert approve_res.status_code == 200
    assert approve_res.json()["is_approved"] is True

    # Student now sees approved question (without correct_answer or explanation)
    s_quiz_now = await client.get(f"/api/lectures/{lecture_id}/quizzes", headers=s_headers)
    assert s_quiz_now.status_code == 200
    s_questions = s_quiz_now.json()
    assert len(s_questions) >= 1
    assert s_questions[0]["correct_answer"] is None
    assert s_questions[0]["explanation"] is None

    # Student submits attempt with correct answer
    submit_res = await client.post(
        f"/api/lectures/{lecture_id}/quizzes/submit",
        json={"answers": {quiz_id: "Parallel representation subspaces"}},
        headers=s_headers,
    )
    assert submit_res.status_code == 200
    attempt = submit_res.json()
    assert attempt["score"] == 100.0
    assert attempt["correct_count"] == 1

    # Student checks revision recommendations
    rev_res = await client.get("/api/revision/recommendations", headers=s_headers)
    assert rev_res.status_code == 200
    assert isinstance(rev_res.json(), list)

    # Teacher views course quiz analytics
    analytics_res = await client.get(f"/api/courses/{course_id}/quiz-analytics", headers=t_headers)
    assert analytics_res.status_code == 200
    analytics = analytics_res.json()
    assert analytics["total_attempts"] >= 1
    assert analytics["average_score"] > 0

