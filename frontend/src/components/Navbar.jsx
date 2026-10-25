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
} from "lucide-react";

export default function Navbar() {
  const { user, logout, isTeacher } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) return null;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isActive = (path) => location.pathname === path;

  return (
    <header className="navbar-container">
      <div className="navbar-inner">
        {/* Brand */}
        <Link to={isTeacher ? "/teacher" : "/student"} className="navbar-brand">
          <img
            src="/lecturelens.svg"
            alt="LectureLens Logo"
            style={{ width: "32px", height: "32px", borderRadius: "8px", objectFit: "contain" }}
          />
          <div>
            <span className="brand-title">LectureLens</span>
            <span className={`role-badge ${isTeacher ? "role-teacher" : "role-student"}`}>
              {isTeacher ? "Instructor Portal" : "Student Portal"}
            </span>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="navbar-nav">
          {isTeacher ? (
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
                to="/student/search"
                className={`nav-link ${isActive("/student/search") ? "active" : ""}`}
              >
                <Search size={18} />
                Atlas Search & Q&A
              </Link>
              <Link
                to="/student/revision"
                className={`nav-link ${isActive("/student/revision") ? "active" : ""}`}
              >
                <Brain size={18} />
                Smart Revision
              </Link>
            </>
          )}
        </nav>

        {/* User profile & actions */}
        <div className="navbar-actions">
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

