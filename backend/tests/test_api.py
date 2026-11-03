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

    # Student enrolls via course code (creates pending request)
    enroll_res = await client.post(
        "/api/courses/enroll",
        json={"code": "DLS999"},
        headers=s_headers,
    )
    assert enroll_res.status_code == 200
    enroll_data = enroll_res.json()
    assert enroll_data.get("user_enrollment_status") == "pending"

    # Catalog shows pending status
    s_catalog = await client.get("/api/courses?catalog=true", headers=s_headers)
    assert s_catalog.status_code == 200
    assert any(c["id"] == course_id and c.get("user_enrollment_status") == "pending" for c in s_catalog.json())

    # Admin approves the enrollment request
    admin_login = await client.post("/api/auth/login", json={"email": "admin@lecturelens.edu", "password": "AdminPass123!"})
    a_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}
    admin_enrollments = await client.get("/api/admin/enrollments?status=pending", headers=a_headers)
    assert admin_enrollments.status_code == 200
    target_req = next(r for r in admin_enrollments.json() if r["course_id"] == course_id)
    appr_res = await client.post(f"/api/admin/enrollments/{target_req['id']}/approve", headers=a_headers)
    assert appr_res.status_code == 200

    # Student now sees this course in enrolled courses
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


@pytest.mark.asyncio
async def test_admin_portal_endpoints_and_rbac(client):
    # Student cannot access admin endpoints
    s_login = await client.post(
        "/api/auth/login",
        json={"email": "student@lecturelens.edu", "password": "StudentPass123!"},
    )
    s_token = s_login.json()["access_token"]
    s_headers = {"Authorization": f"Bearer {s_token}"}

    denied = await client.get("/api/admin/stats", headers=s_headers)
    assert denied.status_code == 403

    # Admin login
    a_login = await client.post(
        "/api/auth/login",
        json={"email": "admin@lecturelens.edu", "password": "AdminPass123!"},
    )
    assert a_login.status_code == 200
    a_token = a_login.json()["access_token"]
    a_headers = {"Authorization": f"Bearer {a_token}"}

    # Admin accesses stats
    stats_res = await client.get("/api/admin/stats", headers=a_headers)
    assert stats_res.status_code == 200
    stats = stats_res.json()
    assert stats["total_users"] >= 3
    assert stats["total_students"] >= 1
    assert stats["total_teachers"] >= 1
    assert stats["total_admins"] >= 1

    # Admin lists users with search & filter
    users_res = await client.get("/api/admin/users?role=student", headers=a_headers)
    assert users_res.status_code == 200
    users = users_res.json()
    assert len(users) >= 1
    assert all(u["role"] == "student" for u in users)

    # Admin views system status
    sys_res = await client.get("/api/admin/system", headers=a_headers)
    assert sys_res.status_code == 200
    sys_data = sys_res.json()
    assert sys_data["status"] == "healthy"
    assert "collections" in sys_data

    # Admin tests all other admin endpoints
    courses_res = await client.get("/api/admin/courses", headers=a_headers)
    assert courses_res.status_code == 200
    assert isinstance(courses_res.json(), list)

    lectures_res = await client.get("/api/admin/lectures", headers=a_headers)
    assert lectures_res.status_code == 200
    assert isinstance(lectures_res.json(), list)

    apps_res = await client.get("/api/admin/teacher-applications", headers=a_headers)
    assert apps_res.status_code == 200
    assert isinstance(apps_res.json(), list)

    enrolls_res = await client.get("/api/admin/enrollments", headers=a_headers)
    assert enrolls_res.status_code == 200
    assert isinstance(enrolls_res.json(), list)


