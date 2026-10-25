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

  if (response.status === 401) {
    // If token expired, clear and let auth context handle redirect
    if (token && !endpoint.includes("/api/auth/login")) {
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
  getCourses: () => apiRequest("/api/courses"),
  getCourse: (id) => apiRequest(`/api/courses/${id}`),
  createCourse: (data) =>
    apiRequest("/api/courses", {
      method: "POST",
      body: JSON.stringify(data),
    }),
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

  // Review & Corrections
  editTranscript: (lectureId, segmentIndex, newText) =>
    apiRequest(`/api/lectures/${lectureId}/transcript`, {
      method: "PATCH",
      body: JSON.stringify({ segment_index: segmentIndex, new_text: newText }),
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
  submitQuizAttempt: (lectureId, answers) =>
    apiRequest(`/api/lectures/${lectureId}/quizzes/submit`, {
      method: "POST",
      body: JSON.stringify({ answers }),
    }),

  // Personalized Revision
  getRevisionRecommendations: (courseId = null) =>
    apiRequest(
      courseId
        ? `/api/revision/recommendations?course_id=${courseId}`
        : "/api/revision/recommendations"
    ),
};

