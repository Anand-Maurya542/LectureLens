import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { StatusBadge } from "../../components/StatusBadge";
import {
  Users,
  GraduationCap,
  BookOpen,
  Video,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Server,
  Activity,
  Search,
  Filter,
  Trash2,
  Shield,
  UserCheck,
  UserX,
  ExternalLink,
  RefreshCw,
  Sliders,
  Layers,
  HelpCircle,
  X,
  AlertCircle,
  Database,
  Cpu,
  XCircle,
  FileText,
  Building2,
  Mail,
  Plus,
  Edit,
  UserMinus,
  Check,
  CheckSquare,
  UserPlus,
  Copy,
  Phone,
  Key,
  Share2,
} from "lucide-react";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("overview"); // overview | users | courses | enrollments | teacher-apps | lectures | system
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [lectures, setLectures] = useState([]);
  const [systemStatus, setSystemStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");

  // User management state
  const [userSearch, setUserSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedUserForEdit, setSelectedUserForEdit] = useState(null);
  const [newRole, setNewRole] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [userToDelete, setUserToDelete] = useState(null);

  // Lecture management state
  const [lectureSearch, setLectureSearch] = useState("");
  const [lectureStatusFilter, setLectureStatusFilter] = useState("all");
  const [lectureToDelete, setLectureToDelete] = useState(null);

  // Teacher Applications state
  const [teacherApps, setTeacherApps] = useState([]);
  const [teacherAppSearch, setTeacherAppSearch] = useState("");
  const [teacherAppStatusFilter, setTeacherAppStatusFilter] = useState("all");
  const [selectedAppForApprove, setSelectedAppForApprove] = useState(null);
  const [selectedAppForReject, setSelectedAppForReject] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // Course Management state
  const [adminCourses, setAdminCourses] = useState([]);
  const [courseSearch, setCourseSearch] = useState("");
  const [courseStatusFilter, setCourseStatusFilter] = useState("all");
  const [showCreateCourseModal, setShowCreateCourseModal] = useState(false);
  const [newCourseTitle, setNewCourseTitle] = useState("");
  const [newCourseCode, setNewCourseCode] = useState("");
  const [newCourseDesc, setNewCourseDesc] = useState("");
  const [newCourseStatus, setNewCourseStatus] = useState("active");
  const [courseToEdit, setCourseToEdit] = useState(null);
  const [courseToDelete, setCourseToDelete] = useState(null);
  const [forceDeleteCourse, setForceDeleteCourse] = useState(false);
  const [activeCourseMembers, setActiveCourseMembers] = useState(null);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Course Enrollment Requests state
  const [enrollments, setEnrollments] = useState([]);
  const [enrollmentStatusFilter, setEnrollmentStatusFilter] = useState("all");
  const [enrollmentRoleFilter, setEnrollmentRoleFilter] = useState("all");
  const [enrollmentCourseFilter, setEnrollmentCourseFilter] = useState("all");
  const [enrollmentSearch, setEnrollmentSearch] = useState("");
  const [selectedEnrollmentForApprove, setSelectedEnrollmentForApprove] = useState(null);
  const [selectedEnrollmentForReject, setSelectedEnrollmentForReject] = useState(null);
  const [enrollmentRejectionReason, setEnrollmentRejectionReason] = useState("");

  const [processingId, setProcessingId] = useState(null);

  // Admin Teacher Account Creation & Course Assignment state
  const [showCreateTeacherModal, setShowCreateTeacherModal] = useState(false);
  const [teacherName, setTeacherName] = useState("");
  const [teacherEmail, setTeacherEmail] = useState("");
  const [teacherPhone, setTeacherPhone] = useState("");
  const [teacherDept, setTeacherDept] = useState("");
  const [teacherInstitution, setTeacherInstitution] = useState("");
  const [teacherAvatarUrl, setTeacherAvatarUrl] = useState("");
  const [teacherBio, setTeacherBio] = useState("");
  const [selectedCourseIds, setSelectedCourseIds] = useState([]);
  const [teacherPasswordMode, setTeacherPasswordMode] = useState("invitation"); // "invitation" | "manual"
  const [teacherPassword, setTeacherPassword] = useState("");
  const [creatingTeacher, setCreatingTeacher] = useState(false);

  // Success invitation link state
  const [createdTeacherResult, setCreatedTeacherResult] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Edit Teacher Profile & Course Assignments state
  const [showEditTeacherModal, setShowEditTeacherModal] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [editTeacherName, setEditTeacherName] = useState("");
  const [editTeacherEmail, setEditTeacherEmail] = useState("");
  const [editTeacherPhone, setEditTeacherPhone] = useState("");
  const [editTeacherDept, setEditTeacherDept] = useState("");
  const [editTeacherInstitution, setEditTeacherInstitution] = useState("");
  const [editTeacherBio, setEditTeacherBio] = useState("");
  const [editTeacherAvatar, setEditTeacherAvatar] = useState("");
  const [editTeacherStatus, setEditTeacherStatus] = useState("active");
  const [editTeacherCourseIds, setEditTeacherCourseIds] = useState([]);
  const [savingTeacherEdit, setSavingTeacherEdit] = useState(false);

  // Course Member Assign Teacher state
  const [selectedTeacherToAssign, setSelectedTeacherToAssign] = useState("");
  const [assigningTeacher, setAssigningTeacher] = useState(false);

  const loadAllData = async () => {
    try {
      const results = await Promise.allSettled([
        api.getAdminStats(),
        api.getAdminUsers(),
        api.getAdminLectures(),
        api.getAdminSystemStatus(),
        api.getAdminTeacherApplications(),
        api.getAdminCourses(),
        api.getAdminEnrollments(),
      ]);

      const [
        statsRes,
        usersRes,
        lecturesRes,
        systemRes,
        teacherAppsRes,
        coursesRes,
        enrollmentsRes,
      ] = results;

      if (statsRes.status === "fulfilled" && statsRes.value) {
        setStats(statsRes.value);
      }
      if (usersRes.status === "fulfilled" && usersRes.value) {
        setUsers(usersRes.value || []);
      }
      if (lecturesRes.status === "fulfilled" && lecturesRes.value) {
        setLectures(lecturesRes.value || []);
      }
      if (systemRes.status === "fulfilled" && systemRes.value) {
        setSystemStatus(systemRes.value);
      }
      if (teacherAppsRes.status === "fulfilled" && teacherAppsRes.value) {
        setTeacherApps(teacherAppsRes.value || []);
      }
      if (coursesRes.status === "fulfilled" && coursesRes.value) {
        setAdminCourses(coursesRes.value || []);
      }
      if (enrollmentsRes.status === "fulfilled" && enrollmentsRes.value) {
        setEnrollments(enrollmentsRes.value || []);
      }

      const rejected = results.filter((r) => r.status === "rejected");
      if (rejected.length > 0) {
        const firstError = rejected[0].reason;
        console.warn(`${rejected.length} admin requests failed:`, rejected);
        const errMsg = firstError?.message || "";
        if (firstError?.status === 401) {
          setActionError("Admin session expired or unauthorized. Please re-authenticate as administrator.");
        } else if (
          errMsg.includes("connection pool paused") ||
          errMsg.includes("timeout") ||
          errMsg.includes("timed out") ||
          errMsg.includes("SSL")
        ) {
          setActionError("Re-establishing connection with MongoDB Atlas. Data will sync automatically.");
          // Auto-clear transient Atlas reconnect message after 5 seconds
          setTimeout(() => setActionError(""), 5000);
        } else {
          setActionError(errMsg || "Some admin modules could not load data.");
        }
      }
    } catch (err) {
      console.error("Failed to load admin data:", err);
      setActionError(err.message || "Failed to load platform data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    setActionMessage("");
    setActionError("");
    loadAllData();
  };

  const showNotification = (msg, isError = false) => {
    if (isError) {
      setActionError(msg);
      setActionMessage("");
    } else {
      setActionMessage(msg);
      setActionError("");
    }
    setTimeout(() => {
      setActionMessage("");
      setActionError("");
    }, 4500);
  };

  // User Actions
  const handleUpdateUser = async () => {
    if (!selectedUserForEdit) return;
    try {
      await api.updateAdminUser(selectedUserForEdit.id, {
        role: newRole || selectedUserForEdit.role,
        status: newStatus || selectedUserForEdit.status,
      });
      showNotification(`Successfully updated user ${selectedUserForEdit.email}`);
      setSelectedUserForEdit(null);
      await loadAllData();
    } catch (err) {
      showNotification(err.message || "Failed to update user", true);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      await api.deleteAdminUser(userToDelete.id);
      showNotification(`User ${userToDelete.email} permanently deleted.`);
      setUserToDelete(null);
      await loadAllData();
    } catch (err) {
      showNotification(err.message || "Failed to delete user", true);
    }
  };

  // Lecture Actions
  const handleDeleteLecture = async () => {
    if (!lectureToDelete) return;
    try {
      await api.deleteAdminLecture(lectureToDelete.id);
      showNotification(`Lecture "${lectureToDelete.title}" and associated assets deleted.`);
      setLectureToDelete(null);
      await loadAllData();
    } catch (err) {
      showNotification(err.message || "Failed to delete lecture", true);
    }
  };

  // Teacher Applications Actions
  const handleApproveTeacherApp = async () => {
    if (!selectedAppForApprove) return;
    setProcessingId(selectedAppForApprove.id);
    try {
      const res = await api.approveTeacherApplication(selectedAppForApprove.id);
      showNotification(res.message || `Application for ${selectedAppForApprove.name} approved.`);
      setSelectedAppForApprove(null);
      await loadAllData();
    } catch (err) {
      showNotification(err.message || "Failed to approve teacher application", true);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectTeacherApp = async () => {
    if (!selectedAppForReject) return;
    setProcessingId(selectedAppForReject.id);
    try {
      const res = await api.rejectTeacherApplication(
        selectedAppForReject.id,
        rejectionReason.trim() || "Application requirements not met."
      );
      showNotification(res.message || `Application for ${selectedAppForReject.name} rejected.`);
      setSelectedAppForReject(null);
      setRejectionReason("");
      await loadAllData();
    } catch (err) {
      showNotification(err.message || "Failed to reject teacher application", true);
    } finally {
      setProcessingId(null);
    }
  };

  // Course Management Actions
  const handleCreateCourse = async (e) => {
    e.preventDefault();
    if (!newCourseTitle.trim()) return;
    try {
      await api.createCourse({
        title: newCourseTitle.trim(),
        code: newCourseCode.trim() ? newCourseCode.trim().toUpperCase() : undefined,
        description: newCourseDesc.trim(),
        status: newCourseStatus,
      });
      showNotification(`Course "${newCourseTitle}" created successfully!`);
      setShowCreateCourseModal(false);
      setNewCourseTitle("");
      setNewCourseCode("");
      setNewCourseDesc("");
      setNewCourseStatus("active");
      await loadAllData();
    } catch (err) {
      showNotification(err.message || "Failed to create course", true);
    }
  };

  const handleUpdateCourse = async (e) => {
    e.preventDefault();
    if (!courseToEdit) return;
    try {
      await api.updateCourse(courseToEdit.id, {
        title: courseToEdit.title,
        code: courseToEdit.code ? courseToEdit.code.toUpperCase() : undefined,
        description: courseToEdit.description,
        status: courseToEdit.status,
      });
      showNotification(`Course "${courseToEdit.title}" updated successfully.`);
      setCourseToEdit(null);
      await loadAllData();
    } catch (err) {
      showNotification(err.message || "Failed to update course", true);
    }
  };

  const handleDeleteCourse = async () => {
    if (!courseToDelete) return;
    try {
      await api.deleteCourse(courseToDelete.id, forceDeleteCourse);
      showNotification(`Course "${courseToDelete.title}" deleted.`);
      setCourseToDelete(null);
      setForceDeleteCourse(false);
      await loadAllData();
    } catch (err) {
      showNotification(err.message || "Failed to delete course", true);
    }
  };

  const handleCreateTeacher = async (e) => {
    e.preventDefault();
    if (!teacherName.trim() || !teacherEmail.trim()) {
      showNotification("Please provide full name and a valid email address.", true);
      return;
    }
    if (teacherPasswordMode === "manual" && (!teacherPassword || teacherPassword.length < 6)) {
      showNotification("Password must be at least 6 characters long.", true);
      return;
    }

    setCreatingTeacher(true);
    try {
      const payload = {
        name: teacherName.trim(),
        email: teacherEmail.trim().toLowerCase(),
        phone: teacherPhone.trim() || undefined,
        department: teacherDept.trim() || undefined,
        institution: teacherInstitution.trim() || undefined,
        bio: teacherBio.trim() || undefined,
        avatar_url: teacherAvatarUrl.trim() || undefined,
        course_ids: selectedCourseIds,
      };

      if (teacherPasswordMode === "manual" && teacherPassword.trim()) {
        payload.password = teacherPassword.trim();
      }

      const res = await api.createTeacherByAdmin(payload);
      showNotification(`Faculty profile for "${teacherName}" created successfully!`);
      setShowCreateTeacherModal(false);

      // Reset form fields
      setTeacherName("");
      setTeacherEmail("");
      setTeacherPhone("");
      setTeacherDept("");
      setTeacherInstitution("");
      setTeacherAvatarUrl("");
      setTeacherBio("");
      setSelectedCourseIds([]);
      setTeacherPassword("");
      setTeacherPasswordMode("invitation");

      // Show invitation link modal if token was generated
      if (res?.invitation_link) {
        setCreatedTeacherResult(res);
      }

      await loadAllData();
    } catch (err) {
      showNotification(err.message || "Failed to create teacher account", true);
    } finally {
      setCreatingTeacher(false);
    }
  };

  const handleOpenEditTeacher = (teacher) => {
    setEditingTeacher(teacher);
    setEditTeacherName(teacher.name || "");
    setEditTeacherEmail(teacher.email || "");
    setEditTeacherPhone(teacher.phone || "");
    setEditTeacherDept(teacher.department || "");
    setEditTeacherInstitution(teacher.institution || "");
    setEditTeacherBio(teacher.bio || "");
    setEditTeacherAvatar(teacher.avatar_url || "");
    setEditTeacherStatus(teacher.status || "active");
    const existingCids = teacher.assigned_course_ids || (teacher.assigned_courses || []).map((c) => c.id);
    setEditTeacherCourseIds(existingCids || []);
    setShowEditTeacherModal(true);
  };

  const handleSaveTeacherEdit = async (e) => {
    e.preventDefault();
    if (!editingTeacher) return;
    setSavingTeacherEdit(true);
    try {
      await api.updateTeacherByAdmin(editingTeacher.id, {
        name: editTeacherName.trim(),
        phone: editTeacherPhone.trim(),
        department: editTeacherDept.trim(),
        institution: editTeacherInstitution.trim(),
        bio: editTeacherBio.trim(),
        avatar_url: editTeacherAvatar.trim(),
        status: editTeacherStatus,
        course_ids: editTeacherCourseIds,
      });
      showNotification(`Teacher profile for "${editTeacherName}" updated successfully!`);
      setShowEditTeacherModal(false);
      setEditingTeacher(null);
      await loadAllData();
    } catch (err) {
      showNotification(err.message || "Failed to update teacher profile", true);
    } finally {
      setSavingTeacherEdit(false);
    }
  };

  const handleResendInvitation = async (teacher) => {
    try {
      const res = await api.resendTeacherInvitation(teacher.id);
      showNotification(`Fresh invitation link generated for ${teacher.name}!`);
      setCreatedTeacherResult({
        ...teacher,
        invitation_link: res.invitation_link || `/activate-teacher?token=${res.activation_token}`,
      });
      await loadAllData();
    } catch (err) {
      showNotification(err.message || "Failed to generate invitation", true);
    }
  };

  const handleToggleTeacherStatus = async (teacher) => {
    const nextStatus = teacher.status === "active" ? "inactive" : "active";
    try {
      await api.updateTeacherByAdmin(teacher.id, { status: nextStatus });
      showNotification(`Teacher account status updated to ${nextStatus}.`);
      await loadAllData();
    } catch (err) {
      showNotification(err.message || "Failed to update account status", true);
    }
  };

  const copyToClipboard = (text) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleAssignTeacherToCourse = async () => {
    if (!activeCourseMembers || !selectedTeacherToAssign) return;
    setAssigningTeacher(true);
    try {
      await api.assignTeacherToCourse(activeCourseMembers.course_id, selectedTeacherToAssign);
      showNotification("Teacher assigned to course successfully!");
      setSelectedTeacherToAssign("");
      const updatedMembers = await api.getCourseMembers(activeCourseMembers.course_id);
      setActiveCourseMembers(updatedMembers);
      await loadAllData();
    } catch (err) {
      showNotification(err.message || "Failed to assign teacher to course", true);
    } finally {
      setAssigningTeacher(false);
    }
  };

  const handleViewCourseMembers = async (courseId) => {
    setLoadingMembers(true);
    try {
      const data = await api.getCourseMembers(courseId);
      setActiveCourseMembers(data);
    } catch (err) {
      showNotification(err.message || "Failed to fetch course members", true);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleRemoveMember = async (userId, userName) => {
    if (!activeCourseMembers) return;
    try {
      await api.removeCourseMember(activeCourseMembers.course_id, userId);
      showNotification(`Removed ${userName || "user"} from course.`);
      const updatedMembers = await api.getCourseMembers(activeCourseMembers.course_id);
      setActiveCourseMembers(updatedMembers);
      await loadAllData();
    } catch (err) {
      showNotification(err.message || "Failed to remove member", true);
    }
  };

  // Course Enrollment Requests Actions
  const handleApproveEnrollment = async () => {
    if (!selectedEnrollmentForApprove) return;
    setProcessingId(selectedEnrollmentForApprove.id);
    try {
      const res = await api.approveEnrollment(selectedEnrollmentForApprove.id);
      showNotification(res.message || `Enrollment for ${selectedEnrollmentForApprove.user_name} approved!`);
      setSelectedEnrollmentForApprove(null);
      if (activeCourseMembers) {
        const updated = await api.getCourseMembers(activeCourseMembers.course_id);
        setActiveCourseMembers(updated);
      }
      await loadAllData();
    } catch (err) {
      showNotification(err.message || "Failed to approve enrollment", true);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectEnrollment = async () => {
    if (!selectedEnrollmentForReject) return;
    setProcessingId(selectedEnrollmentForReject.id);
    try {
      const res = await api.rejectEnrollment(
        selectedEnrollmentForReject.id,
        enrollmentRejectionReason.trim() || "Enrollment requirements not met."
      );
      showNotification(res.message || `Enrollment for ${selectedEnrollmentForReject.user_name} rejected.`);
      setSelectedEnrollmentForReject(null);
      setEnrollmentRejectionReason("");
      if (activeCourseMembers) {
        const updated = await api.getCourseMembers(activeCourseMembers.course_id);
        setActiveCourseMembers(updated);
      }
      await loadAllData();
    } catch (err) {
      showNotification(err.message || "Failed to reject enrollment", true);
    } finally {
      setProcessingId(null);
    }
  };

  // Filtered lists
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      !userSearch ||
      u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email?.toLowerCase().includes(userSearch.toLowerCase());
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    const matchesStatus = statusFilter === "all" || u.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const filteredLectures = lectures.filter((l) => {
    const matchesSearch =
      !lectureSearch ||
      l.title?.toLowerCase().includes(lectureSearch.toLowerCase()) ||
      l.teacher_name?.toLowerCase().includes(lectureSearch.toLowerCase()) ||
      l.course_title?.toLowerCase().includes(lectureSearch.toLowerCase());
    const matchesStatus =
      lectureStatusFilter === "all" ||
      (lectureStatusFilter === "published" && l.is_published) ||
      (lectureStatusFilter === "unpublished" && !l.is_published) ||
      l.status === lectureStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredTeacherApps = teacherApps.filter((app) => {
    const matchesSearch =
      !teacherAppSearch ||
      app.name?.toLowerCase().includes(teacherAppSearch.toLowerCase()) ||
      app.email?.toLowerCase().includes(teacherAppSearch.toLowerCase()) ||
      app.institution?.toLowerCase().includes(teacherAppSearch.toLowerCase()) ||
      app.department?.toLowerCase().includes(teacherAppSearch.toLowerCase());
    const matchesStatus =
      teacherAppStatusFilter === "all" || app.status === teacherAppStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredCourses = adminCourses.filter((c) => {
    const matchesSearch =
      !courseSearch ||
      c.title?.toLowerCase().includes(courseSearch.toLowerCase()) ||
      c.code?.toLowerCase().includes(courseSearch.toLowerCase()) ||
      c.teacher_name?.toLowerCase().includes(courseSearch.toLowerCase());
    const matchesStatus =
      courseStatusFilter === "all" || c.status === courseStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredEnrollments = enrollments.filter((e) => {
    const matchesSearch =
      !enrollmentSearch ||
      e.user_name?.toLowerCase().includes(enrollmentSearch.toLowerCase()) ||
      e.user_email?.toLowerCase().includes(enrollmentSearch.toLowerCase()) ||
      e.course_title?.toLowerCase().includes(enrollmentSearch.toLowerCase()) ||
      e.course_code?.toLowerCase().includes(enrollmentSearch.toLowerCase());
    const matchesStatus =
      enrollmentStatusFilter === "all" || e.status === enrollmentStatusFilter;
    const matchesRole =
      enrollmentRoleFilter === "all" || e.user_role === enrollmentRoleFilter;
    const matchesCourse =
      enrollmentCourseFilter === "all" || e.course_id === enrollmentCourseFilter;
    return matchesSearch && matchesStatus && matchesRole && matchesCourse;
  });

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" /> Loading Admin Operations Center...
      </div>
    );
  }

  return (
    <div className="dashboard-page max-w-5xl">
      {/* Header */}
      <div className="dashboard-header">
        <div>
          <div className="flex items-center gap-3">
            <h1>Platform Administration</h1>
            <span className="role-badge role-admin">Root Admin</span>
          </div>
          <p>
            System-wide user governance, course catalog management, enrollment request approval, and MongoDB telemetry.
          </p>
        </div>
        <div className="header-actions">
          <button onClick={handleRefresh} className="btn-secondary" title="Sync live MongoDB state">
            <RefreshCw size={16} className={refreshing ? "spin" : ""} />
            Sync Platform
          </button>
        </div>
      </div>

      {/* Notifications */}
      {actionMessage && <div className="alert-success mb-4">{actionMessage}</div>}
      {actionError && (
        <div
          className="alert-error mb-4"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1 }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{actionError}</span>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="btn-secondary btn-sm"
              style={{
                fontSize: "0.8rem",
                padding: "4px 10px",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <RefreshCw size={13} className={refreshing ? "spin" : ""} />
              {refreshing ? "Retrying..." : "Retry"}
            </button>
            <button
              onClick={() => setActionError("")}
              style={{
                background: "none",
                border: "none",
                color: "inherit",
                cursor: "pointer",
                padding: "2px",
                display: "flex",
                alignItems: "center",
              }}
              title="Dismiss"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="admin-nav-tabs">
        <button
          onClick={() => setActiveTab("overview")}
          className={`tab-btn ${activeTab === "overview" ? "active" : ""}`}
        >
          <Activity size={17} />
          Overview
        </button>
        <button
          onClick={() => setActiveTab("users")}
          className={`tab-btn ${activeTab === "users" ? "active" : ""}`}
        >
          <Users size={17} />
          Users ({users.length})
        </button>
        <button
          onClick={() => setActiveTab("courses")}
          className={`tab-btn ${activeTab === "courses" ? "active" : ""}`}
        >
          <BookOpen size={17} />
          Courses ({adminCourses.length})
        </button>
        <button
          onClick={() => setActiveTab("enrollments")}
          className={`tab-btn ${activeTab === "enrollments" ? "active" : ""}`}
        >
          <CheckSquare size={17} />
          Enrollment Requests
          {stats?.pending_enrollment_requests > 0 && (
            <span
              style={{
                marginLeft: "8px",
                background: "#f59e0b",
                color: "#000",
                fontSize: "0.72rem",
                fontWeight: "700",
                padding: "2px 8px",
                borderRadius: "999px",
              }}
            >
              {stats.pending_enrollment_requests} pending
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("teacher-apps")}
          className={`tab-btn ${activeTab === "teacher-apps" ? "active" : ""}`}
        >
          <GraduationCap size={17} />
          Teacher Applications
          {stats?.pending_teacher_applications > 0 ? (
            <span
              style={{
                marginLeft: "8px",
                background: "#f59e0b",
                color: "#000",
                fontSize: "0.72rem",
                fontWeight: "700",
                padding: "2px 8px",
                borderRadius: "999px",
              }}
            >
              {stats.pending_teacher_applications} pending
            </span>
          ) : (
            <span style={{ marginLeft: "4px", opacity: 0.7 }}>({teacherApps.length})</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("lectures")}
          className={`tab-btn ${activeTab === "lectures" ? "active" : ""}`}
        >
          <Video size={17} />
          Lectures ({lectures.length})
        </button>
        <button
          onClick={() => setActiveTab("system")}
          className={`tab-btn ${activeTab === "system" ? "active" : ""}`}
        >
          <Server size={17} />
          System Health
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && stats && (
        <div className="admin-tab-content">
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-icon purple">
                <Users size={24} />
              </div>
              <div>
                <div className="metric-value">{stats.total_users}</div>
                <div className="metric-label">Total Users</div>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon blue">
                <GraduationCap size={24} />
              </div>
              <div>
                <div className="metric-value">{stats.total_students}</div>
                <div className="metric-label">Enrolled Students</div>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon amber">
                <BookOpen size={24} />
              </div>
              <div>
                <div className="metric-value">{stats.total_teachers}</div>
                <div className="metric-label">Active Instructors</div>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon green">
                <Video size={24} />
              </div>
              <div>
                <div className="metric-value">{stats.total_lectures}</div>
                <div className="metric-label">Ingested Lectures</div>
              </div>
            </div>
          </div>

          <div className="metrics-grid mt-4">
            <div className="metric-card">
              <div className="metric-icon green">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <div className="metric-value">{stats.total_processed}</div>
                <div className="metric-label">Processed Lectures</div>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon amber">
                <Clock size={24} />
              </div>
              <div>
                <div className="metric-value">{stats.total_pending}</div>
                <div className="metric-label">Queued / Processing</div>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon red">
                <AlertTriangle size={24} />
              </div>
              <div>
                <div className="metric-value">{stats.total_failed}</div>
                <div className="metric-label">Failed Ingestions</div>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon purple">
                <HelpCircle size={24} />
              </div>
              <div>
                <div className="metric-value">{stats.total_courses}</div>
                <div className="metric-label">Courses ({stats.total_quizzes} Quizzes)</div>
              </div>
            </div>
          </div>

          {/* Pending Alerts */}
          {stats.pending_enrollment_requests > 0 && (
            <div
              style={{
                background: "linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(99, 102, 241, 0.04) 100%)",
                border: "1px solid rgba(99, 102, 241, 0.35)",
                borderRadius: "12px",
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "16px",
                marginTop: "20px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div
                  style={{
                    background: "rgba(99, 102, 241, 0.2)",
                    borderRadius: "10px",
                    padding: "8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <BookOpen size={24} style={{ color: "var(--primary-color, #6366f1)" }} />
                </div>
                <div>
                  <h4 style={{ margin: "0 0 3px", color: "var(--text-main, #0f172a)", fontSize: "0.98rem" }}>
                    {stats.pending_enrollment_requests} Course Enrollment Request{stats.pending_enrollment_requests > 1 ? "s" : ""} Pending Review
                  </h4>
                  <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--text-muted, #64748b)" }}>
                    Students and teachers requesting access to active course workspaces.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setEnrollmentStatusFilter("pending");
                  setActiveTab("enrollments");
                }}
                className="btn-primary"
                style={{ whiteSpace: "nowrap", padding: "8px 16px", fontSize: "0.88rem" }}
              >
                Review Requests →
              </button>
            </div>
          )}

          {stats.pending_teacher_applications > 0 && (
            <div
              style={{
                background: "linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(245, 158, 11, 0.04) 100%)",
                border: "1px solid rgba(245, 158, 11, 0.35)",
                borderRadius: "12px",
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "16px",
                marginTop: "16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div
                  style={{
                    background: "rgba(245, 158, 11, 0.2)",
                    borderRadius: "10px",
                    padding: "8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <GraduationCap size={24} style={{ color: "#d97706" }} />
                </div>
                <div>
                  <h4 style={{ margin: "0 0 3px", color: "var(--text-main, #0f172a)", fontSize: "0.98rem" }}>
                    {stats.pending_teacher_applications} Faculty Registration Request{stats.pending_teacher_applications > 1 ? "s" : ""} Pending
                  </h4>
                  <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--text-muted, #64748b)" }}>
                    Educators awaiting institutional verification and teacher account activation.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setTeacherAppStatusFilter("pending");
                  setActiveTab("teacher-apps");
                }}
                className="btn-primary"
                style={{ whiteSpace: "nowrap", padding: "8px 16px", fontSize: "0.88rem" }}
              >
                Review Requests →
              </button>
            </div>
          )}

          {/* Recent Activity Log */}
          <div className="dashboard-section mt-6">
            <div className="section-header">
              <h2>Recent Platform Activity</h2>
              <span className="badge-count">Audit Trail (Live MongoDB)</span>
            </div>
            {stats.recent_activity.length === 0 ? (
              <div className="empty-state">
                <Activity size={36} />
                <p>No logged platform activity yet.</p>
              </div>
            ) : (
              <div className="activity-timeline">
                {stats.recent_activity.map((act, idx) => (
                  <div key={idx} className="timeline-item">
                    <div className="timeline-marker" />
                    <div className="timeline-content">
                      <div className="timeline-action">
                        <strong>{act.action?.replace(/_/g, " ").toUpperCase()}</strong> on{" "}
                        <span className="badge">{act.entity_type}</span>
                      </div>
                      <div className="timeline-time">
                        {act.timestamp ? new Date(act.timestamp).toLocaleString() : "Just now"} · User ID:{" "}
                        <code>{act.user_id?.slice(-6) || "System"}</code>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: USERS */}
      {activeTab === "users" && (
        <div className="admin-tab-content">
          <div className="dashboard-section">
            <div className="section-header">
              <div>
                <h2>Registered Platform Users</h2>
                <p className="text-muted text-sm mt-1">
                  Manage accounts, create faculty credentials, and toggle status.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="badge-count">
                  {filteredUsers.length} of {users.length} Users
                </span>
                <button
                  onClick={() => setShowCreateTeacherModal(true)}
                  className="btn-primary"
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <UserPlus size={16} /> Create Teacher Account
                </button>
              </div>
            </div>

            <div className="table-controls">
              <div className="search-bar">
                <Search size={18} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                />
              </div>

              <div className="filter-group">
                <Filter size={16} className="text-muted" />
                <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                  <option value="all">All Roles</option>
                  <option value="student">Students</option>
                  <option value="teacher">Teachers</option>
                  <option value="admin">Admins</option>
                </select>

                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            </div>

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Assigned Courses</th>
                    <th>Status</th>
                    <th>Member Since</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div className="font-semibold text-main">{u.name}</div>
                        <div className="text-xs text-muted">{u.email}</div>
                        {u.role === "teacher" && (u.department || u.institution || u.phone) && (
                          <div className="text-xs text-muted mt-1" style={{ fontSize: "0.75rem" }}>
                            {[u.department, u.institution, u.phone].filter(Boolean).join(" • ")}
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <span className={`role-badge role-${u.role}`}>{u.role === "teacher" ? "INSTRUCTOR" : u.role?.toUpperCase()}</span>
                          {u.admin_created && (
                            <span
                              style={{
                                fontSize: "0.68rem",
                                padding: "2px 5px",
                                borderRadius: "4px",
                                background: "rgba(99, 102, 241, 0.12)",
                                color: "#6366f1",
                                fontWeight: 600,
                              }}
                              title="Provisioned directly by Platform Administrator"
                            >
                              ADMIN CREATED
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        {u.role === "teacher" ? (
                          u.assigned_courses && u.assigned_courses.length > 0 ? (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", maxWidth: "220px" }}>
                              {u.assigned_courses.map((c) => (
                                <span
                                  key={c.id || c.code}
                                  style={{
                                    fontSize: "0.72rem",
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                    background: "rgba(99, 102, 241, 0.08)",
                                    border: "1px solid rgba(99, 102, 241, 0.2)",
                                    color: "var(--text-main, #1e293b)",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "3px",
                                  }}
                                  title={c.title}
                                >
                                  <BookOpen size={10} color="#6366f1" />
                                  <strong>{c.code}</strong>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-muted" style={{ fontStyle: "italic" }}>
                              None assigned
                            </span>
                          )
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            u.status === "active"
                              ? "badge-success"
                              : u.status === "pending_activation"
                              ? "badge-warning"
                              : u.status === "suspended"
                              ? "badge-danger"
                              : "badge-secondary"
                          }`}
                        >
                          {u.status === "pending_activation" ? "Pending Activation" : (u.status || "active")}
                        </span>
                      </td>
                      <td className="text-sm text-muted">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : "Initial"}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          {u.role === "teacher" && (
                            <>
                              <button
                                onClick={() => handleOpenEditTeacher(u)}
                                className="btn-action"
                                title="Edit Teacher Profile & Course Assignments"
                                style={{ color: "#6366f1" }}
                              >
                                <Edit size={15} /> Edit
                              </button>
                              {(u.status === "pending_activation" || u.activation_token) && (
                                <button
                                  onClick={() => handleResendInvitation(u)}
                                  className="btn-action"
                                  title="View or Resend Activation Link"
                                  style={{ color: "#0ea5e9" }}
                                >
                                  <Copy size={15} /> Invite
                                </button>
                              )}
                              <button
                                onClick={() => handleToggleTeacherStatus(u)}
                                className="btn-action"
                                title={u.status === "active" ? "Deactivate Instructor Account" : "Reactivate Instructor Account"}
                              >
                                {u.status === "active" ? <UserMinus size={15} /> : <UserCheck size={15} />}
                                {u.status === "active" ? "Deactivate" : "Activate"}
                              </button>
                            </>
                          )}
                          {u.role !== "teacher" && (
                            <button
                              onClick={() => {
                                setSelectedUserForEdit(u);
                                setNewRole(u.role);
                                setNewStatus(u.status || "active");
                              }}
                              className="btn-action"
                              title="Edit Role / Status"
                            >
                              <UserCheck size={16} /> Edit
                            </button>
                          )}
                          <button
                            onClick={() => setUserToDelete(u)}
                            className="btn-action text-danger"
                            title="Delete User"
                          >
                            <Trash2 size={16} /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: COURSE MANAGEMENT */}
      {activeTab === "courses" && (
        <div className="admin-tab-content">
          <div className="dashboard-section">
            <div className="section-header">
              <div>
                <h2>Course Management</h2>
                <p className="text-muted text-sm mt-1">
                  Create, configure, and monitor academic courses, enrollment codes, and instructor assignments.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="badge-count">
                  {filteredCourses.length} Courses
                </span>
                <button
                  onClick={() => setShowCreateCourseModal(true)}
                  className="btn-primary"
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <Plus size={16} /> Create Course
                </button>
              </div>
            </div>

            <div className="table-controls">
              <div className="search-bar">
                <Search size={18} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search by course title, code (e.g. CS401), or instructor..."
                  value={courseSearch}
                  onChange={(e) => setCourseSearch(e.target.value)}
                />
              </div>

              <div className="filter-group">
                <Filter size={16} className="text-muted" />
                <select
                  value={courseStatusFilter}
                  onChange={(e) => setCourseStatusFilter(e.target.value)}
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active Only</option>
                  <option value="inactive">Inactive Only</option>
                </select>
              </div>
            </div>

            {filteredCourses.length === 0 ? (
              <div className="empty-state">
                <BookOpen size={44} style={{ opacity: 0.4 }} />
                <h3>No Courses Found</h3>
                <p>No courses match your filter criteria. Click "Create Course" to add a new course.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Course</th>
                      <th>Enrollment Code</th>
                      <th>Primary Instructor</th>
                      <th>Status</th>
                      <th>Stats</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCourses.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <div style={{ fontWeight: "600", color: "var(--text-main, #0f172a)" }}>
                            {c.title}
                          </div>
                          <div style={{ fontSize: "0.82rem", color: "var(--text-muted, #64748b)", marginTop: "2px", maxWidth: "260px" }}>
                            {c.description ? (c.description.length > 70 ? c.description.slice(0, 70) + "..." : c.description) : "No description."}
                          </div>
                        </td>
                        <td>
                          <code style={{ fontSize: "0.88rem", fontWeight: "700", padding: "2px 6px", background: "rgba(99, 102, 241, 0.1)", borderRadius: "4px" }}>
                            {c.code}
                          </code>
                        </td>
                        <td>
                          <div style={{ fontSize: "0.88rem", fontWeight: "500" }}>{c.teacher_name || "Assigned"}</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted, #64748b)" }}>
                            {c.teacher_ids?.length || 1} instructor(s)
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${c.status === "active" ? "badge-success" : "badge-warning"}`}>
                            {c.status?.toUpperCase() || "ACTIVE"}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontSize: "0.82rem" }}>
                            <strong>{c.student_count}</strong> students · <strong>{c.lecture_count}</strong> lectures
                          </div>
                          {c.pending_requests_count > 0 && (
                            <span style={{ fontSize: "0.72rem", color: "#f59e0b", fontWeight: "700" }}>
                              {c.pending_requests_count} pending request(s)
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                            <button
                              onClick={() => handleViewCourseMembers(c.id)}
                              className="btn-action"
                              title="View Enrolled Students & Instructors"
                              style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
                            >
                              <Users size={14} /> Members
                            </button>
                            <button
                              onClick={() => setCourseToEdit({ ...c })}
                              className="btn-action"
                              title="Edit Course Details"
                              style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
                            >
                              <Edit size={14} /> Edit
                            </button>
                            <button
                              onClick={() => {
                                setCourseToDelete(c);
                                setForceDeleteCourse(false);
                              }}
                              className="btn-action text-danger"
                              title="Delete Course"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: ENROLLMENT REQUESTS */}
      {activeTab === "enrollments" && (
        <div className="admin-tab-content">
          <div className="dashboard-section">
            <div className="section-header">
              <div>
                <h2>Course Enrollment Requests</h2>
                <p className="text-muted text-sm mt-1">
                  Review student and faculty course membership requests. Approving unlocks course learning workspaces.
                </p>
              </div>
              <span className="badge-count">
                {filteredEnrollments.length} Requests
              </span>
            </div>

            <div className="table-controls">
              <div className="search-bar">
                <Search size={18} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search by student/teacher name, email, or course..."
                  value={enrollmentSearch}
                  onChange={(e) => setEnrollmentSearch(e.target.value)}
                />
              </div>

              <div className="filter-group">
                <Filter size={16} className="text-muted" />
                <select
                  value={enrollmentStatusFilter}
                  onChange={(e) => setEnrollmentStatusFilter(e.target.value)}
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending Only</option>
                  <option value="approved">Approved Only</option>
                  <option value="rejected">Rejected Only</option>
                </select>

                <select
                  value={enrollmentRoleFilter}
                  onChange={(e) => setEnrollmentRoleFilter(e.target.value)}
                >
                  <option value="all">All Roles</option>
                  <option value="student">Students</option>
                  <option value="teacher">Teachers</option>
                </select>

                <select
                  value={enrollmentCourseFilter}
                  onChange={(e) => setEnrollmentCourseFilter(e.target.value)}
                >
                  <option value="all">All Courses</option>
                  {adminCourses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code}: {c.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {filteredEnrollments.length === 0 ? (
              <div className="empty-state">
                <CheckSquare size={44} style={{ opacity: 0.4 }} />
                <h3>No Enrollment Requests Found</h3>
                <p>No enrollment requests match your current search and filter settings.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Applicant</th>
                      <th>Role</th>
                      <th>Requested Course</th>
                      <th>Submission Date</th>
                      <th>Status</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEnrollments.map((en) => (
                      <tr key={en.id}>
                        <td>
                          <div style={{ fontWeight: "600", color: "var(--text-main, #0f172a)" }}>
                            {en.user_name}
                          </div>
                          <div style={{ fontSize: "0.82rem", color: "var(--text-muted, #64748b)" }}>
                            <code>{en.user_email}</code>
                          </div>
                        </td>
                        <td>
                          <span className={`role-badge role-${en.user_role}`}>
                            {en.user_role?.toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: "600" }}>{en.course_title}</div>
                          <div style={{ fontSize: "0.78rem", color: "var(--text-muted, #64748b)" }}>
                            Code: <strong>{en.course_code}</strong>
                          </div>
                        </td>
                        <td>
                          <div style={{ fontSize: "0.85rem" }}>
                            {en.created_at ? new Date(en.created_at).toLocaleDateString() : "Recent"}
                          </div>
                        </td>
                        <td>
                          {en.status === "pending" && (
                            <span className="badge badge-warning flex items-center gap-1" style={{ width: "fit-content" }}>
                              <Clock size={12} /> Pending Review
                            </span>
                          )}
                          {en.status === "approved" && (
                            <span className="badge badge-success flex items-center gap-1" style={{ width: "fit-content" }}>
                              <CheckCircle2 size={12} /> Approved
                            </span>
                          )}
                          {en.status === "rejected" && (
                            <div>
                              <span className="badge badge-danger flex items-center gap-1" style={{ width: "fit-content" }}>
                                <XCircle size={12} /> Rejected
                              </span>
                              {en.rejection_reason && (
                                <div style={{ fontSize: "0.75rem", color: "#ef4444", marginTop: "3px", maxWidth: "200px" }}>
                                  {en.rejection_reason}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {en.status === "pending" ? (
                            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                              <button
                                onClick={() => setSelectedEnrollmentForApprove(en)}
                                className="btn-action"
                                style={{
                                  background: "#10b981",
                                  color: "#fff",
                                  border: "none",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  padding: "6px 12px",
                                  borderRadius: "6px",
                                  fontSize: "0.82rem",
                                  fontWeight: "600",
                                }}
                              >
                                <Check size={14} /> Approve
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedEnrollmentForReject(en);
                                  setEnrollmentRejectionReason("");
                                }}
                                className="btn-action"
                                style={{
                                  background: "transparent",
                                  color: "#ef4444",
                                  border: "1px solid #ef4444",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  padding: "6px 12px",
                                  borderRadius: "6px",
                                  fontSize: "0.82rem",
                                  fontWeight: "600",
                                }}
                              >
                                <X size={14} /> Reject
                              </button>
                            </div>
                          ) : en.status === "approved" ? (
                            <span style={{ fontSize: "0.8rem", color: "#10b981", fontWeight: "600" }}>Active Member</span>
                          ) : (
                            <button
                              onClick={() => setSelectedEnrollmentForApprove(en)}
                              className="btn-action"
                              style={{ fontSize: "0.78rem" }}
                            >
                              Re-approve
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: TEACHER REGISTRATION APPLICATIONS */}
      {activeTab === "teacher-apps" && (
        <div className="admin-tab-content">
          <div className="dashboard-section">
            <div className="section-header">
              <div>
                <h2>Teacher Registration Requests</h2>
                <p className="text-muted text-sm mt-1">
                  Manage faculty applications and institutional onboarding. Approving provisions an active teacher account in MongoDB.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="badge-count">
                  {filteredTeacherApps.length} of {teacherApps.length} Applications
                </span>
                <button
                  onClick={() => setShowCreateTeacherModal(true)}
                  className="btn-primary"
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <UserPlus size={16} /> Create Teacher
                </button>
              </div>
            </div>

            <div className="table-controls">
              <div className="search-bar">
                <Search size={18} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search by teacher name, email, institution, or department..."
                  value={teacherAppSearch}
                  onChange={(e) => setTeacherAppSearch(e.target.value)}
                />
              </div>

              <div className="filter-group">
                <Filter size={16} className="text-muted" />
                <select
                  value={teacherAppStatusFilter}
                  onChange={(e) => setTeacherAppStatusFilter(e.target.value)}
                >
                  <option value="all">All Application Statuses</option>
                  <option value="pending">Pending Review</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>

            {filteredTeacherApps.length === 0 ? (
              <div className="empty-state">
                <GraduationCap size={44} style={{ opacity: 0.4 }} />
                <h3>No Applications Found</h3>
                <p>
                  {teacherApps.length === 0
                    ? "No teacher registration requests have been submitted yet."
                    : "No applications match your current search or status filter."}
                </p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Applicant Details</th>
                      <th>Institution & Department</th>
                      <th>Submission Date</th>
                      <th>Status</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTeacherApps.map((app) => (
                      <tr key={app.id}>
                        <td>
                          <div style={{ fontWeight: "600", color: "var(--text-main, #0f172a)" }}>
                            {app.name}
                          </div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                              fontSize: "0.82rem",
                              color: "var(--text-muted, #64748b)",
                              marginTop: "2px",
                            }}
                          >
                            <Mail size={12} />
                            <code>{app.email}</code>
                          </div>
                          {app.bio && (
                            <div
                              style={{
                                fontSize: "0.78rem",
                                color: "var(--text-muted, #64748b)",
                                marginTop: "4px",
                                maxWidth: "260px",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                              title={app.bio}
                            >
                              Bio: {app.bio}
                            </div>
                          )}
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <Building2 size={14} style={{ color: "var(--primary-color, #6366f1)" }} />
                            <strong style={{ fontSize: "0.88rem" }}>{app.institution || "Not specified"}</strong>
                          </div>
                          <div style={{ fontSize: "0.82rem", color: "var(--text-muted, #64748b)", marginTop: "2px" }}>
                            {app.department || "General Faculty"}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontSize: "0.85rem" }}>
                            {app.created_at ? new Date(app.created_at).toLocaleDateString() : "Recent"}
                          </div>
                        </td>
                        <td>
                          {app.status === "pending" && (
                            <span className="badge badge-warning flex items-center gap-1" style={{ width: "fit-content" }}>
                              <Clock size={12} /> Pending Review
                            </span>
                          )}
                          {app.status === "approved" && (
                            <div>
                              <span className="badge badge-success flex items-center gap-1" style={{ width: "fit-content" }}>
                                <CheckCircle2 size={12} /> Approved
                              </span>
                              {app.reviewed_at && (
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted, #64748b)", marginTop: "2px" }}>
                                  {new Date(app.reviewed_at).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                          )}
                          {app.status === "rejected" && (
                            <div>
                              <span className="badge badge-danger flex items-center gap-1" style={{ width: "fit-content" }}>
                                <XCircle size={12} /> Rejected
                              </span>
                              {app.rejection_reason && (
                                <div
                                  style={{
                                    fontSize: "0.74rem",
                                    color: "#ef4444",
                                    marginTop: "3px",
                                    maxWidth: "200px",
                                    lineHeight: "1.3",
                                  }}
                                  title={app.rejection_reason}
                                >
                                  {app.rejection_reason}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {app.status === "pending" ? (
                            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                              <button
                                onClick={() => setSelectedAppForApprove(app)}
                                className="btn-action"
                                style={{
                                  background: "#10b981",
                                  color: "#fff",
                                  border: "none",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  padding: "6px 12px",
                                  borderRadius: "6px",
                                  fontSize: "0.82rem",
                                  fontWeight: "600",
                                }}
                              >
                                <CheckCircle2 size={14} /> Approve
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedAppForReject(app);
                                  setRejectionReason("");
                                }}
                                className="btn-action"
                                style={{
                                  background: "transparent",
                                  color: "#ef4444",
                                  border: "1px solid #ef4444",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  padding: "6px 12px",
                                  borderRadius: "6px",
                                  fontSize: "0.82rem",
                                  fontWeight: "600",
                                }}
                              >
                                <XCircle size={14} /> Reject
                              </button>
                            </div>
                          ) : app.status === "approved" ? (
                            <button
                              onClick={() => {
                                setUserSearch(app.email);
                                setActiveTab("users");
                              }}
                              className="btn-action"
                              style={{ fontSize: "0.8rem" }}
                            >
                              View User Account →
                            </button>
                          ) : (
                            <button
                              onClick={() => setSelectedAppForApprove(app)}
                              className="btn-action"
                              style={{
                                fontSize: "0.78rem",
                                color: "var(--primary-color, #6366f1)",
                                border: "1px solid rgba(99, 102, 241, 0.4)",
                                background: "transparent",
                                padding: "4px 8px",
                              }}
                            >
                              Reconsider & Approve
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 6: LECTURES */}
      {activeTab === "lectures" && (
        <div className="admin-tab-content">
          <div className="dashboard-section">
            <div className="section-header">
              <div>
                <h2>Lecture Corpus & Ingestion Monitor</h2>
                <p className="text-muted text-sm mt-1">
                  Audit AI transcription jobs, inspect failures, and remove unwanted lectures.
                </p>
              </div>
              <span className="badge-count">
                {filteredLectures.length} of {lectures.length} Lectures
              </span>
            </div>

            <div className="table-controls">
              <div className="search-bar">
                <Search size={18} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search by lecture title, course, or instructor..."
                  value={lectureSearch}
                  onChange={(e) => setLectureSearch(e.target.value)}
                />
              </div>

              <div className="filter-group">
                <Filter size={16} className="text-muted" />
                <select
                  value={lectureStatusFilter}
                  onChange={(e) => setLectureStatusFilter(e.target.value)}
                >
                  <option value="all">All States</option>
                  <option value="published">Published</option>
                  <option value="unpublished">Unpublished</option>
                  <option value="processing">Processing</option>
                  <option value="review_required">Review Required</option>
                  <option value="failed">Failed Jobs</option>
                </select>
              </div>
            </div>

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Title & Course</th>
                    <th>Instructor</th>
                    <th>Source</th>
                    <th>Pipeline State</th>
                    <th>Published</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLectures.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <div className="font-semibold text-main">{l.title}</div>
                        <div className="text-xs text-muted">
                          {l.course_title || "General"} · {l.segments?.length || 0} segments
                        </div>
                      </td>
                      <td className="text-sm">{l.teacher_name || "Faculty"}</td>
                      <td>
                        <span className="badge">
                          {l.source_type === "youtube" ? "📺 YouTube" : "📁 File"}
                        </span>
                      </td>
                      <td>
                        <StatusBadge status={l.status} />
                      </td>
                      <td>
                        <span
                          className={`badge ${l.is_published ? "badge-success" : "badge-warning"}`}
                        >
                          {l.is_published ? "Published" : "Draft"}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/teacher/lectures/${l.id}/review`}
                            className="btn-action"
                            title="Inspect pipeline artifacts"
                          >
                            <ExternalLink size={15} /> Review
                          </Link>
                          <button
                            onClick={() => setLectureToDelete(l)}
                            className="btn-action text-danger"
                            title="Purge lecture"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: SYSTEM TELEMETRY */}
      {activeTab === "system" && systemStatus && (
        <div className="admin-tab-content">
          <div className="settings-grid">
            <div className="settings-card">
              <div className="flex items-center gap-3 mb-4">
                <Database size={24} className="text-primary" />
                <div>
                  <h3 className="text-lg font-semibold">MongoDB Atlas Status</h3>
                  <p className="text-muted text-sm">Cluster connection & live collection telemetry</p>
                </div>
              </div>
              <div className="info-list">
                <div className="info-item">
                  <span className="info-label">Status</span>
                  <span className="badge badge-success flex items-center gap-1">
                    <CheckCircle2 size={13} /> {systemStatus.database_mode?.toUpperCase()}
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">Database Name</span>
                  <code>{systemStatus.database_name}</code>
                </div>
                <div className="info-item">
                  <span className="info-label">Environment</span>
                  <code>{systemStatus.environment}</code>
                </div>
              </div>

              <h4 className="mt-4 mb-2 text-sm font-semibold uppercase text-muted">Collections Volume</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(systemStatus.collections || {}).map(([col, count]) => (
                  <div key={col} className="p-2 bg-slate-50 rounded flex justify-between">
                    <span className="text-muted">{col}:</span>
                    <strong>{count} docs</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="settings-card">
              <div className="flex items-center gap-3 mb-4">
                <Cpu size={24} className="text-primary" />
                <div>
                  <h3 className="text-lg font-semibold">AI Models & Hardware Configuration</h3>
                  <p className="text-muted text-sm">Speech recognition & multilingual embedding engine</p>
                </div>
              </div>
              <div className="info-list">
                <div className="info-item">
                  <span className="info-label">Whisper Engine</span>
                  <strong>Faster-Whisper ({systemStatus.whisper_config?.model_size})</strong>
                </div>
                <div className="info-item">
                  <span className="info-label">Inference Hardware</span>
                  <code>{systemStatus.whisper_config?.device} ({systemStatus.whisper_config?.compute_type})</code>
                </div>
                <div className="info-item">
                  <span className="info-label">Embedding Model</span>
                  <strong>{systemStatus.embedding_config?.model_name}</strong>
                </div>
                <div className="info-item">
                  <span className="info-label">Vector Dimension</span>
                  <code>{systemStatus.embedding_config?.dimension} dims</code>
                </div>
                <div className="info-item">
                  <span className="info-label">Atlas Vector Index</span>
                  <code>{systemStatus.embedding_config?.vector_index_name}</code>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODALS SECTION */}
      {/* ========================================================= */}

      {/* MODAL: EDIT USER ROLE / STATUS */}
      {selectedUserForEdit && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Edit User Account</h3>
              <button onClick={() => setSelectedUserForEdit(null)} className="btn-close">
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p className="text-sm text-muted mb-4">
                Managing authorization for <strong>{selectedUserForEdit.name}</strong> ({selectedUserForEdit.email})
              </p>

              <div className="form-group mb-3">
                <label>Platform Role:</label>
                <select value={newRole} onChange={(e) => setNewRole(e.target.value)}>
                  <option value="student">Student</option>
                  <option value="teacher">Teacher (Instructor)</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              <div className="form-group mb-4">
                <label>Account Status:</label>
                <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setSelectedUserForEdit(null)} className="btn-secondary">
                Cancel
              </button>
              <button onClick={handleUpdateUser} className="btn-primary">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DELETE USER CONFIRMATION */}
      {userToDelete && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="text-danger flex items-center gap-2">
                <AlertTriangle size={20} /> Confirm Account Deletion
              </h3>
              <button onClick={() => setUserToDelete(null)} className="btn-close">
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to permanently delete user account <strong>{userToDelete.email}</strong>?
              </p>
              <p className="text-sm text-danger mt-2">
                This action is irreversible and will remove all their enrollments and quiz attempts.
              </p>
            </div>
            <div className="modal-footer">
              <button onClick={() => setUserToDelete(null)} className="btn-secondary">
                Cancel
              </button>
              <button onClick={handleDeleteUser} className="btn-danger">
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DELETE LECTURE CONFIRMATION */}
      {lectureToDelete && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="text-danger flex items-center gap-2">
                <AlertTriangle size={20} /> Delete Lecture & AI Assets
              </h3>
              <button onClick={() => setLectureToDelete(null)} className="btn-close">
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to delete <strong>"{lectureToDelete.title}"</strong>?
              </p>
              <p className="text-sm text-danger mt-2">
                This will delete all timestamped transcripts, topics, summaries, quizzes, and Atlas vector embeddings.
              </p>
            </div>
            <div className="modal-footer">
              <button onClick={() => setLectureToDelete(null)} className="btn-secondary">
                Cancel
              </button>
              <button onClick={handleDeleteLecture} className="btn-danger">
                Delete Lecture
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE TEACHER PROFILE */}
      {showCreateTeacherModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: "620px", maxHeight: "90vh", overflowY: "auto" }}>
            <div className="modal-header">
              <h3 className="flex items-center gap-2">
                <UserPlus size={20} className="text-primary" /> Create Teacher Profile
              </h3>
              <button onClick={() => setShowCreateTeacherModal(false)} className="btn-close">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateTeacher}>
              <div className="modal-body">
                <p className="text-sm text-muted mb-3">
                  Provision an official faculty account, assign courses, and generate a secure activation link.
                </p>

                <div className="form-group mb-3">
                  <label>Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Prof. Alan Turing"
                    value={teacherName}
                    onChange={(e) => setTeacherName(e.target.value)}
                  />
                </div>

                <div className="form-group mb-3">
                  <label>Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. aturing@lecturelens.edu"
                    value={teacherEmail}
                    onChange={(e) => setTeacherEmail(e.target.value)}
                  />
                  <small className="help-text">Must be unique across the platform.</small>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div className="form-group">
                    <label>Phone Number (Optional)</label>
                    <input
                      type="tel"
                      placeholder="e.g. +1 555-0199"
                      value={teacherPhone}
                      onChange={(e) => setTeacherPhone(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Department (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Computer Science"
                      value={teacherDept}
                      onChange={(e) => setTeacherDept(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div className="form-group">
                    <label>Institution (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. LectureLens University"
                      value={teacherInstitution}
                      onChange={(e) => setTeacherInstitution(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Profile Photograph URL (Optional)</label>
                    <input
                      type="url"
                      placeholder="https://example.com/avatar.jpg"
                      value={teacherAvatarUrl}
                      onChange={(e) => setTeacherAvatarUrl(e.target.value)}
                    />
                  </div>
                </div>

                {/* Course Selection: Multi-select Checkboxes */}
                <div className="form-group mb-3">
                  <div className="flex items-center justify-between mb-1" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <label style={{ margin: 0, fontWeight: 600 }}>Assign Active Courses ({selectedCourseIds.length} selected)</label>
                    {adminCourses.length > 0 && (
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          type="button"
                          className="text-xs text-primary"
                          style={{ background: "none", border: "none", cursor: "pointer", textDecoration: "underline", color: "#6366f1" }}
                          onClick={() => setSelectedCourseIds(adminCourses.map((c) => c.id))}
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          className="text-xs text-muted"
                          style={{ background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
                          onClick={() => setSelectedCourseIds([])}
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      maxHeight: "150px",
                      overflowY: "auto",
                      border: "1px solid var(--border-color, #e2e8f0)",
                      borderRadius: "8px",
                      padding: "8px 12px",
                      background: "var(--card-bg, #f8fafc)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    }}
                  >
                    {adminCourses.length === 0 ? (
                      <span className="text-xs text-muted">No active courses found. You can create courses in the Courses tab.</span>
                    ) : (
                      adminCourses.map((c) => {
                        const isChecked = selectedCourseIds.includes(c.id);
                        return (
                          <label
                            key={c.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              fontSize: "0.85rem",
                              cursor: "pointer",
                              padding: "4px 6px",
                              borderRadius: "4px",
                              background: isChecked ? "rgba(99, 102, 241, 0.08)" : "transparent",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedCourseIds([...selectedCourseIds, c.id]);
                                } else {
                                  setSelectedCourseIds(selectedCourseIds.filter((id) => id !== c.id));
                                }
                              }}
                            />
                            <strong>{c.code}:</strong> {c.title}
                          </label>
                        );
                      })
                    )}
                  </div>
                  <small className="help-text">Assigned faculty can upload lectures and manage quizzes for these courses.</small>
                </div>

                {/* Password / Invitation Setup */}
                <div className="form-group mb-3" style={{ borderTop: "1px solid var(--border-color, #e2e8f0)", paddingTop: "12px" }}>
                  <label style={{ fontWeight: 600 }}>Password Establishment Method</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "6px" }}>
                    <label style={{ display: "flex", alignItems: "flex-start", gap: "8px", cursor: "pointer", fontSize: "0.85rem" }}>
                      <input
                        type="radio"
                        name="pwdMode"
                        value="invitation"
                        checked={teacherPasswordMode === "invitation"}
                        onChange={() => setTeacherPasswordMode("invitation")}
                        style={{ marginTop: "3px" }}
                      />
                      <div>
                        <strong>Generate secure activation invitation (Recommended)</strong>
                        <div className="text-xs text-muted">
                          Generates a secure 7-day link for the instructor to establish their own password securely.
                        </div>
                      </div>
                    </label>

                    <label style={{ display: "flex", alignItems: "flex-start", gap: "8px", cursor: "pointer", fontSize: "0.85rem" }}>
                      <input
                        type="radio"
                        name="pwdMode"
                        value="manual"
                        checked={teacherPasswordMode === "manual"}
                        onChange={() => setTeacherPasswordMode("manual")}
                        style={{ marginTop: "3px" }}
                      />
                      <div>
                        <strong>Set initial temporary password manually</strong>
                        <div className="text-xs text-muted">
                          Enter a temporary password to provide directly to the faculty member.
                        </div>
                      </div>
                    </label>
                  </div>

                  {teacherPasswordMode === "manual" && (
                    <div style={{ marginTop: "10px" }}>
                      <input
                        type="password"
                        required
                        minLength={6}
                        placeholder="Enter password (minimum 6 characters)"
                        value={teacherPassword}
                        onChange={(e) => setTeacherPassword(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowCreateTeacherModal(false)}
                  className="btn-secondary"
                  disabled={creatingTeacher}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={creatingTeacher}
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <UserPlus size={16} />
                  {creatingTeacher ? "Creating Teacher Profile..." : "Create Teacher Profile"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: TEACHER CREATED / INVITATION SUCCESS */}
      {createdTeacherResult && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: "540px" }}>
            <div className="modal-header">
              <h3 className="flex items-center gap-2" style={{ color: "#10b981" }}>
                <CheckCircle2 size={20} /> Faculty Account Ready
              </h3>
              <button onClick={() => setCreatedTeacherResult(null)} className="btn-close">
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ margin: "0 0 12px" }}>
                Faculty profile for <strong>{createdTeacherResult.name}</strong> ({createdTeacherResult.email}) has been provisioned.
              </p>

              {createdTeacherResult.assigned_courses?.length > 0 && (
                <div style={{ marginBottom: "14px" }}>
                  <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted, #64748b)", marginBottom: "4px" }}>
                    ASSIGNED COURSES:
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                    {createdTeacherResult.assigned_courses.map((c) => (
                      <span
                        key={c.id || c.code}
                        style={{
                          fontSize: "0.78rem",
                          padding: "3px 8px",
                          borderRadius: "4px",
                          background: "rgba(99, 102, 241, 0.08)",
                          border: "1px solid rgba(99, 102, 241, 0.2)",
                        }}
                      >
                        <strong>{c.code}:</strong> {c.title}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {createdTeacherResult.invitation_link && (
                <div
                  style={{
                    background: "rgba(99, 102, 241, 0.06)",
                    border: "1px solid rgba(99, 102, 241, 0.2)",
                    borderRadius: "8px",
                    padding: "12px",
                    marginTop: "10px",
                  }}
                >
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#6366f1", marginBottom: "6px" }}>
                    TEACHER ACTIVATION & PASSWORD-SETUP INVITATION LINK (Valid for 7 days):
                  </label>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <input
                      type="text"
                      readOnly
                      value={
                        createdTeacherResult.invitation_link.startsWith("http")
                          ? createdTeacherResult.invitation_link
                          : `${window.location.origin}${createdTeacherResult.invitation_link}`
                      }
                      style={{ fontSize: "0.82rem", background: "#fff" }}
                    />
                    <button
                      type="button"
                      className="btn-primary"
                      style={{ whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: "4px" }}
                      onClick={() =>
                        copyToClipboard(
                          createdTeacherResult.invitation_link.startsWith("http")
                            ? createdTeacherResult.invitation_link
                            : `${window.location.origin}${createdTeacherResult.invitation_link}`
                        )
                      }
                    >
                      <Copy size={14} />
                      {copiedLink ? "Copied!" : "Copy Link"}
                    </button>
                  </div>
                  <small className="help-text" style={{ marginTop: "6px", display: "block" }}>
                    Share this link with the instructor. They can click it to securely establish their password and immediately start managing course lectures.
                  </small>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                onClick={() => setCreatedTeacherResult(null)}
                className="btn-primary"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT TEACHER PROFILE & COURSES */}
      {showEditTeacherModal && editingTeacher && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: "620px", maxHeight: "90vh", overflowY: "auto" }}>
            <div className="modal-header">
              <h3 className="flex items-center gap-2">
                <Edit size={20} className="text-primary" /> Edit Teacher Profile
              </h3>
              <button onClick={() => setShowEditTeacherModal(false)} className="btn-close">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveTeacherEdit}>
              <div className="modal-body">
                <div className="form-group mb-3">
                  <label>Full Name *</label>
                  <input
                    type="text"
                    required
                    value={editTeacherName}
                    onChange={(e) => setEditTeacherName(e.target.value)}
                  />
                </div>

                <div className="form-group mb-3">
                  <label>Email Address</label>
                  <input
                    type="email"
                    disabled
                    value={editTeacherEmail}
                    style={{ background: "var(--input-disabled, #f1f5f9)", cursor: "not-allowed" }}
                  />
                  <small className="help-text">Email address cannot be changed.</small>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div className="form-group">
                    <label>Phone Number</label>
                    <input
                      type="tel"
                      placeholder="e.g. +1 555-0199"
                      value={editTeacherPhone}
                      onChange={(e) => setEditTeacherPhone(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Account Status</label>
                    <select
                      value={editTeacherStatus}
                      onChange={(e) => setEditTeacherStatus(e.target.value)}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="pending_activation">Pending Activation</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div className="form-group">
                    <label>Department</label>
                    <input
                      type="text"
                      placeholder="e.g. Computer Science"
                      value={editTeacherDept}
                      onChange={(e) => setEditTeacherDept(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Institution</label>
                    <input
                      type="text"
                      placeholder="e.g. LectureLens University"
                      value={editTeacherInstitution}
                      onChange={(e) => setEditTeacherInstitution(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group mb-3">
                  <label>Profile Photograph URL</label>
                  <input
                    type="url"
                    placeholder="https://example.com/avatar.jpg"
                    value={editTeacherAvatar}
                    onChange={(e) => setEditTeacherAvatar(e.target.value)}
                  />
                </div>

                <div className="form-group mb-3">
                  <label>Biography</label>
                  <textarea
                    rows={2}
                    placeholder="Brief teacher bio or credentials..."
                    value={editTeacherBio}
                    onChange={(e) => setEditTeacherBio(e.target.value)}
                  />
                </div>

                {/* Course Assignments Checklist */}
                <div className="form-group mb-3">
                  <div className="flex items-center justify-between mb-1" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <label style={{ margin: 0, fontWeight: 600 }}>Manage Assigned Courses ({editTeacherCourseIds.length} assigned)</label>
                    {adminCourses.length > 0 && (
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          type="button"
                          className="text-xs text-primary"
                          style={{ background: "none", border: "none", cursor: "pointer", textDecoration: "underline", color: "#6366f1" }}
                          onClick={() => setEditTeacherCourseIds(adminCourses.map((c) => c.id))}
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          className="text-xs text-muted"
                          style={{ background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
                          onClick={() => setEditTeacherCourseIds([])}
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      maxHeight: "150px",
                      overflowY: "auto",
                      border: "1px solid var(--border-color, #e2e8f0)",
                      borderRadius: "8px",
                      padding: "8px 12px",
                      background: "var(--card-bg, #f8fafc)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    }}
                  >
                    {adminCourses.length === 0 ? (
                      <span className="text-xs text-muted">No active courses found.</span>
                    ) : (
                      adminCourses.map((c) => {
                        const isChecked = editTeacherCourseIds.includes(c.id);
                        return (
                          <label
                            key={c.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              fontSize: "0.85rem",
                              cursor: "pointer",
                              padding: "4px 6px",
                              borderRadius: "4px",
                              background: isChecked ? "rgba(99, 102, 241, 0.08)" : "transparent",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setEditTeacherCourseIds([...editTeacherCourseIds, c.id]);
                                } else {
                                  setEditTeacherCourseIds(editTeacherCourseIds.filter((id) => id !== c.id));
                                }
                              }}
                            />
                            <strong>{c.code}:</strong> {c.title}
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowEditTeacherModal(false)}
                  className="btn-secondary"
                  disabled={savingTeacherEdit}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={savingTeacherEdit}
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <Check size={16} />
                  {savingTeacherEdit ? "Saving Changes..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE COURSE */}
      {showCreateCourseModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="flex items-center gap-2">
                <BookOpen size={20} className="text-primary" /> Create New Course
              </h3>
              <button onClick={() => setShowCreateCourseModal(false)} className="btn-close">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateCourse}>
              <div className="modal-body">
                <div className="form-group mb-3">
                  <label>Course Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CS 501: Deep Learning & Neural Networks"
                    value={newCourseTitle}
                    onChange={(e) => setNewCourseTitle(e.target.value)}
                  />
                </div>

                <div className="form-group mb-3">
                  <label>Course Code (Unique Identifier) *</label>
                  <input
                    type="text"
                    placeholder="e.g. CS501 (Leave blank to auto-generate)"
                    value={newCourseCode}
                    onChange={(e) => setNewCourseCode(e.target.value.toUpperCase())}
                  />
                  <small className="help-text">Unique code used for student enrollment queries.</small>
                </div>

                <div className="form-group mb-3">
                  <label>Description</label>
                  <textarea
                    rows={3}
                    placeholder="Syllabus, topics, prerequisites, and learning objectives..."
                    value={newCourseDesc}
                    onChange={(e) => setNewCourseDesc(e.target.value)}
                  />
                </div>

                <div className="form-group mb-2">
                  <label>Initial Status:</label>
                  <select
                    value={newCourseStatus}
                    onChange={(e) => setNewCourseStatus(e.target.value)}
                  >
                    <option value="active">Active (Accepts student/teacher enrollment requests)</option>
                    <option value="inactive">Inactive (Archived / Closed to new enrollments)</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowCreateCourseModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create Course
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT COURSE */}
      {courseToEdit && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="flex items-center gap-2">
                <Edit size={20} className="text-primary" /> Edit Course Details
              </h3>
              <button onClick={() => setCourseToEdit(null)} className="btn-close">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleUpdateCourse}>
              <div className="modal-body">
                <div className="form-group mb-3">
                  <label>Course Title</label>
                  <input
                    type="text"
                    required
                    value={courseToEdit.title}
                    onChange={(e) => setCourseToEdit({ ...courseToEdit, title: e.target.value })}
                  />
                </div>

                <div className="form-group mb-3">
                  <label>Course Code</label>
                  <input
                    type="text"
                    required
                    value={courseToEdit.code}
                    onChange={(e) => setCourseToEdit({ ...courseToEdit, code: e.target.value.toUpperCase() })}
                  />
                </div>

                <div className="form-group mb-3">
                  <label>Description</label>
                  <textarea
                    rows={3}
                    value={courseToEdit.description || ""}
                    onChange={(e) => setCourseToEdit({ ...courseToEdit, description: e.target.value })}
                  />
                </div>

                <div className="form-group mb-2">
                  <label>Status</label>
                  <select
                    value={courseToEdit.status}
                    onChange={(e) => setCourseToEdit({ ...courseToEdit, status: e.target.value })}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setCourseToEdit(null)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DELETE COURSE CONFIRMATION */}
      {courseToDelete && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="text-danger flex items-center gap-2">
                <AlertTriangle size={20} /> Delete Course
              </h3>
              <button onClick={() => setCourseToDelete(null)} className="btn-close">
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to delete course <strong>"{courseToDelete.title}"</strong> ({courseToDelete.code})?
              </p>
              <div style={{ background: "rgba(239, 68, 68, 0.08)", padding: "12px", borderRadius: "8px", margin: "14px 0" }}>
                <p className="text-sm text-danger m-0">
                  <strong>Dependency Check:</strong> This course contains {courseToDelete.lecture_count} lecture(s) and {courseToDelete.student_count} enrolled student(s).
                </p>
              </div>
              {courseToDelete.lecture_count > 0 && (
                <label className="flex items-center gap-2 mt-3 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={forceDeleteCourse}
                    onChange={(e) => setForceDeleteCourse(e.target.checked)}
                  />
                  <span>Force delete and cascade remove all {courseToDelete.lecture_count} lectures and student enrollments.</span>
                </label>
              )}
            </div>
            <div className="modal-footer">
              <button onClick={() => setCourseToDelete(null)} className="btn-secondary">
                Cancel
              </button>
              <button
                onClick={handleDeleteCourse}
                disabled={courseToDelete.lecture_count > 0 && !forceDeleteCourse}
                className="btn-danger"
              >
                Delete Course
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: COURSE MEMBERS & REQUESTS */}
      {activeCourseMembers && (
        <div className="modal-backdrop">
          <div className="modal-card max-w-2xl" style={{ maxHeight: "85vh", overflowY: "auto" }}>
            <div className="modal-header">
              <div>
                <h3 className="flex items-center gap-2">
                  <Users size={20} className="text-primary" /> Members: {activeCourseMembers.course_title}
                </h3>
                <span className="text-xs text-muted">Code: {activeCourseMembers.course_code}</span>
              </div>
              <button onClick={() => setActiveCourseMembers(null)} className="btn-close">
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              {/* Assign Teacher to this Course */}
              <div
                style={{
                  background: "rgba(99, 102, 241, 0.07)",
                  border: "1px solid rgba(99, 102, 241, 0.25)",
                  borderRadius: "8px",
                  padding: "12px 14px",
                  marginBottom: "16px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                  <UserPlus size={16} style={{ color: "var(--primary-color, #6366f1)" }} />
                  <strong style={{ fontSize: "0.88rem", color: "var(--text-main, #0f172a)" }}>
                    Assign Faculty / Teacher to this Course
                  </strong>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <select
                    style={{ flex: 1, padding: "8px", fontSize: "0.85rem", borderRadius: "6px", border: "1px solid var(--border-color, #cbd5e1)" }}
                    value={selectedTeacherToAssign}
                    onChange={(e) => setSelectedTeacherToAssign(e.target.value)}
                  >
                    <option value="">Select a registered Teacher...</option>
                    {users
                      .filter((u) => u.role === "teacher" && !activeCourseMembers.teachers?.some((t) => t.id === u.id))
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.email})
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    disabled={!selectedTeacherToAssign || assigningTeacher}
                    onClick={handleAssignTeacherToCourse}
                    className="btn-primary"
                    style={{ whiteSpace: "nowrap", padding: "8px 14px", fontSize: "0.85rem" }}
                  >
                    {assigningTeacher ? "Assigning..." : "Assign Teacher"}
                  </button>
                </div>
              </div>

              {/* Enrolled Instructors */}
              <div className="mb-4">
                <h4 className="text-sm font-semibold uppercase text-muted mb-2">
                  Instructors ({activeCourseMembers.teachers?.length || 0})
                </h4>
                {activeCourseMembers.teachers?.length === 0 ? (
                  <p className="text-sm text-muted">No instructors assigned.</p>
                ) : (
                  <div className="space-y-2">
                    {activeCourseMembers.teachers?.map((t) => (
                      <div key={t.id} className="flex justify-between items-center p-2 bg-slate-50 rounded border">
                        <div>
                          <strong>{t.name}</strong> <code className="text-xs">{t.email}</code>
                        </div>
                        <button
                          onClick={() => handleRemoveMember(t.id, t.name)}
                          className="btn-action text-danger"
                          title="Remove instructor"
                        >
                          <UserMinus size={14} /> Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Enrolled Students */}
              <div className="mb-4">
                <h4 className="text-sm font-semibold uppercase text-muted mb-2">
                  Enrolled Students ({activeCourseMembers.students?.length || 0})
                </h4>
                {activeCourseMembers.students?.length === 0 ? (
                  <p className="text-sm text-muted">No students currently enrolled in this course.</p>
                ) : (
                  <div className="space-y-2" style={{ maxHeight: "200px", overflowY: "auto" }}>
                    {activeCourseMembers.students?.map((s) => (
                      <div key={s.id} className="flex justify-between items-center p-2 bg-slate-50 rounded border">
                        <div>
                          <strong>{s.name}</strong> <code className="text-xs">{s.email}</code>
                        </div>
                        <button
                          onClick={() => handleRemoveMember(s.id, s.name)}
                          className="btn-action text-danger"
                          title="Remove student"
                        >
                          <UserMinus size={14} /> Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pending Requests for this course */}
              <div>
                <h4 className="text-sm font-semibold uppercase text-muted mb-2">
                  Pending Enrollment Requests ({activeCourseMembers.pending_requests?.length || 0})
                </h4>
                {activeCourseMembers.pending_requests?.length === 0 ? (
                  <p className="text-sm text-muted">No pending requests for this course.</p>
                ) : (
                  <div className="space-y-2">
                    {activeCourseMembers.pending_requests?.map((req) => (
                      <div key={req.id} className="flex justify-between items-center p-2 bg-amber-50 rounded border border-amber-200">
                        <div>
                          <strong>{req.user_name}</strong> ({req.user_role}) · <code>{req.user_email}</code>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setSelectedEnrollmentForApprove(req)}
                            className="btn-action text-success"
                            style={{ background: "#10b981", color: "#fff", border: "none" }}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => {
                              setSelectedEnrollmentForReject(req);
                              setEnrollmentRejectionReason("");
                            }}
                            className="btn-action text-danger"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setActiveCourseMembers(null)} className="btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: APPROVE TEACHER APPLICATION */}
      {selectedAppForApprove && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="flex items-center gap-2" style={{ color: "#10b981" }}>
                <CheckCircle2 size={20} /> Approve Faculty Registration
              </h3>
              <button onClick={() => setSelectedAppForApprove(null)} className="btn-close">
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to approve the instructor application for <strong>{selectedAppForApprove.name}</strong>?
              </p>
              <div style={{ background: "rgba(16, 185, 129, 0.08)", padding: "12px", borderRadius: "8px", margin: "14px 0", fontSize: "0.88rem" }}>
                <div>Email: <strong>{selectedAppForApprove.email}</strong></div>
                <div>Institution: <strong>{selectedAppForApprove.institution || "N/A"}</strong></div>
                <div>Department: <strong>{selectedAppForApprove.department || "General"}</strong></div>
              </div>
              <p className="text-sm text-muted">
                This provisions an active teacher account in MongoDB with the role <code>teacher</code>.
              </p>
            </div>
            <div className="modal-footer">
              <button onClick={() => setSelectedAppForApprove(null)} className="btn-secondary">
                Cancel
              </button>
              <button
                onClick={handleApproveTeacherApp}
                disabled={processingId === selectedAppForApprove.id}
                className="btn-primary"
                style={{ background: "#10b981", borderColor: "#10b981" }}
              >
                {processingId === selectedAppForApprove.id ? "Activating..." : "Approve & Activate Account"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REJECT TEACHER APPLICATION */}
      {selectedAppForReject && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="text-danger flex items-center gap-2">
                <XCircle size={20} /> Reject Faculty Registration
              </h3>
              <button onClick={() => setSelectedAppForReject(null)} className="btn-close">
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p>Rejecting application from <strong>{selectedAppForReject.name}</strong> (<code>{selectedAppForReject.email}</code>).</p>
              <div className="form-group mt-3 mb-3">
                <label style={{ fontWeight: "600" }}>Reason for Rejection (Visible to Applicant):</label>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Institutional email required or faculty credentials could not be verified."
                />
              </div>
              <p className="text-sm text-danger">No active teacher account will be created.</p>
            </div>
            <div className="modal-footer">
              <button onClick={() => setSelectedAppForReject(null)} className="btn-secondary">
                Cancel
              </button>
              <button
                onClick={handleRejectTeacherApp}
                disabled={processingId === selectedAppForReject.id}
                className="btn-danger"
              >
                {processingId === selectedAppForReject.id ? "Rejecting..." : "Reject Application"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: APPROVE COURSE ENROLLMENT */}
      {selectedEnrollmentForApprove && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="flex items-center gap-2" style={{ color: "#10b981" }}>
                <CheckCircle2 size={20} /> Approve Course Enrollment
              </h3>
              <button onClick={() => setSelectedEnrollmentForApprove(null)} className="btn-close">
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                Grant course access to <strong>{selectedEnrollmentForApprove.user_name}</strong> ({selectedEnrollmentForApprove.user_email})?
              </p>
              <div style={{ background: "rgba(16, 185, 129, 0.08)", padding: "12px", borderRadius: "8px", margin: "14px 0", fontSize: "0.88rem" }}>
                <div>Course: <strong>{selectedEnrollmentForApprove.course_title}</strong></div>
                <div>Code: <strong>{selectedEnrollmentForApprove.course_code}</strong></div>
                <div>Requested Role: <strong>{selectedEnrollmentForApprove.user_role?.toUpperCase()}</strong></div>
              </div>
              <p className="text-sm text-muted">
                On approval, this user will gain immediate access to view published lectures, assignments, and quizzes for this course.
              </p>
            </div>
            <div className="modal-footer">
              <button onClick={() => setSelectedEnrollmentForApprove(null)} className="btn-secondary">
                Cancel
              </button>
              <button
                onClick={handleApproveEnrollment}
                disabled={processingId === selectedEnrollmentForApprove.id}
                className="btn-primary"
                style={{ background: "#10b981", borderColor: "#10b981" }}
              >
                {processingId === selectedEnrollmentForApprove.id ? "Approving..." : "Confirm & Approve Access"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REJECT COURSE ENROLLMENT */}
      {selectedEnrollmentForReject && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="text-danger flex items-center gap-2">
                <XCircle size={20} /> Reject Course Enrollment
              </h3>
              <button onClick={() => setSelectedEnrollmentForReject(null)} className="btn-close">
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                Declining enrollment for <strong>{selectedEnrollmentForReject.user_name}</strong> in <strong>{selectedEnrollmentForReject.course_title}</strong>.
              </p>
              <div className="form-group mt-3 mb-3">
                <label style={{ fontWeight: "600" }}>Reason for Rejection (Visible to Applicant):</label>
                <textarea
                  rows={3}
                  value={enrollmentRejectionReason}
                  onChange={(e) => setEnrollmentRejectionReason(e.target.value)}
                  placeholder="e.g. Course enrollment capacity reached or prerequisite requirements not met."
                />
              </div>
              <p className="text-sm text-danger">The user will not be granted access to this course workspace.</p>
            </div>
            <div className="modal-footer">
              <button onClick={() => setSelectedEnrollmentForReject(null)} className="btn-secondary">
                Cancel
              </button>
              <button
                onClick={handleRejectEnrollment}
                disabled={processingId === selectedEnrollmentForReject.id}
                className="btn-danger"
              >
                {processingId === selectedEnrollmentForReject.id ? "Rejecting..." : "Reject Enrollment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