@pytest.mark.asyncio
async def test_user_profile_and_settings_workflow(client):
    # Login as student
    s_login = await client.post(
        "/api/auth/login",
        json={"email": "student@lecturelens.edu", "password": "StudentPass123!"},
    )
    s_token = s_login.json()["access_token"]
    s_headers = {"Authorization": f"Bearer {s_token}"}

    # Update profile
    prof_res = await client.put(
        "/api/auth/profile",
        json={"name": "Priya Verma Updated", "bio": "Computer Science student specializing in AI."},
        headers=s_headers,
    )
    assert prof_res.status_code == 200
    assert prof_res.json()["name"] == "Priya Verma Updated"
    assert prof_res.json()["bio"] == "Computer Science student specializing in AI."

    # Update settings
    settings_res = await client.put(
        "/api/auth/settings",
        json={
            "learning_preferences": {"preferred_language": "hi", "revision_frequency": "weekly"},
            "notification_settings": {"email_notifications": True, "quiz_reminders": False},
        },
        headers=s_headers,
    )
    assert settings_res.status_code == 200
    assert settings_res.json()["learning_preferences"]["preferred_language"] == "hi"

    # Get settings
    get_sett = await client.get("/api/auth/settings", headers=s_headers)
    assert get_sett.status_code == 200
    assert get_sett.json()["learning_preferences"]["revision_frequency"] == "weekly"

    # Change password
    pwd_res = await client.put(
        "/api/auth/password",
        json={"current_password": "StudentPass123!", "new_password": "NewStudentPass456!"},
        headers=s_headers,
    )
    assert pwd_res.status_code == 200

    # Old password fails
    fail_login = await client.post(
        "/api/auth/login",
        json={"email": "student@lecturelens.edu", "password": "StudentPass123!"},
    )
    assert fail_login.status_code == 401

    # New password succeeds
    succ_login = await client.post(
        "/api/auth/login",
        json={"email": "student@lecturelens.edu", "password": "NewStudentPass456!"},
    )
    assert succ_login.status_code == 200


