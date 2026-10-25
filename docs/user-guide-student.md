# Student Learning Hub & User Guide

Welcome to the **LectureLens Student Learning Workspace**. This guide explains how to enroll in courses, navigate interactive lectures, search course knowledge with Atlas Vector Search, ask grounded questions, take quizzes, and use smart revision plans.

---

## 1. Signing In as a Student

1. Navigate to `http://localhost:5173/login`.
2. Click the demo button: **Priya Verma (Student)**.
   - Or enter credentials: `student@lecturelens.edu` / `StudentPass123!`.
3. You will be redirected to the **Student Learning Workspace** (`/student`).

---

## 2. Enrolling in a Course

1. At the top of your dashboard, locate the **Course Enrollment** bar.
2. Enter the 6-character code provided by your instructor (e.g., `CS401`).
3. Click **Enroll**.
4. The course appears in your enrolled courses grid, and all teacher-approved lectures become accessible immediately.

---

## 3. Navigating Interactive Lectures

1. On your home screen, click **Open Learning Workspace** on any published lecture.
2. **Synchronized Playback**:
   - The media player is pinned on the left.
   - The **Transcript Tab** on the right shows the entire lecture text broken into time-stamped sentences.
   - Click any timestamp button `[05:12]` to jump the video directly to that exact explanation.
3. **In-Lecture Search**: Type keywords into the filter bar above the transcript to highlight and isolate specific spoken phrases.
4. **Section Summaries**: Click the **Key Summaries** tab to review concise, bulleted key takeaways extracted for each topic section.

---

## 4. Atlas Semantic Search & Grounded Q&A

Click **Atlas Search & Q&A** in the navigation header to access neural retrieval across all your enrolled lectures.

### Mode A: Semantic Passage Retrieval
1. Select **Semantic Passage Retrieval**.
2. Type any conceptual query (e.g. *"how does backpropagation compute gradients?"*).
3. Choose your search mode:
   - **Atlas Vector Search**: Understands semantic intent using 384-dimensional multilingual embeddings.
   - **Hybrid Search**: Combines semantic embeddings with exact keyword matches using Reciprocal Rank Fusion (RRF).
   - **Keyword Search**: Performs lexical matching.
4. Click any search result's **Jump to Video** button to open the lecture player at that exact timestamp.

### Mode B: Evidence-Grounded Q&A (RAG)
1. Select the **Evidence-Grounded Q&A** tab.
2. Type an academic question in plain English.
3. The system answers your question strictly using quotes from your lectures.
4. Every statement links to clickable **Supporting Lecture Citations**.
5. *Note: If a question is outside the scope of your course (e.g., general trivia), the system will responsibly state that lecture materials do not contain sufficient evidence, preventing hallucinated answers.*

---

## 5. Taking Section Quizzes

1. Inside any lecture workspace, click the top-right button: **Take Section Quiz**.
2. You will see multiple-choice questions vetted and approved by your instructor.
3. Select your answers for each question and click **Submit Answers**.
4. Instant Feedback:
   - Your total percentage score is calculated.
   - Green/red indicators show which questions were answered correctly or incorrectly.
   - Detailed pedagogical explanations explain the underlying concepts and cite the relevant lecture timestamp.

---

## 6. Following Your Smart Revision Plan

1. Click **Smart Revision** in the navigation header (`/student/revision`).
2. The system analyzes your past quiz attempts to pinpoint concepts where you made errors:
   - Each card displays the lecture title, topic name, and your error rate.
   - A transparent explanation explains why the topic is flagged (e.g., *"You missed 1 out of 1 question on this topic"*).
3. Click the **Study Video** button on any recommendation to jump straight into the lecture video at the exact start of that topic explanation.

