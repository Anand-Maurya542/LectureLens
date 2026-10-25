import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";

// Auth Pages
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";

// Teacher Pages
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import CourseManager from "./pages/teacher/CourseManager";
import AddLecture from "./pages/teacher/AddLecture";
import LectureReview from "./pages/teacher/LectureReview";
import QuizManager from "./pages/teacher/QuizManager";
import TeacherAnalytics from "./pages/teacher/TeacherAnalytics";

// Student Pages
import StudentDashboard from "./pages/student/StudentDashboard";
import LectureViewer from "./pages/student/LectureViewer";
import GlobalSearch from "./pages/student/GlobalSearch";
import QuizExperience from "./pages/student/QuizExperience";
import RevisionPlan from "./pages/student/RevisionPlan";

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
  if (user.role === "teacher" || user.role === "admin") {
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
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/" element={<RootRedirect />} />

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

              {/* Student Routes */}
              <Route
                path="/student"
                element={
                  <ProtectedRoute allowedRoles={["student", "teacher", "admin"]}>
                    <StudentDashboard />
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

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