@pytest.mark.asyncio
async def test_admin_creates_teacher_account_and_assigns_course(client):
    # 1. Public teacher signup is forbidden
    public_teacher_attempt = await client.post(
        "/api/auth/register",
        json={
            "name": "Public Teacher",
            "email": "hacker.teacher@fake.edu",
            "password": "Password123!",
            "role": "teacher",
        },
    )
    assert public_teacher_attempt.status_code == 403
    assert "public registration is strictly for students" in public_teacher_attempt.json()["detail"].lower()

    # Public teacher application creates a pending application review (independent workflow)
    app_attempt = await client.post(
        "/api/auth/teacher/register",
        json={
            "name": "Public Teacher App",
            "email": "hacker.teacher2@fake.edu",
            "password": "Password123!",
        },
    )
    assert app_attempt.status_code == 200
    assert app_attempt.json()["status"] == "pending"

    # 2. Non-admin cannot create teacher accounts
    student_login = await client.post(
        "/api/auth/login",
        json={"email": "student@lecturelens.edu", "password": "NewStudentPass456!"},
    )
    s_token = student_login.json()["access_token"]
    unauth_create = await client.post(
        "/api/admin/teachers",
        json={
            "name": "Dr. Sarah Smith",
            "email": "sarah.smith@oxford.edu",
            "password": "SarahTeacherPass123!",
        },
        headers={"Authorization": f"Bearer {s_token}"},
    )
    assert unauth_create.status_code == 403

    # 3. Admin logs in and creates the teacher account directly
    admin_login = await client.post(
        "/api/auth/login",
        json={"email": "admin@lecturelens.edu", "password": "AdminPass123!"},
    )
    assert admin_login.status_code == 200
    a_token = admin_login.json()["access_token"]
    a_headers = {"Authorization": f"Bearer {a_token}"}

    create_teacher_res = await client.post(
        "/api/admin/teachers",
        json={
            "name": "Dr. Sarah Smith",
            "email": "sarah.smith@oxford.edu",
            "password": "SarahTeacherPass123!",
            "department": "Computer Science & AI",
            "institution": "University of Oxford",
            "bio": "Specializes in Deep Learning and Multimodal Models.",
        },
        headers=a_headers,
    )
    assert create_teacher_res.status_code == 200
    created_teacher = create_teacher_res.json()
    assert created_teacher["email"] == "sarah.smith@oxford.edu"
    assert created_teacher["role"] == "teacher"
    assert created_teacher["status"] == "active"
    teacher_id = created_teacher["id"]

    # 4. Duplicate email creation by admin fails
    dup_teacher_res = await client.post(
        "/api/admin/teachers",
        json={
            "name": "Dr. Sarah Duplicate",
            "email": "sarah.smith@oxford.edu",
            "password": "SarahTeacherPass123!",
        },
        headers=a_headers,
    )
    assert dup_teacher_res.status_code == 400
    assert "already exists" in dup_teacher_res.json()["detail"].lower()

    # 5. Teacher can immediately log in with the admin-assigned password
    teacher_login = await client.post(
        "/api/auth/login",
        json={"email": "sarah.smith@oxford.edu", "password": "SarahTeacherPass123!"},
    )
    assert teacher_login.status_code == 200
    t_data = teacher_login.json()
    assert t_data["user"]["role"] == "teacher"
    t_token = t_data["access_token"]
    t_headers = {"Authorization": f"Bearer {t_token}"}

    # 6. Admin creates a course and assigns the teacher to it
    course_res = await client.post(
        "/api/courses",
        json={
            "title": "CS 701: Advanced Reinforcement Learning",
            "code": "ARL701",
            "description": "Policy gradients, Actor-Critic, and Q-learning",
            "status": "active",
        },
        headers=a_headers,
    )
    assert course_res.status_code == 200
    course_id = course_res.json()["id"]

    assign_res = await client.post(
        f"/api/admin/courses/{course_id}/assign-teacher",
        json={"teacher_id": teacher_id},
        headers=a_headers,
    )
    assert assign_res.status_code == 200
    assert assign_res.json()["success"] is True

    # 7. Teacher now sees this course in their courses list
    t_courses = await client.get("/api/courses", headers=t_headers)
    assert t_courses.status_code == 200
    assert any(c["id"] == course_id for c in t_courses.json())

    # 8. Teacher can upload lecture to assigned course
    lec_res = await client.post(
        "/api/lectures/youtube",
        json={
            "title": "Deep Q-Networks and Experience Replay",
            "course_id": course_id,
            "youtube_url": "https://www.youtube.com/watch?v=kCc8FmEb1nY",
            "description": "Bellman equations and target networks",
        },
        headers=t_headers,
    )
    assert lec_res.status_code == 200


