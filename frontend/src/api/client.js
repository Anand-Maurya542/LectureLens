const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem("lecturelens_token");
  const headers = {
    ...(options.headers || {}),
  };

  // Attach token if present and not already provided
  if (token && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Set Content-Type to application/json for non-FormData payloads
  if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const isPublicAuthEndpoint =
    endpoint.includes("/api/auth/login") ||
    endpoint.includes("/api/auth/register") ||
    endpoint.includes("/api/auth/teacher/invitation") ||
    endpoint.includes("/api/auth/teacher/activate") ||
    endpoint.includes("/api/auth/teacher/application-status");

  if (response.status === 401 && !isPublicAuthEndpoint) {
    // If an authenticated endpoint returns 401, the token is invalid or expired
    if (token) {
      localStorage.removeItem("lecturelens_token");
      localStorage.removeItem("lecturelens_user");
      window.dispatchEvent(new Event("auth:logout"));
    }
  }

  // Handle No Content (204)
  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = data?.detail || data?.message || `Request failed with status ${response.status}`;
    const err = new Error(errorMsg);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

export const api = {
  // Auth
  login: (email, password) =>
    apiRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  register: (payload) =>
    apiRequest("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getMe: () => apiRequest("/api/auth/me"),

  // Courses
  getCourses: (catalog = false, status = null) => {
    const params = new URLSearchParams();
    if (catalog) params.append("catalog", "true");
    if (status && status !== "all") params.append("status", status);
    const qs = params.toString();
    return apiRequest(qs ? `/api/courses?${qs}` : "/api/courses");
  },
  getCourse: (id) => apiRequest(`/api/courses/${id}`),
  createCourse: (data) =>
    apiRequest("/api/courses", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCourse: (id, data) =>
    apiRequest(`/api/courses/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteCourse: (id, force = false) =>
    apiRequest(`/api/courses/${id}${force ? "?force=true" : ""}`, {
      method: "DELETE",
    }),
  requestCourseEnrollment: (courseId) =>
    apiRequest(`/api/courses/${courseId}/enroll`, {
      method: "POST",
    }),
  getMyEnrollments: () => apiRequest("/api/courses/my/enrollments"),
  getCourseContent: (courseId) => apiRequest(`/api/courses/${courseId}/content`),
  getCourseQuizzes: (courseId) => apiRequest(`/api/courses/${courseId}/quizzes`),
  getCourseQuizSubmissions: (courseId) => apiRequest(`/api/courses/${courseId}/quiz-submissions`),
  getMyCourseAttempts: (courseId) => apiRequest(`/api/courses/${courseId}/my-attempts`),
  enrollCourse: (code) =>
    apiRequest("/api/courses/enroll", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),
  getCourseAnalytics: (courseId) =>
    apiRequest(`/api/courses/${courseId}/quiz-analytics`),

  // Lectures
  getLectures: (courseId = null) =>
    apiRequest(courseId ? `/api/lectures?course_id=${courseId}` : "/api/lectures"),
  getLecture: (id) => apiRequest(`/api/lectures/${id}`),
  createYouTubeLecture: (data) =>
    apiRequest("/api/lectures/youtube", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  uploadLecture: (formData) =>
    apiRequest("/api/lectures/upload", {
      method: "POST",
      body: formData,
    }),
  updatePublication: (lectureId, isPublished) =>
    apiRequest(`/api/lectures/${lectureId}/publish`, {
      method: "PATCH",
      body: JSON.stringify({ is_published: isPublished }),
    }),
  retryLecture: (lectureId) =>
    apiRequest(`/api/lectures/${lectureId}/retry`, {
      method: "POST",
    }),
  deleteLecture: (lectureId) =>
    apiRequest(`/api/lectures/${lectureId}`, {
      method: "DELETE",
    }),
  uploadSubtitles: (lectureId, file) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiRequest(`/api/lectures/${lectureId}/subtitles`, {
      method: "POST",
      body: formData,
    });
  },
  submitTranscriptText: (lectureId, text) =>
    apiRequest(`/api/lectures/${lectureId}/transcript-text`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
  attachMedia: (lectureId, file) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiRequest(`/api/lectures/${lectureId}/attach-media`, {
      method: "POST",
      body: formData,
    });
  },

  // Review & Transcript Management
  getLectureTranscript: (lectureId) =>
    apiRequest(`/api/lectures/${lectureId}/transcript`),
  editTranscript: (lectureId, segmentIndex, newText) =>
    apiRequest(`/api/lectures/${lectureId}/transcript`, {
      method: "PATCH",
      body: JSON.stringify({ segment_index: segmentIndex, new_text: newText }),
    }),
  batchEditTranscript: (lectureId, corrections) =>
    apiRequest(`/api/lectures/${lectureId}/transcript/batch-correct`, {
      method: "POST",
      body: JSON.stringify({ corrections }),
    }),
  approveTranscript: (lectureId, data = {}) =>
    apiRequest(`/api/lectures/${lectureId}/transcript/approve`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  rejectTranscript: (lectureId, rejectionReason) =>
    apiRequest(`/api/lectures/${lectureId}/transcript/reject`, {
      method: "POST",
      body: JSON.stringify({ rejection_reason: rejectionReason }),
    }),
  getCourseGlossary: (courseId) =>
    apiRequest(`/api/courses/${courseId}/glossary`),
  updateCourseGlossary: (courseId, glossary) =>
    apiRequest(`/api/courses/${courseId}/glossary`, {
      method: "PUT",
      body: JSON.stringify({ glossary }),
    }),
  editTopic: (lectureId, topicIndex, data) =>
    apiRequest(`/api/lectures/${lectureId}/topics/${topicIndex}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  // Search & Grounded QA
  search: (query, options = {}) =>
    apiRequest("/api/search", {
      method: "POST",
      body: JSON.stringify({ query, ...options }),
    }),
  askQuestion: (query, options = {}) =>
    apiRequest("/api/qa", {
      method: "POST",
      body: JSON.stringify({ query, ...options }),
    }),

  // Quizzes
  getLectureQuizzes: (lectureId) =>
    apiRequest(`/api/lectures/${lectureId}/quizzes`),
  approveQuiz: (quizId, data) =>
    apiRequest(`/api/quizzes/${quizId}/approve`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  createQuizQuestion: (lectureId, data) =>
    apiRequest(`/api/lectures/${lectureId}/quizzes`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  generateQuizDrafts: (lectureId) =>
    apiRequest(`/api/lectures/${lectureId}/quizzes/generate`, {
      method: "POST",
    }),
  generateQuizzes: (lectureId) =>
    apiRequest(`/api/lectures/${lectureId}/quizzes/generate`, {
      method: "POST",
    }),
  deleteQuizQuestion: (quizId) =>
    apiRequest(`/api/quizzes/${quizId}`, {
      method: "DELETE",
    }),
  submitQuizAttempt: (lectureId, answers) =>
    apiRequest(`/api/lectures/${lectureId}/quizzes/submit`, {
      method: "POST",
      body: JSON.stringify({ answers }),
    }),

  // User Profile & Settings
  updateProfile: (data) =>
    apiRequest("/api/auth/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  changePassword: (data) =>
    apiRequest("/api/auth/password", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  getSettings: () => apiRequest("/api/auth/settings"),
  updateSettings: (data) =>
    apiRequest("/api/auth/settings", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteAccount: (data) =>
    apiRequest("/api/auth/account", {
      method: "DELETE",
      body: JSON.stringify(data),
    }),

  // Admin Portal
  getAdminStats: () => apiRequest("/api/admin/stats"),
  getAdminUsers: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiRequest(q ? `/api/admin/users?${q}` : "/api/admin/users");
  },
  updateAdminUser: (userId, data) =>
    apiRequest(`/api/admin/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteAdminUser: (userId) =>
    apiRequest(`/api/admin/users/${userId}`, {
      method: "DELETE",
    }),
  getAdminLectures: () => apiRequest("/api/admin/lectures"),
  deleteAdminLecture: (lectureId) =>
    apiRequest(`/api/admin/lectures/${lectureId}`, {
      method: "DELETE",
    }),
  getAdminSystemStatus: () => apiRequest("/api/admin/system"),
  getAdminTeacherApplications: (status = null) =>
    apiRequest(
      status && status !== "all"
        ? `/api/admin/teacher-applications?status=${encodeURIComponent(status)}`
        : "/api/admin/teacher-applications"
    ),
  approveTeacherApplication: (applicationId) =>
    apiRequest(`/api/admin/teacher-applications/${applicationId}/approve`, {
      method: "POST",
    }),
  rejectTeacherApplication: (applicationId, rejectionReason) =>
    apiRequest(`/api/admin/teacher-applications/${applicationId}/reject`, {
      method: "POST",
      body: JSON.stringify({ rejection_reason: rejectionReason }),
    }),

  // Admin Course & Enrollment Management
  createTeacherByAdmin: (data) =>
    apiRequest("/api/admin/teachers", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  assignTeacherToCourse: (courseId, teacherId) =>
    apiRequest(`/api/admin/courses/${courseId}/assign-teacher`, {
      method: "POST",
      body: JSON.stringify({ teacher_id: teacherId }),
    }),
  getAdminCourses: (search = null, status = null) => {
    const params = new URLSearchParams();
    if (search && search.trim()) params.append("search", search.trim());
    if (status && status !== "all") params.append("status", status);
    const qs = params.toString();
    return apiRequest(qs ? `/api/admin/courses?${qs}` : "/api/admin/courses");
  },
  getCourseMembers: (courseId) =>
    apiRequest(`/api/admin/courses/${courseId}/members`),
  removeCourseMember: (courseId, userId) =>
    apiRequest(`/api/admin/courses/${courseId}/members/${userId}`, {
      method: "DELETE",
    }),
  getAdminEnrollments: (status = null, role = null, courseId = null) => {
    const params = new URLSearchParams();
    if (status && status !== "all") params.append("status", status);
    if (role && role !== "all") params.append("role", role);
    if (courseId && courseId !== "all") params.append("course_id", courseId);
    const qs = params.toString();
    return apiRequest(qs ? `/api/admin/enrollments?${qs}` : "/api/admin/enrollments");
  },
  approveEnrollment: (enrollmentId) =>
    apiRequest(`/api/admin/enrollments/${enrollmentId}/approve`, {
      method: "POST",
    }),
  rejectEnrollment: (enrollmentId, rejectionReason) =>
    apiRequest(`/api/admin/enrollments/${enrollmentId}/reject`, {
      method: "POST",
      body: JSON.stringify({ rejection_reason: rejectionReason }),
    }),

  // Notifications
  getNotifications: () => apiRequest("/api/auth/notifications"),
  markNotificationRead: (notificationId) =>
    apiRequest(`/api/auth/notifications/${notificationId}/read`, {
      method: "PATCH",
    }),

  // Teacher Registration & Application Status
  registerTeacherApplication: (data) =>
    apiRequest("/api/auth/teacher/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  checkTeacherApplicationStatus: (email) =>
    apiRequest(`/api/auth/teacher/application-status?email=${encodeURIComponent(email)}`),

  // Teacher Account Activation & Setup
  verifyTeacherInvitation: (token) =>
    apiRequest(`/api/auth/teacher/invitation?token=${encodeURIComponent(token)}`),
  activateTeacherAccount: (data) =>
    apiRequest("/api/auth/teacher/activate", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateTeacherByAdmin: (teacherId, data) =>
    apiRequest(`/api/admin/teachers/${teacherId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  resendTeacherInvitation: (teacherId) =>
    apiRequest(`/api/admin/teachers/${teacherId}/resend-invitation`, {
      method: "POST",
    }),

  // Personalized Revision
  getRevisionRecommendations: (courseId = null) =>
    apiRequest(
      courseId
        ? `/api/revision/recommendations?course_id=${courseId}`
        : "/api/revision/recommendations"
    ),
};

