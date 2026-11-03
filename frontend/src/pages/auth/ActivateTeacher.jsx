import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../api/client";
import {
  GraduationCap,
  Key,
  ShieldCheck,
  ShieldAlert,
  BookOpen,
  Building,
  UserCheck,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

export default function ActivateTeacher() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [invitationData, setInvitationData] = useState(null);
  const [verifyError, setVerifyError] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");
  const [activatedSuccess, setActivatedSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setVerifyError("No activation token was provided. Please use the complete invitation link provided by your platform administrator.");
      return;
    }

    const verifyToken = async () => {
      try {
        setLoading(true);
        setVerifyError("");
        const res = await api.verifyTeacherInvitation(token);
        setInvitationData(res);
      } catch (err) {
        setVerifyError(
          err.message ||
            "This invitation link is invalid or has expired (invitations are valid for 7 days). Please contact your administrator for a new invitation."
        );
      } finally {
        setLoading(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setActionError("");

    if (password.length < 6) {
      setActionError("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setActionError("Passwords do not match. Please verify both fields.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.activateTeacherAccount({
        token,
        password,
      });

      // Store tokens and user in localStorage
      if (res?.access_token) {
        localStorage.setItem("lecturelens_token", res.access_token);
      }
      if (res?.user) {
        localStorage.setItem("lecturelens_user", JSON.stringify(res.user));
      }
      // Broadcast login event to sync auth context
      window.dispatchEvent(new Event("auth:login"));

      setActivatedSuccess(true);
      setTimeout(() => {
        navigate("/teacher", { replace: true });
      }, 1800);
    } catch (err) {
      setActionError(err.message || "Failed to activate account. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: "560px", width: "100%" }}>
        <div className="auth-header">
          <div className="auth-logo" style={{ background: "rgba(99, 102, 241, 0.12)", color: "#6366f1" }}>
            <GraduationCap size={32} />
          </div>
          <h2>Activate Faculty Account</h2>
          <p>Set up your password and access your assigned courses on LectureLens</p>
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div className="spinner" style={{ margin: "0 auto 16px" }} />
            <p style={{ color: "var(--text-muted, #64748b)" }}>Verifying invitation token...</p>
          </div>
        )}

        {!loading && verifyError && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div className="alert-error" style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
              <ShieldAlert size={20} style={{ flexShrink: 0, marginTop: "2px" }} />
              <div>
                <strong>Activation Failed</strong>
                <p style={{ margin: "4px 0 0", fontSize: "0.88rem" }}>{verifyError}</p>
              </div>
            </div>
            <div style={{ textAlign: "center", marginTop: "12px" }}>
              <Link to="/login" className="btn-secondary" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                Return to Login
              </Link>
            </div>
          </div>
        )}

        {!loading && !verifyError && activatedSuccess && (
          <div style={{ textAlign: "center", padding: "30px 20px" }}>
            <CheckCircle2 size={54} color="#10b981" style={{ margin: "0 auto 16px" }} />
            <h3 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: "8px" }}>Account Activated Successfully!</h3>
            <p style={{ color: "var(--text-muted, #64748b)", marginBottom: "20px" }}>
              Welcome to LectureLens, <strong>{invitationData?.name}</strong>. Redirecting you to your Instructor Studio...
            </p>
            <Link to="/teacher" className="btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
              Go to Instructor Studio <ArrowRight size={16} />
            </Link>
          </div>
        )}

        {!loading && !verifyError && !activatedSuccess && invitationData && (
          <div>
            {/* Teacher details box */}
            <div
              style={{
                background: "rgba(99, 102, 241, 0.05)",
                border: "1px solid rgba(99, 102, 241, 0.18)",
                borderRadius: "10px",
                padding: "16px",
                marginBottom: "20px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "50%",
                    background: "#6366f1",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: "1.1rem",
                  }}
                >
                  {invitationData.name?.charAt(0).toUpperCase() || "T"}
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700 }}>{invitationData.name}</h4>
                  <span style={{ fontSize: "0.85rem", color: "var(--text-muted, #64748b)" }}>{invitationData.email}</span>
                </div>
              </div>

              {(invitationData.department || invitationData.institution) && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", color: "var(--text-secondary, #475569)", marginBottom: "8px" }}>
                  <Building size={14} />
                  <span>
                    {[invitationData.department, invitationData.institution].filter(Boolean).join(" • ")}
                  </span>
                </div>
              )}

              {/* Assigned courses */}
              <div style={{ marginTop: "10px" }}>
                <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted, #64748b)", marginBottom: "6px" }}>
                  ASSIGNED TEACHING COURSES ({invitationData.assigned_courses?.length || 0}):
                </div>
                {invitationData.assigned_courses?.length > 0 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {invitationData.assigned_courses.map((c) => (
                      <span
                        key={c.id || c.code}
                        style={{
                          background: "#fff",
                          border: "1px solid #e2e8f0",
                          borderRadius: "6px",
                          padding: "4px 8px",
                          fontSize: "0.8rem",
                          fontWeight: 500,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <BookOpen size={12} color="#6366f1" />
                        <strong>{c.code}:</strong> {c.title}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span style={{ fontSize: "0.82rem", color: "var(--text-muted, #64748b)", fontStyle: "italic" }}>
                    No initial courses assigned. Your platform admin will link your courses.
                  </span>
                )}
              </div>
            </div>

            {actionError && (
              <div className="alert-error" style={{ marginBottom: "16px" }}>
                <ShieldAlert size={18} />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-group">
                <label htmlFor="password">Set Secure Password</label>
                <div className="input-with-icon">
                  <Key size={18} className="input-icon" />
                  <input
                    id="password"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <div className="input-with-icon">
                  <Key size={18} className="input-icon" />
                  <input
                    id="confirmPassword"
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn-primary w-full"
                style={{ marginTop: "10px" }}
              >
                <ShieldCheck size={18} />
                {submitting ? "Activating Faculty Account..." : "Activate Account & Sign In"}
              </button>
            </form>

            <div className="auth-footer" style={{ textAlign: "center", marginTop: "18px" }}>
              <p style={{ fontSize: "0.84rem", color: "var(--text-muted, #64748b)" }}>
                Already set your password? <Link to="/login">Sign in directly</Link>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