@pytest.mark.asyncio
async def test_course_based_learning_and_enrollment_management_workflow(client):
    # 1. Admin login
    admin_login = await client.post(
        "/api/auth/login",
        json={"email": "admin@lecturelens.edu", "password": "AdminPass123!"},
    )
    assert admin_login.status_code == 200
    a_token = admin_login.json()["access_token"]
    a_headers = {"Authorization": f"Bearer {a_token}"}

    # 1b. Admin creates a course
    create_course_res = await client.post(
        "/api/courses",
        json={
            "title": "CS 601: Distributed Artificial Intelligence",
            "code": "DAI601",
            "description": "Large-scale distributed systems and parameter servers",
            "status": "active",
        },
        headers=a_headers,
    )
    assert create_course_res.status_code == 200
    course = create_course_res.json()
    course_id = course["id"]
    assert course["code"] == "DAI601"
    assert course["status"] == "active"

    # 2. Admin creates teacher account and assigns teacher directly into course
    teacher_email = "prof.distributed@mit.edu"
    teacher_reg_res = await client.post(
        "/api/admin/teachers",
        json={
            "name": "Prof. Alan Turing",
            "email": teacher_email,
            "password": "AlanTeacherPass123!",
            "department": "Computer Science",
            "institution": "MIT",
            "bio": "Distributed systems specialist",
            "assigned_course_id": course_id,
        },
        headers=a_headers,
    )
    assert teacher_reg_res.status_code == 200
    created_teacher = teacher_reg_res.json()
    assert created_teacher["email"] == teacher_email
    assert created_teacher["role"] == "teacher"

    # 6. Teacher account is created and course membership becomes approved
    t_login = await client.post(
        "/api/auth/login",
        json={"email": teacher_email, "password": "AlanTeacherPass123!"},
    )
    assert t_login.status_code == 200
    t_token = t_login.json()["access_token"]
    t_headers = {"Authorization": f"Bearer {t_token}"}

    # Verify teacher sees course in their approved list
    t_courses = await client.get("/api/courses", headers=t_headers)
    assert t_courses.status_code == 200
    assert any(c["id"] == course_id for c in t_courses.json())

    # 7. Teacher uploads and publishes a lecture
    lec_res = await client.post(
        "/api/lectures/youtube",
        json={
            "title": "AllReduce and Parameter Server Architectures",
            "course_id": course_id,
            "youtube_url": "https://www.youtube.com/watch?v=kCc8FmEb1nY",
            "description": "Synchronous vs asynchronous distributed SGD",
        },
        headers=t_headers,
    )
    assert lec_res.status_code == 200
    lecture_id = lec_res.json()["id"]

    # Teacher publishes the lecture
    pub_res = await client.patch(
        f"/api/lectures/{lecture_id}/publish",
        json={"is_published": True},
        headers=t_headers,
    )
    assert pub_res.status_code == 200
    assert pub_res.json()["is_published"] is True

    # Cross-course access restriction: unauthorized teacher cannot publish to course
    other_teacher = await client.post(
        "/api/auth/login",
        json={"email": "teacher@lecturelens.edu", "password": "TeacherPass123!"},
    )
    other_t_headers = {"Authorization": f"Bearer {other_teacher.json()['access_token']}"}
    unauth_upload = await client.post(
        "/api/lectures/youtube",
        json={
            "title": "Unauthorized Lecture",
            "course_id": course_id,
            "youtube_url": "https://www.youtube.com/watch?v=kCc8FmEb1nY",
        },
        headers=other_t_headers,
    )
    assert unauth_upload.status_code == 403

    # 8. Student registers and requests enrollment in the same course
    s_email = "student.dist@university.edu"
    s_reg = await client.post(
        "/api/auth/register",
        json={"name": "Grace Hopper", "email": s_email, "password": "GraceStudentPass123!", "role": "student"},
    )
    assert s_reg.status_code == 200
    s_token = s_reg.json()["access_token"]
    s_headers = {"Authorization": f"Bearer {s_token}"}

    # Student requests enrollment
    enroll_req_res = await client.post(f"/api/courses/{course_id}/enroll", headers=s_headers)
    assert enroll_req_res.status_code == 200
    enrollment_data = enroll_req_res.json()
    enrollment_id = enrollment_data["id"]
    assert enrollment_data["status"] == "pending"

    # Duplicate enrollment request is prevented
    dup_enroll = await client.post(f"/api/courses/{course_id}/enroll", headers=s_headers)
    assert dup_enroll.status_code == 400

    # 9. Student cannot access course content while pending
    blocked_content = await client.get(f"/api/courses/{course_id}/content", headers=s_headers)
    assert blocked_content.status_code == 403

    # 10. Admin views and approves student enrollment
    admin_enrollments = await client.get("/api/admin/enrollments?status=pending", headers=a_headers)
    assert admin_enrollments.status_code == 200
    assert any(e["id"] == enrollment_id for e in admin_enrollments.json())

    appr_enroll_res = await client.post(f"/api/admin/enrollments/{enrollment_id}/approve", headers=a_headers)
    assert appr_enroll_res.status_code == 200
    assert appr_enroll_res.json()["success"] is True

    # 11. Student can now see published lectures
    s_content = await client.get(f"/api/courses/{course_id}/content", headers=s_headers)
    assert s_content.status_code == 200
    s_content_data = s_content.json()
    assert any(l["id"] == lecture_id for l in s_content_data["lectures"])

    # 12. Teacher creates and publishes a quiz
    quiz_res = await client.post(
        f"/api/lectures/{lecture_id}/quizzes",
        json={
            "lecture_id": lecture_id,
            "question": "What is the primary communication bottleneck in distributed data-parallel training?",
            "options": ["Gradient AllReduce synchronization", "Disk I/O latency", "Audio decoding speed", "Vsync refresh rate"],
            "correct_answer": "Gradient AllReduce synchronization",
            "explanation": "Synchronizing dense gradients across network links between GPUs is the bottleneck.",
            "difficulty": "medium",
            "is_approved": True,
        },
        headers=t_headers,
    )
    assert quiz_res.status_code == 200
    quiz_id = quiz_res.json()["id"]

    # 13. Student receives the quiz in their course workspace
    s_quizzes_res = await client.get(f"/api/courses/{course_id}/quizzes", headers=s_headers)
    assert s_quizzes_res.status_code == 200
    s_quizzes = s_quizzes_res.json()
    assert len(s_quizzes) >= 1
    # Ensure correct answer is hidden from student before submit
    assert s_quizzes[0]["correct_answer"] is None

    # 14. Student completes and submits the quiz
    submit_res = await client.post(
        f"/api/lectures/{lecture_id}/quizzes/submit",
        json={"answers": {quiz_id: "Gradient AllReduce synchronization"}},
        headers=s_headers,
    )
    assert submit_res.status_code == 200
    attempt = submit_res.json()
    assert attempt["score"] == 100.0
    assert attempt["correct_count"] == 1

    # 15. Teacher can view the student's result
    submissions_res = await client.get(f"/api/courses/{course_id}/quiz-submissions", headers=t_headers)
    assert submissions_res.status_code == 200
    sub_data = submissions_res.json()
    assert sub_data["total_submissions"] >= 1
    assert any(s["student_name"] == "Grace Hopper" for s in sub_data["submissions"])

    # 16. Test Rejected Enrollment Flow for another student
    s2_reg = await client.post(
        "/api/auth/register",
        json={"name": "Bad Actor", "email": "bad.actor@fake.edu", "password": "BadActorPass123!", "role": "student"},
    )
    s2_headers = {"Authorization": f"Bearer {s2_reg.json()['access_token']}"}
    s2_enroll = await client.post(f"/api/courses/{course_id}/enroll", headers=s2_headers)
    s2_enroll_id = s2_enroll.json()["id"]

    rej_enroll_res = await client.post(
        f"/api/admin/enrollments/{s2_enroll_id}/reject",
        json={"rejection_reason": "Prerequisite CS 501 grade requirement not met."},
        headers=a_headers,
    )
    assert rej_enroll_res.status_code == 200

    # Rejected student still blocked from course content
    s2_blocked = await client.get(f"/api/courses/{course_id}/content", headers=s2_headers)
    assert s2_blocked.status_code == 403

    # Check rejection status in student's enrollment list
    s2_reqs = await client.get("/api/courses/my/enrollments", headers=s2_headers)
    assert s2_reqs.status_code == 200
    assert s2_reqs.json()[0]["status"] == "rejected"
    assert "Prerequisite" in s2_reqs.json()[0]["rejection_reason"]


