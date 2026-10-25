import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { LogIn, Key, Mail, ShieldAlert, Sparkles } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const user = await login(email, password);
      if (from) {
        navigate(from, { replace: true });
      } else if (user.role === "teacher" || user.role === "admin") {
        navigate("/teacher", { replace: true });
      } else {
        navigate("/student", { replace: true });
      }
    } catch (err) {
      setError(err.message || "Failed to sign in. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (demoEmail, demoPassword) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">🎓</div>
          <h2>Sign in to LectureLens</h2>
          <p>Intelligent Lecture Transcription, Atlas Search & Learning</p>
        </div>

        {error && (
          <div className="alert-error">
            <ShieldAlert size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <div className="input-with-icon">
              <Mail size={18} className="input-icon" />
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@university.edu"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="input-with-icon">
              <Key size={18} className="input-icon" />
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            <LogIn size={18} />
            {loading ? "Authenticating..." : "Sign In"}
          </button>
        </form>

        {/* Demo Fast Login Pills */}
        <div className="demo-accounts-section">
          <div className="demo-title">
            <Sparkles size={14} />
            <span>Quick Demo Accounts</span>
          </div>
          <div className="demo-buttons">
            <button
              type="button"
              className="btn-demo teacher"
              onClick={() => handleQuickLogin("teacher@lecturelens.edu", "TeacherPass123!")}
            >
              <strong>Prof. Sharma</strong> (Instructor)
            </button>
            <button
              type="button"
              className="btn-demo student"
              onClick={() => handleQuickLogin("student@lecturelens.edu", "StudentPass123!")}
            >
              <strong>Priya Verma</strong> (Student)
            </button>
          </div>
        </div>

        <div className="auth-footer">
          <p>
            Need a student account? <Link to="/register">Create one here</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

