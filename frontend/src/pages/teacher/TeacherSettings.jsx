import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import {
  User,
  Shield,
  BookOpen,
  Video,
  Save,
  CheckCircle2,
  AlertCircle,
  Lock,
  LogOut,
} from "lucide-react";

export default function TeacherSettings() {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("profile"); // profile | security | account
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Profile Form
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // Security Form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Stats
  const [coursesCount, setCoursesCount] = useState(0);
  const [lecturesCount, setLecturesCount] = useState(0);

  useEffect(() => {
    async function loadData() {
      try {
        if (user) {
          setName(user.name || "");
          setBio(user.bio || "");
        }
        const [cData, lData] = await Promise.all([
          api.getCourses().catch(() => []),
          api.getLectures().catch(() => []),
        ]);
        setCoursesCount(cData?.length || 0);
        setLecturesCount(lData?.length || 0);
      } catch (err) {
        console.error("Failed to load teacher settings:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user]);

  const showFeedback = (msg, isError = false) => {
    if (isError) {
      setError(msg);
      setMessage("");
    } else {
      setMessage(msg);
      setError("");
    }
    setTimeout(() => {
      setMessage("");
      setError("");
    }, 4000);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      showFeedback("Name cannot be empty", true);
      return;
    }
    setSaving(true);
    try {
      await api.updateProfile({ name: name.trim(), bio: bio.trim() });
      await refreshUser();
      setIsEditingProfile(false);
      showFeedback("Instructor profile updated successfully.");
    } catch (err) {
      showFeedback(err.message || "Failed to update profile", true);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword) {
      showFeedback("Please enter current password", true);
      return;
    }
    if (newPassword.length < 6) {
      showFeedback("New password must be at least 6 characters long", true);
      return;
    }
    if (newPassword !== confirmPassword) {
      showFeedback("New password and confirmation do not match", true);
      return;
    }

    setSaving(true);
    try {
      await api.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showFeedback("Password changed successfully.");
    } catch (err) {
      showFeedback(err.message || "Failed to change password", true);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" /> Loading instructor profile...
      </div>
    );
  }

  return (
    <div className="dashboard-page max-w-4xl">
      <div className="dashboard-header">
        <div>
          <h1>Instructor Profile & Settings</h1>
          <p>Manage personal faculty credentials, department profile, and security preferences.</p>
        </div>
      </div>

      {message && <div className="alert-success mb-4">{message}</div>}
      {error && <div className="alert-error mb-4">{error}</div>}

      <div className="admin-nav-tabs">
        <button
          onClick={() => setActiveTab("profile")}
          className={`tab-btn ${activeTab === "profile" ? "active" : ""}`}
        >
          <User size={17} />
          Profile Details
        </button>
        <button
          onClick={() => setActiveTab("security")}
          className={`tab-btn ${activeTab === "security" ? "active" : ""}`}
        >
          <Shield size={17} />
          Account Security
        </button>
        <button
          onClick={() => setActiveTab("account")}
          className={`tab-btn ${activeTab === "account" ? "active" : ""}`}
        >
          <Lock size={17} />
          Account & Role
        </button>
      </div>

      {/* TAB 1: PROFILE */}
      {activeTab === "profile" && (
        <div className="settings-card">
          <div className="section-header">
            <div>
              <h3>Faculty Profile</h3>
              <p className="text-muted text-sm">Displayed to students across courses you instruct.</p>
            </div>
            {!isEditingProfile && (
              <button onClick={() => setIsEditingProfile(true)} className="btn-secondary">
                Edit Profile
              </button>
            )}
          </div>

          <form onSubmit={handleSaveProfile}>
            <div className="form-group mb-4">
              <label>Instructor Name:</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!isEditingProfile}
                required
              />
            </div>

            <div className="form-group mb-4">
              <label>Official Email:</label>
              <input type="email" value={user?.email || ""} disabled className="bg-slate-100" />
            </div>

            <div className="form-group mb-4">
              <label>Department / Academic Biography:</label>
              <textarea
                rows={3}
                placeholder="e.g. Professor of Computer Science, specializing in Deep Learning and Natural Language Processing..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                disabled={!isEditingProfile}
              />
            </div>

            {isEditingProfile && (
              <div className="flex gap-3 justify-end mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setName(user?.name || "");
                    setBio(user?.bio || "");
                    setIsEditingProfile(false);
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary">
                  <Save size={16} />
                  {saving ? "Saving..." : "Save Profile"}
                </button>
              </div>
            )}
          </form>
        </div>
      )}

      {/* TAB 2: SECURITY */}
      {activeTab === "security" && (
        <div className="settings-card">
          <div className="section-header mb-4">
            <div>
              <h3>Change Password</h3>
              <p className="text-muted text-sm">
                Ensure your instructor account is protected by a strong passphrase.
              </p>
            </div>
          </div>

          <form onSubmit={handleChangePassword}>
            <div className="form-group mb-4">
              <label>Current Password:</label>
              <input
                type="password"
                placeholder="Enter current password..."
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>

            <div className="form-group mb-4">
              <label>New Password:</label>
              <input
                type="password"
                placeholder="Enter new password (min 6 chars)..."
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>

            <div className="form-group mb-4">
              <label>Confirm New Password:</label>
              <input
                type="password"
                placeholder="Confirm new password..."
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <div className="flex justify-end mt-4">
              <button type="submit" disabled={saving} className="btn-primary">
                <Shield size={16} />
                {saving ? "Updating..." : "Update Password"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: ACCOUNT & ROLE */}
      {activeTab === "account" && (
        <div className="settings-card">
          <div className="section-header mb-4">
            <div>
              <h3>Instructor Identity & Platform Role</h3>
              <p className="text-muted text-sm">Verified credentials and ownership scope.</p>
            </div>
          </div>

          <div className="info-list mb-6">
            <div className="info-item">
              <span className="info-label">Account ID</span>
              <code>{user?.id}</code>
            </div>
            <div className="info-item">
              <span className="info-label">Platform Role</span>
              <span className="role-badge role-teacher">{user?.role?.toUpperCase()}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Created Courses</span>
              <strong>{coursesCount} Active Courses</strong>
            </div>
            <div className="info-item">
              <span className="info-label">Uploaded Lectures</span>
              <strong>{lecturesCount} Ingested Lectures</strong>
            </div>
            <div className="info-item">
              <span className="info-label">Member Since</span>
              <span>{user?.created_at ? new Date(user.created_at).toLocaleDateString() : "Active"}</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50 rounded border">
            <div>
              <div className="font-semibold text-slate-800">Sign Out of Session</div>
              <div className="text-muted text-xs">Safely terminate instructor session</div>
            </div>
            <button
              onClick={() => {
                logout();
                navigate("/login");
              }}
              className="btn-secondary"
            >
              <LogOut size={16} />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