@pytest.mark.asyncio
async def test_student_course_code_enrollment_cs401_and_catalog(client):
    # 1. Register a new fresh student
    student_reg = await client.post(
        "/api/auth/register",
        json={"name": "Alice Johnson", "email": "alice.johnson@student.edu", "password": "StudentPass123!", "role": "student"},
    )
    assert student_reg.status_code == 200
    s_headers = {"Authorization": f"Bearer {student_reg.json()['access_token']}"}

    # 2. Check Course Catalog: active courses must be displayed (CS401 should be present)
    catalog_res = await client.get("/api/courses?catalog=true", headers=s_headers)
    assert catalog_res.status_code == 200
    catalog = catalog_res.json()
    assert len(catalog) >= 1
    cs401_course = next((c for c in catalog if "CS" in c["code"] and "401" in c["code"]), None)
    assert cs401_course is not None, "CS401 course must be available in catalog"

    # 3. Test invalid course code -> 404
    bad_code_res = await client.post("/api/courses/enroll", json={"code": "INVALID_999"}, headers=s_headers)
    assert bad_code_res.status_code == 404

    # 4. Enroll using code CS401 (lowercase with space or without space)
    enroll_res = await client.post("/api/courses/enroll", json={"code": "cs 401"}, headers=s_headers)
    assert enroll_res.status_code == 200
    enroll_data = enroll_res.json()
    assert enroll_data.get("user_enrollment_status") == "pending"

    # 5. Verify duplicate request returns HTTP 400 with helpful message
    dup_res = await client.post("/api/courses/enroll", json={"code": "CS401"}, headers=s_headers)
    assert dup_res.status_code == 400
    assert "already pending" in dup_res.json()["detail"].lower()

    # 6. Verify pending request in student's my-enrollments
    my_enrolls = await client.get("/api/courses/my/enrollments", headers=s_headers)
    assert my_enrolls.status_code == 200
    assert any(e["course_code"] == cs401_course["code"] and e["status"] == "pending" for e in my_enrolls.json())

    # 7. Before admin approval, content is locked (403)
    content_res = await client.get(f"/api/courses/{cs401_course['id']}/content", headers=s_headers)
    assert content_res.status_code == 403

    # 8. Admin approves the pending enrollment
    admin_login = await client.post("/api/auth/login", json={"email": "admin@lecturelens.edu", "password": "AdminPass123!"})
    a_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}
    pending_list = await client.get("/api/admin/enrollments?status=pending", headers=a_headers)
    assert pending_list.status_code == 200
    enroll_item = next(e for e in pending_list.json() if e["user_email"] == "alice.johnson@student.edu")

    appr_res = await client.post(f"/api/admin/enrollments/{enroll_item['id']}/approve", headers=a_headers)
    assert appr_res.status_code == 200
    assert appr_res.json()["success"] is True

    # 9. Now student is approved and sees CS401 in their enrolled courses
    enrolled_courses = await client.get("/api/courses", headers=s_headers)
    assert enrolled_courses.status_code == 200
    assert any(c["id"] == cs401_course["id"] for c in enrolled_courses.json())

    # 10. Student can now access the course content
    approved_content = await client.get(f"/api/courses/{cs401_course['id']}/content", headers=s_headers)
    assert approved_content.status_code == 200


