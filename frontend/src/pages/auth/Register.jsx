import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { UserPlus, User, Mail, Key, Shield, ShieldAlert } from "lucide-react";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("student");
  const [teacherCode, setTeacherCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const user = await register({
        name,
        email,
        password,
        role,
        teacher_invite_code: role === "teacher" ? teacherCode : undefined,
      });

      if (user.role === "teacher" || user.role === "admin") {
        navigate("/teacher", { replace: true });
      } else {
        navigate("/student", { replace: true });
      }
    } catch (err) {
      setError(err.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">🎓</div>
          <h2>Join LectureLens</h2>
          <p>Start turning your lectures into searchable, personalized learning</p>
        </div>

        {error && (
          <div className="alert-error">
            <ShieldAlert size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="name">Full Name</label>
            <div className="input-with-icon">
              <User size={18} className="input-icon" />
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Dr. Jane Doe or Alex Smith"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="reg-email">Email Address</label>
            <div className="input-with-icon">
              <Mail size={18} className="input-icon" />
              <input
                id="reg-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex@university.edu"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="reg-password">Password (min 6 characters)</label>
            <div className="input-with-icon">
              <Key size={18} className="input-icon" />
              <input
                id="reg-password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Account Role</label>
            <div className="role-selector-cards">
              <label className={`role-card ${role === "student" ? "selected" : ""}`}>
                <input
                  type="radio"
                  name="role"
                  value="student"
                  checked={role === "student"}
                  onChange={() => setRole("student")}
                />
                <div>
                  <strong>Student</strong>
                  <span>Enroll in courses, search lectures, ask grounded questions & take quizzes</span>
                </div>
              </label>

              <label className={`role-card ${role === "teacher" ? "selected" : ""}`}>
                <input
                  type="radio"
                  name="role"
                  value="teacher"
                  checked={role === "teacher"}
                  onChange={() => setRole("teacher")}
                />
                <div>
                  <strong>Teacher / Instructor</strong>
                  <span>Create courses, upload lectures, edit transcripts, review quizzes</span>
                </div>
              </label>
            </div>
          </div>

          {role === "teacher" && (
            <div className="form-group highlight-box">
              <label htmlFor="teacher-code">
                <Shield size={16} /> Teacher Authorization Invite Code
              </label>
              <input
                id="teacher-code"
                type="password"
                required
                value={teacherCode}
                onChange={(e) => setTeacherCode(e.target.value)}
                placeholder="Enter teacher authorization code"
              />
              <small className="help-text">
                Demo code: <code>TEACHER_SECRET_2026</code> (Secures against arbitrary instructor escalation)
              </small>
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            <UserPlus size={18} />
            {loading ? "Creating Account..." : "Create Account"}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

