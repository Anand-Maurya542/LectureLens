import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";

// Auth Pages
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import ActivateTeacher from "./pages/auth/ActivateTeacher";

// Admin Pages
import AdminDashboard from "./pages/admin/AdminDashboard";

// Teacher Pages
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import CourseManager from "./pages/teacher/CourseManager";
import TeacherCourseWorkspace from "./pages/teacher/TeacherCourseWorkspace";
import AddLecture from "./pages/teacher/AddLecture";
import LectureReview from "./pages/teacher/LectureReview";
import QuizManager from "./pages/teacher/QuizManager";
import TeacherAnalytics from "./pages/teacher/TeacherAnalytics";
import TeacherSettings from "./pages/teacher/TeacherSettings";

// Student Pages
import StudentDashboard from "./pages/student/StudentDashboard";
import StudentCourses from "./pages/student/StudentCourses";
import StudentCourseWorkspace from "./pages/student/StudentCourseWorkspace";
import LectureViewer from "./pages/student/LectureViewer";
import GlobalSearch from "./pages/student/GlobalSearch";
import QuizExperience from "./pages/student/QuizExperience";
import RevisionPlan from "./pages/student/RevisionPlan";
import StudentSettings from "./pages/student/StudentSettings";

import "./App.css";

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "admin") {
    return <Navigate to="/admin" replace />;
  }
  if (user.role === "teacher") {
    return <Navigate to="/teacher" replace />;
  }
  return <Navigate to="/student" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="app-shell">
          <Navbar />
          <main className="main-content">
            <ErrorBoundary>
              <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/activate-teacher" element={<ActivateTeacher />} />
              <Route path="/register/teacher" element={<Navigate to="/register" replace />} />
              <Route path="/" element={<RootRedirect />} />

              {/* Admin Routes */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />

              {/* Teacher Routes */}
              <Route
                path="/teacher"
                element={
                  <ProtectedRoute allowedRoles={["teacher", "admin"]}>
                    <TeacherDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/teacher/courses"
                element={
                  <ProtectedRoute allowedRoles={["teacher", "admin"]}>
                    <CourseManager />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/teacher/courses/:id"
                element={
                  <ProtectedRoute allowedRoles={["teacher", "admin"]}>
                    <TeacherCourseWorkspace />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/teacher/add-lecture"
                element={
                  <ProtectedRoute allowedRoles={["teacher", "admin"]}>
                    <AddLecture />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/teacher/lectures/:id/review"
                element={
                  <ProtectedRoute allowedRoles={["teacher", "admin"]}>
                    <LectureReview />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/teacher/quizzes"
                element={
                  <ProtectedRoute allowedRoles={["teacher", "admin"]}>
                    <QuizManager />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/teacher/analytics"
                element={
                  <ProtectedRoute allowedRoles={["teacher", "admin"]}>
                    <TeacherAnalytics />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/teacher/settings"
                element={
                  <ProtectedRoute allowedRoles={["teacher", "admin"]}>
                    <TeacherSettings />
                  </ProtectedRoute>
                }
              />

              {/* Student Routes */}
              <Route
                path="/student"
                element={
                  <ProtectedRoute allowedRoles={["student"]}>
                    <StudentDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/student/courses"
                element={
                  <ProtectedRoute allowedRoles={["student", "teacher", "admin"]}>
                    <StudentCourses />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/student/courses/:id"
                element={
                  <ProtectedRoute allowedRoles={["student", "teacher", "admin"]}>
                    <StudentCourseWorkspace />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/student/lectures/:id"
                element={
                  <ProtectedRoute allowedRoles={["student", "teacher", "admin"]}>
                    <LectureViewer />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/student/lectures/:id/quiz"
                element={
                  <ProtectedRoute allowedRoles={["student", "teacher", "admin"]}>
                    <QuizExperience />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/student/search"
                element={
                  <ProtectedRoute allowedRoles={["student", "teacher", "admin"]}>
                    <GlobalSearch />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/student/revision"
                element={
                  <ProtectedRoute allowedRoles={["student", "teacher", "admin"]}>
                    <RevisionPlan />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/student/settings"
                element={
                  <ProtectedRoute allowedRoles={["student"]}>
                    <StudentSettings />
                  </ProtectedRoute>
                }
              />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ErrorBoundary>
        </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