@pytest.mark.asyncio
async def test_admin_create_teacher_profile_and_activation_workflow(client):
    # 1. Admin login
    admin_login = await client.post(
        "/api/auth/login",
        json={"email": "admin@lecturelens.edu", "password": "AdminPass123!"},
    )
    assert admin_login.status_code == 200
    a_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}

    # 2. Get active courses to assign
    courses_res = await client.get("/api/admin/courses", headers=a_headers)
    assert courses_res.status_code == 200
    courses = courses_res.json()
    assert len(courses) >= 1
    assigned_cids = [courses[0]["id"]]

    # 3. Admin manually creates teacher profile (without password -> activation token generated)
    create_res = await client.post(
        "/api/admin/teachers",
        json={
            "name": "Prof. Donald Knuth",
            "email": "knuth@stanford.edu",
            "phone": "+1 650-723-2300",
            "department": "Computer Science",
            "institution": "Stanford University",
            "bio": "Author of The Art of Computer Programming",
            "avatar_url": "https://example.com/knuth.jpg",
            "course_ids": assigned_cids,
        },
        headers=a_headers,
    )
    assert create_res.status_code == 200
    teacher_data = create_res.json()
    assert teacher_data["name"] == "Prof. Donald Knuth"
    assert teacher_data["email"] == "knuth@stanford.edu"
    assert teacher_data["role"] == "teacher"
    assert teacher_data["status"] == "pending_activation"
    assert teacher_data["admin_created"] is True
    assert teacher_data["department"] == "Computer Science"
    assert teacher_data["institution"] == "Stanford University"
    assert "activation_token" in teacher_data
    assert "invitation_link" in teacher_data
    assert len(teacher_data["assigned_courses"]) == 1
    assert teacher_data["assigned_courses"][0]["id"] == assigned_cids[0]

    token = teacher_data["activation_token"]
    teacher_id = teacher_data["id"]

    # 4. Verify teacher appears in Admin Users list with assigned courses
    users_res = await client.get("/api/admin/users", headers=a_headers)
    assert users_res.status_code == 200
    knuth_user = next((u for u in users_res.json() if u["email"] == "knuth@stanford.edu"), None)
    assert knuth_user is not None
    assert knuth_user["role"] == "teacher"
    assert knuth_user["status"] == "pending_activation"
    assert knuth_user["admin_created"] is True
    assert any(c["id"] == assigned_cids[0] for c in knuth_user.get("assigned_courses", []))

    # 5. Teacher verifies invitation token
    invite_verify = await client.get(f"/api/auth/teacher/invitation?token={token}")
    assert invite_verify.status_code == 200
    verify_data = invite_verify.json()
    assert verify_data["name"] == "Prof. Donald Knuth"
    assert verify_data["email"] == "knuth@stanford.edu"
    assert verify_data["is_valid"] is True
    assert len(verify_data["assigned_courses"]) == 1

    # 6. Teacher activates account and sets secure password
    activate_res = await client.post(
        "/api/auth/teacher/activate",
        json={"token": token, "password": "KnuthSuperPassword2026!"},
    )
    assert activate_res.status_code == 200
    act_data = activate_res.json()
    assert "access_token" in act_data
    assert act_data["user"]["role"] == "teacher"
    assert act_data["user"]["status"] == "active"
    t_headers = {"Authorization": f"Bearer {act_data['access_token']}"}

    # 7. Teacher can immediately log in with their established password
    login_res = await client.post(
        "/api/auth/login",
        json={"email": "knuth@stanford.edu", "password": "KnuthSuperPassword2026!"},
    )
    assert login_res.status_code == 200
    assert login_res.json()["user"]["role"] == "teacher"

    # 8. Teacher can access their assigned course
    my_courses = await client.get("/api/courses", headers=t_headers)
    assert my_courses.status_code == 200
    assert any(c["id"] == assigned_cids[0] for c in my_courses.json())

    # 9. Admin updates teacher profile and assigns an additional course
    update_res = await client.patch(
        f"/api/admin/teachers/{teacher_id}",
        json={
            "phone": "+1 650-999-8888",
            "department": "Advanced Algorithms",
            "bio": "Updated faculty bio",
        },
        headers=a_headers,
    )
    assert update_res.status_code == 200
    assert update_res.json()["phone"] == "+1 650-999-8888"
    assert update_res.json()["department"] == "Advanced Algorithms"

    # 10. Admin resends invitation token
    resend_res = await client.post(
        f"/api/admin/teachers/{teacher_id}/resend-invitation",
        headers=a_headers,
    )
    assert resend_res.status_code == 200
    assert "invitation_link" in resend_res.json()
    assert "activation_token" in resend_res.json()

    # 11. Verify independent teacher registration application workflow is unaffected
    app_res = await client.post(
        "/api/auth/teacher/register",
        json={
            "name": "Dr. Ada Lovelace",
            "email": "ada.lovelace@analytics.org",
            "password": "AdaLovelacePass123!",
            "department": "Mathematics",
            "institution": "Babbage Institute",
            "bio": "Research in algorithmic synthesis and analytical engines.",
        },
    )
    assert app_res.status_code == 200
    assert app_res.json()["status"] == "pending"

    # Applicant appears in teacher-applications review queue
    apps_list = await client.get("/api/admin/teacher-applications", headers=a_headers)
    assert apps_list.status_code == 200
    assert any(a["email"] == "ada.lovelace@analytics.org" for a in apps_list.json())

    # Manually created teacher Knuth does NOT appear in applicant review queue
    assert not any(a["email"] == "knuth@stanford.edu" for a in apps_list.json())





