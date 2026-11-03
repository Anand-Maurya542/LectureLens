import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import {
  User,
  Shield,
  BookOpen,
  Bell,
  Trash2,
  Save,
  CheckCircle2,
  AlertCircle,
  Lock,
  Globe,
  Clock,
  LogOut,
  X,
  AlertTriangle,
} from "lucide-react";

export default function StudentSettings() {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("profile"); // profile | security | learning | notifications | account
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

  // Learning Preferences Form
  const [preferredLanguage, setPreferredLanguage] = useState("en");
  const [studyGoalHours, setStudyGoalHours] = useState(5);
  const [revisionFrequency, setRevisionFrequency] = useState("daily");
  const [progressVisibility, setProgressVisibility] = useState("enrolled_courses");

  // Notification Settings Form
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [lecturePublished, setLecturePublished] = useState(true);
  const [quizReminders, setQuizReminders] = useState(true);
  const [revisionReminders, setRevisionReminders] = useState(true);

  // Deletion Modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        if (user) {
          setName(user.name || "");
          setBio(user.bio || "");
        }
        const res = await api.getSettings();
        if (res.learning_preferences) {
          setPreferredLanguage(res.learning_preferences.preferred_language || "en");
          setStudyGoalHours(res.learning_preferences.study_goal_hours || 5);
          setRevisionFrequency(res.learning_preferences.revision_frequency || "daily");
          setProgressVisibility(res.learning_preferences.progress_visibility || "enrolled_courses");
        }
        if (res.notification_settings) {
          setEmailNotifications(res.notification_settings.email_notifications ?? true);
          setLecturePublished(res.notification_settings.lecture_published ?? true);
          setQuizReminders(res.notification_settings.quiz_reminders ?? true);
          setRevisionReminders(res.notification_settings.revision_reminders ?? true);
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
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

  // 1. Profile Update
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
      showFeedback("Profile details saved successfully.");
    } catch (err) {
      showFeedback(err.message || "Failed to update profile", true);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelProfile = () => {
    setName(user?.name || "");
    setBio(user?.bio || "");
    setIsEditingProfile(false);
  };

  // 2. Password Change
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword) {
      showFeedback("Please enter your current password", true);
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

  // 3. Learning Preferences Update
  const handleSaveLearningPreferences = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateSettings({
        learning_preferences: {
          preferred_language: preferredLanguage,
          study_goal_hours: Number(studyGoalHours),
          revision_frequency: revisionFrequency,
          progress_visibility: progressVisibility,
        },
      });
      showFeedback("Learning preferences saved to your account.");
    } catch (err) {
      showFeedback(err.message || "Failed to save learning preferences", true);
    } finally {
      setSaving(false);
    }
  };

  // 4. Notification Settings Update
  const handleSaveNotifications = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateSettings({
        notification_settings: {
          email_notifications: emailNotifications,
          lecture_published: lecturePublished,
          quiz_reminders: quizReminders,
          revision_reminders: revisionReminders,
        },
      });
      showFeedback("Notification settings updated.");
    } catch (err) {
      showFeedback(err.message || "Failed to save notification settings", true);
    } finally {
      setSaving(false);
    }
  };

  // 5. Account Deletion
  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      showFeedback("Please enter your password to confirm deletion", true);
      return;
    }
    setDeleting(true);
    try {
      await api.deleteAccount({ password: deletePassword });
      logout();
      navigate("/login");
    } catch (err) {
      showFeedback(err.message || "Account deletion failed", true);
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" /> Loading preferences...
      </div>
    );
  }

  return (
    <div className="dashboard-page max-w-4xl">
      <div className="dashboard-header">
        <div>
          <h1>Student Settings</h1>
          <p>Customize your profile, account security, learning preferences & notifications.</p>
        </div>
      </div>

      {message && <div className="alert-success mb-4">{message}</div>}
      {error && <div className="alert-error mb-4">{error}</div>}

      {/* Tabs */}
      <div className="admin-nav-tabs">
        <button
          onClick={() => setActiveTab("profile")}
          className={`tab-btn ${activeTab === "profile" ? "active" : ""}`}
        >
          <User size={17} />
          Profile
        </button>
        <button
          onClick={() => setActiveTab("security")}
          className={`tab-btn ${activeTab === "security" ? "active" : ""}`}
        >
          <Shield size={17} />
          Account Security
        </button>
        <button
          onClick={() => setActiveTab("learning")}
          className={`tab-btn ${activeTab === "learning" ? "active" : ""}`}
        >
          <BookOpen size={17} />
          Learning Preferences
        </button>
        <button
          onClick={() => setActiveTab("notifications")}
          className={`tab-btn ${activeTab === "notifications" ? "active" : ""}`}
        >
          <Bell size={17} />
          Notifications
        </button>
        <button
          onClick={() => setActiveTab("account")}
          className={`tab-btn ${activeTab === "account" ? "active" : ""}`}
        >
          <Lock size={17} />
          Account Management
        </button>
      </div>

      {/* TAB 1: PROFILE */}
      {activeTab === "profile" && (
        <div className="settings-card">
          <div className="section-header">
            <div>
              <h3>Personal Profile</h3>
              <p className="text-muted text-sm">Your name and bio as shown across course discussions.</p>
            </div>
            {!isEditingProfile && (
              <button onClick={() => setIsEditingProfile(true)} className="btn-secondary">
                Edit Profile
              </button>
            )}
          </div>

          <form onSubmit={handleSaveProfile}>
            <div className="form-group mb-4">
              <label>Full Name:</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!isEditingProfile}
                required
              />
            </div>

            <div className="form-group mb-4">
              <label>Email Address:</label>
              <input type="email" value={user?.email || ""} disabled className="bg-slate-100" />
              <small className="help-text">Email address is your primary login identifier.</small>
            </div>

            <div className="form-group mb-4">
              <label>Bio / Academic Focus:</label>
              <textarea
                rows={3}
                placeholder="e.g. Undergraduate CS student focusing on NLP and Machine Learning..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                disabled={!isEditingProfile}
              />
            </div>

            {isEditingProfile && (
              <div className="flex gap-3 justify-end mt-4">
                <button type="button" onClick={handleCancelProfile} className="btn-secondary">
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

      {/* TAB 2: ACCOUNT SECURITY */}
      {activeTab === "security" && (
        <div className="settings-card">
          <div className="section-header mb-4">
            <div>
              <h3>Change Password</h3>
              <p className="text-muted text-sm">
                Ensure your account uses a strong password with at least 6 characters.
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

      {/* TAB 3: LEARNING PREFERENCES */}
      {activeTab === "learning" && (
        <div className="settings-card">
          <div className="section-header mb-4">
            <div>
              <h3>Learning & Study Preferences</h3>
              <p className="text-muted text-sm">
                Tailor language and automated revision recommendations to your pace.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveLearningPreferences}>
            <div className="form-group mb-4">
              <label>Preferred Lecture Language:</label>
              <select
                value={preferredLanguage}
                onChange={(e) => setPreferredLanguage(e.target.value)}
              >
                <option value="en">English (Default)</option>
                <option value="hi">Hindi (हिन्दी)</option>
                <option value="bilingual">Bilingual / Hinglish</option>
              </select>
              <small className="help-text">
                Used to prioritize transcript matching and summary readability.
              </small>
            </div>

            <div className="form-group mb-4">
              <label>Weekly Study Goal (Hours):</label>
              <input
                type="number"
                min="1"
                max="40"
                value={studyGoalHours}
                onChange={(e) => setStudyGoalHours(e.target.value)}
              />
            </div>

            <div className="form-group mb-4">
              <label>Smart Revision Frequency:</label>
              <select
                value={revisionFrequency}
                onChange={(e) => setRevisionFrequency(e.target.value)}
              >
                <option value="daily">Daily Spaced Repetition</option>
                <option value="weekly">Weekly Summary Review</option>
                <option value="before_exam">Exam Sprint Only</option>
              </select>
            </div>

            <div className="form-group mb-4">
              <label>Learning Progress Visibility:</label>
              <select
                value={progressVisibility}
                onChange={(e) => setProgressVisibility(e.target.value)}
              >
                <option value="enrolled_courses">Visible only to course instructors</option>
                <option value="private">Strictly Private</option>
              </select>
            </div>

            <div className="flex justify-end mt-4">
              <button type="submit" disabled={saving} className="btn-primary">
                <Save size={16} />
                {saving ? "Saving..." : "Save Learning Preferences"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 4: NOTIFICATIONS */}
      {activeTab === "notifications" && (
        <div className="settings-card">
          <div className="section-header mb-4">
            <div>
              <h3>Notification Preferences</h3>
              <p className="text-muted text-sm">Choose what updates and alerts you receive.</p>
            </div>
          </div>

          <form onSubmit={handleSaveNotifications}>
            <div className="toggle-list">
              <label className="toggle-item">
                <input
                  type="checkbox"
                  checked={emailNotifications}
                  onChange={(e) => setEmailNotifications(e.target.checked)}
                />
                <div>
                  <div className="font-semibold">Email Notifications</div>
                  <div className="text-muted text-xs">Receive course announcements via email</div>
                </div>
              </label>

              <label className="toggle-item">
                <input
                  type="checkbox"
                  checked={lecturePublished}
                  onChange={(e) => setLecturePublished(e.target.checked)}
                />
                <div>
                  <div className="font-semibold">Lecture Publication Alerts</div>
                  <div className="text-muted text-xs">
                    Notify when an instructor publishes a new lecture
                  </div>
                </div>
              </label>

              <label className="toggle-item">
                <input
                  type="checkbox"
                  checked={quizReminders}
                  onChange={(e) => setQuizReminders(e.target.checked)}
                />
                <div>
                  <div className="font-semibold">Quiz & Assessment Reminders</div>
                  <div className="text-muted text-xs">Alerts when new quizzes are approved</div>
                </div>
              </label>

              <label className="toggle-item">
                <input
                  type="checkbox"
                  checked={revisionReminders}
                  onChange={(e) => setRevisionReminders(e.target.checked)}
                />
                <div>
                  <div className="font-semibold">Spaced Repetition Review Alerts</div>
                  <div className="text-muted text-xs">
                    Periodic reminders for weak topics based on quiz attempts
                  </div>
                </div>
              </label>
            </div>

            <div className="flex justify-end mt-6">
              <button type="submit" disabled={saving} className="btn-primary">
                <Save size={16} />
                {saving ? "Saving..." : "Save Notifications"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 5: ACCOUNT MANAGEMENT */}
      {activeTab === "account" && (
        <div className="settings-card">
          <div className="section-header mb-4">
            <div>
              <h3>Account Management</h3>
              <p className="text-muted text-sm">Student identity & session control.</p>
            </div>
          </div>

          <div className="info-list mb-6">
            <div className="info-item">
              <span className="info-label">Account ID</span>
              <code>{user?.id}</code>
            </div>
            <div className="info-item">
              <span className="info-label">Role</span>
              <span className="role-badge role-student">Student</span>
            </div>
            <div className="info-item">
              <span className="info-label">Member Since</span>
              <span>{user?.created_at ? new Date(user.created_at).toLocaleDateString() : "Active"}</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50 rounded mb-6 border">
            <div>
              <div className="font-semibold text-slate-800">Sign Out of Session</div>
              <div className="text-muted text-xs">Safely terminate this device's token session</div>
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

          <div className="p-4 bg-red-50 rounded border border-red-200">
            <h4 className="text-danger font-semibold mb-1">Delete Account</h4>
            <p className="text-sm text-red-700 mb-3">
              Permanently delete your student account, course enrollments, and quiz attempts. This action is irreversible.
            </p>
            <button onClick={() => setShowDeleteModal(true)} className="btn-danger">
              <Trash2 size={16} />
              Request Permanent Deletion
            </button>
          </div>
        </div>
      )}

      {/* DELETE ACCOUNT MODAL */}
      {showDeleteModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="text-danger flex items-center gap-2">
                <AlertTriangle size={20} /> Permanent Account Deletion
              </h3>
              <button onClick={() => setShowDeleteModal(false)} className="btn-close">
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to permanently delete your student account? All enrolled courses, quiz grades, and spaced repetition history will be deleted immediately.
              </p>
              <div className="form-group mt-4">
                <label>Enter your password to confirm:</label>
                <input
                  type="password"
                  placeholder="Your account password..."
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowDeleteModal(false)} className="btn-secondary">
                Cancel
              </button>
              <button onClick={handleDeleteAccount} disabled={deleting} className="btn-danger">
                {deleting ? "Deleting..." : "Permanently Delete Account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

