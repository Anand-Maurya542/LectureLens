# Frontend Architecture & Developer Guide

## 1. Overview & Directory Structure

The LectureLens frontend is an educational web application built with **React 19** and **Vite 8**, styled with CSS custom properties, and powered by **React Router v7**.

```text
frontend/
├── index.html                  # HTML entry point
├── package.json                # React 19, react-router-dom, lucide-react, vite
├── vite.config.js              # Vite bundler configuration
└── src/
    ├── main.jsx                # React DOM root initialization
    ├── index.css               # Global styles, variables, typography, reset
    ├── App.jsx                 # Central router and role-based route tree
    ├── App.css                 # Application layout, cards, video player, forms
    ├── api/
    │   └── client.js           # Central API client with token & error handling
    ├── context/
    │   └── AuthContext.jsx     # Authentication provider, session rehydration
    ├── components/
    │   ├── Navbar.jsx          # Responsive role-aware header navigation
    │   ├── ProtectedRoute.jsx  # Role-based route guard
    │   ├── VideoPlayer.jsx     # YouTube & HTML5 video player with seekTo API
    │   ├── StatusBadge.jsx     # Pipeline status badge with pulsing indicators
    │   ├── UncertaintyPill.jsx # Confidence badge (High / Moderate / Review)
    │   └── CitationCard.jsx    # Clickable timestamp citation component
    └── pages/
        ├── auth/
        │   ├── Login.jsx       # Login form with 1-click demo accounts
        │   └── Register.jsx    # Registration with student/teacher invite codes
        ├── teacher/
        │   ├── TeacherDashboard.jsx # Studio overview, stats & lecture queue
        │   ├── CourseManager.jsx    # Course creation, codes & student roster
        │   ├── AddLecture.jsx       # Dual upload & YouTube ingestion with consent
        │   ├── LectureReview.jsx    # Transcript editor, topic editor & publisher
        │   ├── QuizManager.jsx      # Assessment review, editing & approval
        │   └── TeacherAnalytics.jsx # Course diagnostic error rates & struggles
        └── student/
            ├── StudentDashboard.jsx # Enrolled courses & published lectures
            ├── LectureViewer.jsx    # Player + synced clickable transcript + QA
            ├── GlobalSearch.jsx     # Atlas Vector Search, keyword & hybrid modes
            ├── QuizExperience.jsx   # Interactive assessment taking & scoring
            └── RevisionPlan.jsx     # Weak topic list with direct video deep links
```

---

## 2. Authentication State & Route Guards

### Auth Context (`src/context/AuthContext.jsx`)
Maintains global authentication state across page reloads:
- `user`: Authenticated user profile (`id`, `name`, `email`, `role`, `status`).
- `token`: JWT Bearer access token persisted in `localStorage`.
- `isTeacher`: Convenience boolean (`role === 'teacher' || role === 'admin'`).
- `isStudent`: Convenience boolean (`role === 'student'`).
- Listens for a custom `auth:logout` window event to cleanly redirect expired sessions.

### Protected Routes (`src/components/ProtectedRoute.jsx`)
Guards views against unauthorized access:
```jsx
// Teacher-only route guard
<Route
  path="/teacher/courses"
  element={
    <ProtectedRoute allowedRoles={["teacher", "admin"]}>
      <CourseManager />
    </ProtectedRoute>
  }
/>
```
If an unauthenticated user hits a protected URL, they are redirected to `/login` with the attempted location preserved in `state.from`. If a student attempts to access `/teacher/*`, they are redirected to `/student`.

---

## 3. Central API Client (`src/api/client.js`)

All communication with the FastAPI backend passes through `apiClient`:
- **Base URL**: Automatically reads `import.meta.env.VITE_API_URL` or defaults to `http://127.0.0.1:8000`.
- **Token Attachment**: Injects `Authorization: Bearer <token>` into outgoing requests automatically.
- **Content-Type Handling**: Correctly uses `application/json` for standard requests while preserving browser multipart boundaries for `FormData` file uploads.
- **Error Propagation**: Extracts FastAPI HTTP exception `detail` messages into readable JavaScript errors.

---

## 4. Key UI Components & Interactions

### 1. Interactive Video Player (`src/components/VideoPlayer.jsx`)
Exposes an imperative `seekTo(seconds)` method via `forwardRef` and `useImperativeHandle`:
- **YouTube Embeds**: Communicates with the embedded YouTube player via `postMessage`:
  ```javascript
  iframeRef.current.contentWindow.postMessage(
    JSON.stringify({ event: "command", func: "seekTo", args: [seconds, true] }),
    "*"
  );
  ```
- **HTML5 Video/Audio**: Directly controls `mediaRef.current.currentTime = seconds`.
- Clicking any transcript segment timestamp, citation card, or revision recommendation automatically seeks the video.

### 2. Transcript Review & Correction (`src/pages/teacher/LectureReview.jsx`)
- Segments are rendered with start/end time pills.
- Displays `UncertaintyPill` derived from Faster-Whisper's `avg_logprob` (e.g., *High Confidence* vs *Review Suggested*).
- Clicking the pencil icon enters inline editing mode. Saving makes an asynchronous `PATCH /api/lectures/{id}/transcript` request, updates the audit trail, and immediately re-indexes vector search chunks.

### 3. Assessment Approval Gate (`src/pages/teacher/QuizManager.jsx`)
- Renders candidate questions generated by the background pipeline.
- Questions default to `is_approved = false` (*Pending Review*), keeping them completely invisible to students.
- Instructors can edit question prompts, adjust distractors, and click **Approve for Students**.

---

## 5. Running & Building the Frontend

### Development Mode:
```bash
cd frontend
npm install
npm run dev
```
Accessible at: `http://localhost:5173`

### Production Build:
```bash
cd frontend
npm run build
```
Build output is generated into `frontend/dist/` (verified clean compile in 91ms).

### Adding a New Page:
1. Create the page component in `src/pages/<role>/<PageName>.jsx`.
2. Add API methods to `src/api/client.js` if new backend endpoints are needed.
3. Register the route in `src/App.jsx` wrapped in `<ProtectedRoute allowedRoles={[...]}>`.
4. Add a navigation link to `src/components/Navbar.jsx`.

