import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  BookOpen,
  GraduationCap,
  LayoutDashboard,
  Search,
  CheckSquare,
  BarChart3,
  PlusCircle,
  LogOut,
  Brain,
  Shield,
  Settings,
} from "lucide-react";

export default function Navbar() {
  const { user, logout, isAdmin, isTeacher, isStudent } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) return null;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isActive = (path) => location.pathname === path;

  // Determine root destination and badge
  let rootPath = "/student";
  let badgeLabel = "Student Portal";
  let badgeClass = "role-student";

  if (isAdmin) {
    rootPath = "/admin";
    badgeLabel = "Admin Portal";
    badgeClass = "role-admin";
  } else if (isTeacher) {
    rootPath = "/teacher";
    badgeLabel = "Teacher Portal";
    badgeClass = "role-teacher";
  }

  const settingsPath = isStudent ? "/student/settings" : "/teacher/settings";

  return (
    <header className="navbar-container">
      <div className="navbar-inner">
        {/* Brand */}
        <Link to={rootPath} className="navbar-brand">
          <img
            src="/lecturelens.svg"
            alt="LectureLens Logo"
            style={{ width: "32px", height: "32px", borderRadius: "8px", objectFit: "contain" }}
          />
          <div>
            <span className="brand-title">LectureLens</span>
            <span className={`role-badge ${badgeClass}`}>{badgeLabel}</span>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="navbar-nav">
          {isAdmin ? (
            <>
              <Link
                to="/admin"
                className={`nav-link ${isActive("/admin") ? "active" : ""}`}
              >
                <Shield size={18} />
                Admin Dashboard
              </Link>
              <Link
                to="/teacher"
                className={`nav-link ${isActive("/teacher") ? "active" : ""}`}
              >
                <LayoutDashboard size={18} />
                Teacher Workspace
              </Link>
              <Link
                to="/teacher/courses"
                className={`nav-link ${isActive("/teacher/courses") ? "active" : ""}`}
              >
                <BookOpen size={18} />
                Courses
              </Link>
              <Link
                to="/teacher/analytics"
                className={`nav-link ${isActive("/teacher/analytics") ? "active" : ""}`}
              >
                <BarChart3 size={18} />
                Analytics
              </Link>
            </>
          ) : isTeacher ? (
            <>
              <Link
                to="/teacher"
                className={`nav-link ${isActive("/teacher") ? "active" : ""}`}
              >
                <LayoutDashboard size={18} />
                Overview
              </Link>
              <Link
                to="/teacher/courses"
                className={`nav-link ${isActive("/teacher/courses") ? "active" : ""}`}
              >
                <BookOpen size={18} />
                Courses
              </Link>
              <Link
                to="/teacher/add-lecture"
                className={`nav-link ${isActive("/teacher/add-lecture") ? "active" : ""}`}
              >
                <PlusCircle size={18} />
                Add Lecture
              </Link>
              <Link
                to="/teacher/quizzes"
                className={`nav-link ${isActive("/teacher/quizzes") ? "active" : ""}`}
              >
                <CheckSquare size={18} />
                Quiz Review
              </Link>
              <Link
                to="/teacher/analytics"
                className={`nav-link ${isActive("/teacher/analytics") ? "active" : ""}`}
              >
                <BarChart3 size={18} />
                Analytics
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/student"
                className={`nav-link ${isActive("/student") ? "active" : ""}`}
              >
                <GraduationCap size={18} />
                My Courses
              </Link>
              <Link
                to="/student/courses"
                className={`nav-link ${isActive("/student/courses") ? "active" : ""}`}
              >
                <BookOpen size={18} />
                Explore Courses
              </Link>
              <Link
                to="/student/search"
                className={`nav-link ${isActive("/student/search") ? "active" : ""}`}
              >
                <Search size={18} />
                Search & Ask Questions
              </Link>
              <Link
                to="/student/revision"
                className={`nav-link ${isActive("/student/revision") ? "active" : ""}`}
              >
                <Brain size={18} />
                My Study Plan
              </Link>
            </>
          )}
        </nav>

        {/* User profile & actions */}
        <div className="navbar-actions">
          <Link
            to={settingsPath}
            className={`btn-icon ${isActive(settingsPath) ? "active-icon" : ""}`}
            title="Settings & Profile"
          >
            <Settings size={18} />
          </Link>

          <div className="user-profile-chip">
            <span className="user-name">{user.name}</span>
            <span className="user-email">{user.email}</span>
          </div>

          <button onClick={handleLogout} className="btn-logout" title="Sign out">
            <LogOut size={17} />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
