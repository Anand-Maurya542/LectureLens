import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { UserPlus, User, Mail, Key, ShieldAlert, GraduationCap, ShieldCheck } from "lucide-react";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        role: "student",
      });

      if (user.role === "admin") {
        navigate("/admin", { replace: true });
      } else if (user.role === "teacher") {
        navigate("/teacher", { replace: true });
      } else {
        navigate("/student", { replace: true });
      }
    } catch (err) {
      setError(err.message || "Registration failed. Please try again.");
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
          <p>Create a Student account to access courses, grounded AI search & interactive quizzes</p>
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
                placeholder="Alex Smith"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="reg-email">Student Email Address</label>
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

          <button type="submit" disabled={loading} className="btn-primary w-full">
            <UserPlus size={18} />
            {loading ? "Creating Student Account..." : "Create Student Account"}
          </button>
        </form>

        <div className="auth-footer" style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "16px" }}>
          <p>
            Already have an account? <Link to="/login">Sign in</Link>
          </p>

          <div
            style={{
              padding: "10px 14px",
              background: "rgba(99, 102, 241, 0.05)",
              border: "1px solid rgba(99, 102, 241, 0.15)",
              borderRadius: "8px",
              fontSize: "0.82rem",
              color: "var(--text-muted, #64748b)",
              lineHeight: "1.4",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <ShieldCheck size={16} style={{ color: "#6366f1", flexShrink: 0 }} />
            <span>
              <strong>Faculty / Teachers:</strong> Instructor accounts are created exclusively by Platform Administrators. Contact your institution administrator for access credentials.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
