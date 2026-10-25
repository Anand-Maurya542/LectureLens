# Contributing to LectureLens

Welcome to the **LectureLens** project! This guide outlines development standards, Git workflows, and testing expectations for our student engineering team.

---

## 1. Team Git Workflow & Branching

We follow a feature-branch workflow based on Git best practices:

- **`main`**: Production-ready branch. Code on `main` must pass all tests and build without errors.
- **Feature Branches**: Create a dedicated branch for each feature or bug fix:
  ```bash
  git checkout -b feature/topic-boundary-editor
  # or
  git checkout -b fix/youtube-caption-parser
  ```
- **Commit Messages**: Write concise, descriptive commit messages:
  - `feat: add hybrid search with reciprocal rank fusion`
  - `fix: resolve missing spaces in uvicorn startup command`
  - `test: add integration test for quiz approval gate`
  - `docs: add viva defense preparation guide`

---

## 2. Environment Variables & Secret Safety

1. **NEVER commit secrets**: Passwords, JWT secrets, and MongoDB connection strings must **never** be committed to Git.
2. The root `.gitignore` excludes `.env`, `*.sqlite3`, and `data/uploads/`.
3. When introducing a new environment variable:
   - Add it to [`backend/app/config.py`](file:///Users/ananadmauya/Projects/lecturelens/backend/app/config.py).
   - Document it with a placeholder in [`.env.example`](file:///Users/ananadmauya/Projects/lecturelens/.env.example).
   - Update your local `.env`.

---

## 3. Large Media & Dataset Files

- Lecture recordings (`.mp4`, `.mp3`) must **not** be checked into Git.
- Audio and video files are automatically saved to `data/uploads/`, which is ignored by Git.
- Small benchmark evaluation JSON files should be stored under `evaluation/data/`.

---

## 4. Coding Standards

### Backend (Python / FastAPI):
- Follow **PEP 8** naming conventions (`snake_case` for functions/variables, `PascalCase` for classes).
- Use **Pydantic v2** models for all API request and response validation.
- Keep route handlers lightweight; place ML inference, algorithms, and business logic inside `app/services/`.
- Ensure asynchronous database operations use `await` with Motor.

### Frontend (React / Vite):
- Use functional React components with standard React Hooks.
- Place shared UI components in `src/components/` and page-level views in `src/pages/<role>/`.
- Centralize all API calls in `src/api/client.js`.
- Use CSS variables defined in `src/index.css` for consistent styling.

---

## 5. Testing Expectations

Before opening a pull request or merging into `main`:

1. **Run the Backend Integration Test Suite**:
   ```bash
   PYTHONPATH=backend backend/.venv/bin/pytest backend/tests/test_api.py -v
   ```
   All 8 integration tests must pass.

2. **Verify Frontend Build**:
   ```bash
   cd frontend && npm run build
   ```
   The build must succeed with 0 errors.

3. **Run the Evaluation Suite** (if modifying AI services):
   ```bash
   backend/.venv/bin/python evaluation/run_all_evaluations.py
   ```

---

## 6. Pull Request & Review Checklist

- [ ] Branch is up to date with `origin/main`.
- [ ] No secrets or `.env` files are tracked.
- [ ] Integration tests pass locally.
- [ ] Frontend builds cleanly.
- [ ] At least one peer review approval received.

