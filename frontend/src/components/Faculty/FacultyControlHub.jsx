import React, { useState, useEffect, useMemo, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChalkboardUser,
  faBullhorn,
  faStopwatch,
  faUsers,
  faFileExcel,
  faPlus,
  faTrashCan,
  faSearch,
  faFilter,
  faCheckCircle,
  faTriangleExclamation,
  faSpinner,
  faArrowRotateRight,
  faBuildingColumns,
  faListCheck,
  faGraduationCap,
  faCalendarCheck,
  faArrowLeft,
  faArrowRight,
  faUserTie,
  faShieldHalved,
  faEnvelope,
  faIdBadge,
} from "@fortawesome/free-solid-svg-icons";
import { useAuth } from "../../contexts/AuthContext";
import { useNotification } from "../../contexts/NotificationContext";
import { isAdminUser } from "../../constants/admins";
import {
  fetchFacultyStats,
  fetchFacultyReminders,
  dispatchFacultyReminder,
  deleteFacultyReminder,
  fetchFacultyQuizzes,
  createFacultyQuiz,
  deleteFacultyQuiz,
  fetchFacultyStudents,
  fetchPracticeProblems,
  fetchRegisteredFaculties,
} from "../../services/api";
import ProblemImportModal from "../Practice/ProblemImportModal.jsx";
import BackgroundPaths from "../BackgroundPaths/BackgroundPaths.jsx";
import Footer from "../Common/Footer/Footer.jsx";
import "./FacultyControlHub.css";

const DEPARTMENTS = [
  "ALL",
  "Centre for Artificial Intelligence",
  "Centre for Computer Science and Technology",
  "Centre for Internet of Things",
  "Computer Science & Design",
  "School of Architecture",
  "School of Chemical Engineering",
  "School of Civil Engineering",
  "School of Computer Science & Engineering",
  "School of Electrical Engineering",
  "School of Electronics and Communication Engineering",
  "School of Engineering Mathematics & Computing",
  "School of Humanities and Management",
  "School of Information Technology",
  "School of Mechanical Engineering",
];

const BATCH_YEARS = ["ALL", "2024", "2025", "2026", "2027", "2028"];

export default function FacultyControlHub() {
  const { user, profileData } = useAuth();
  const { notify } = useNotification();

  const isSuperAdmin = Boolean(isAdminUser(user) || profileData?.role === "ADMIN");

  // Super Admin Faculty Navigation State
  const [selectedFaculty, setSelectedFaculty] = useState(null);
  const [facultiesList, setFacultiesList] = useState([]);
  const [loadingFaculties, setLoadingFaculties] = useState(false);
  const [facultySearch, setFacultySearch] = useState("");
  const [facultyDeptFilter, setFacultyDeptFilter] = useState("ALL");

  // Active Tab: "reminders" | "quizzes" | "students" | "problems"
  const [activeTab, setActiveTab] = useState("reminders");

  // Overview Stats
  const [stats, setStats] = useState({
    totalStudents: 0,
    activeQuizzes: 0,
    dispatchedReminders: 0,
    departmentBreakdown: {},
  });
  const [loadingStats, setLoadingStats] = useState(true);

  // Tab 1: Reminders State
  const [reminders, setReminders] = useState([]);
  const [loadingReminders, setLoadingReminders] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [reminderForm, setReminderForm] = useState({
    title: "",
    message: "",
    targetDept: "ALL",
    targetBatch: "ALL",
    priority: "INFO",
  });

  // Tab 2: Quizzes State
  const [quizzes, setQuizzes] = useState([]);
  const [loadingQuizzes, setLoadingQuizzes] = useState(false);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [creatingQuiz, setCreatingQuiz] = useState(false);
  const [quizForm, setQuizForm] = useState({
    title: "",
    description: "",
    durationMinutes: 45,
    eligibleDept: "ALL",
    eligibleBatch: "ALL",
    selectedProblemIds: [],
  });

  // Tab 3: Students Directory & Eligibility Filter
  const [students, setStudents] = useState([]);
  const [studentPagination, setStudentPagination] = useState({ total: 0, page: 1, limit: 50 });
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [filterDept, setFilterDept] = useState("ALL");
  const [filterBatch, setFilterBatch] = useState("ALL");
  const [studentSearch, setStudentSearch] = useState("");

  // Tab 4 / Global: Problem Library & Import Modal
  const [allProblems, setAllProblems] = useState([]);
  const [showImportModal, setShowImportModal] = useState(false);

  const activeFacultyId = selectedFaculty ? selectedFaculty.id : "";

  // 0. Fetch Registered Faculties for Super Admin Directory
  const loadFaculties = useCallback(async () => {
    try {
      setLoadingFaculties(true);
      const res = await fetchRegisteredFaculties({
        search: facultySearch,
        department: facultyDeptFilter,
      });
      if (Array.isArray(res?.faculties)) {
        setFacultiesList(res.faculties);
      }
    } catch {
      // Handled gracefully
    } finally {
      setLoadingFaculties(false);
    }
  }, [facultySearch, facultyDeptFilter]);

  // 1. Fetch Stats
  const loadStats = useCallback(async (facultyId = activeFacultyId) => {
    try {
      setLoadingStats(true);
      const res = await fetchFacultyStats(facultyId);
      if (res?.stats) {
        setStats(res.stats);
      }
    } catch {
      // Handled gracefully
    } finally {
      setLoadingStats(false);
    }
  }, [activeFacultyId]);

  // 2. Fetch Reminders
  const loadReminders = useCallback(async (facultyId = activeFacultyId) => {
    try {
      setLoadingReminders(true);
      const res = await fetchFacultyReminders(facultyId);
      if (Array.isArray(res?.reminders)) {
        setReminders(res.reminders);
      }
    } catch {
      // Handled gracefully
    } finally {
      setLoadingReminders(false);
    }
  }, [activeFacultyId]);

  // 3. Fetch Quizzes
  const loadQuizzes = useCallback(async (facultyId = activeFacultyId) => {
    try {
      setLoadingQuizzes(true);
      const res = await fetchFacultyQuizzes(facultyId);
      if (Array.isArray(res?.quizzes)) {
        setQuizzes(res.quizzes);
      }
    } catch {
      // Handled gracefully
    } finally {
      setLoadingQuizzes(false);
    }
  }, [activeFacultyId]);

  // 4. Fetch Students
  const loadStudents = useCallback(async (facultyId = activeFacultyId) => {
    try {
      setLoadingStudents(true);
      const res = await fetchFacultyStudents({
        department: filterDept,
        batchYear: filterBatch,
        search: studentSearch,
        page: 1,
        limit: 50,
        facultyId,
      });
      if (Array.isArray(res?.students)) {
        setStudents(res.students);
        setStudentPagination(res.pagination || { total: res.students.length, page: 1, limit: 50 });
      }
    } catch {
      // Handled gracefully
    } finally {
      setLoadingStudents(false);
    }
  }, [filterDept, filterBatch, studentSearch, activeFacultyId]);

  // 5. Fetch Problems for Quiz Picker
  const loadAvailableProblems = useCallback(async () => {
    try {
      const res = await fetchPracticeProblems({ page: 1, limit: 100 });
      if (Array.isArray(res?.problems)) {
        setAllProblems(res.problems);
      }
    } catch {
      // Handled gracefully
    }
  }, []);

  // Sync directory when in Super Admin overview
  useEffect(() => {
    if (isSuperAdmin && !selectedFaculty) {
      loadFaculties();
    }
  }, [isSuperAdmin, selectedFaculty, loadFaculties]);

  // Sync data when inspecting specific faculty or regular faculty
  useEffect(() => {
    if (!isSuperAdmin || selectedFaculty) {
      const fid = selectedFaculty?.id || "";
      loadStats(fid);
      loadAvailableProblems();
      if (activeTab === "reminders") loadReminders(fid);
      if (activeTab === "quizzes") loadQuizzes(fid);
      if (activeTab === "students") loadStudents(fid);
    }
  }, [isSuperAdmin, selectedFaculty, activeTab, loadStats, loadAvailableProblems, loadReminders, loadQuizzes, loadStudents]);

  // Dispatch Reminder Handler
  const handleDispatchReminder = async (e) => {
    e.preventDefault();
    if (!reminderForm.title.trim() || !reminderForm.message.trim()) {
      notify({ type: "warning", title: "Missing Fields", message: "Please enter a title and message." });
      return;
    }

    try {
      setDispatching(true);
      await dispatchFacultyReminder(reminderForm);
      notify({ type: "success", title: "Reminder Dispatched", message: "Broadcast sent to eligible students." });
      setReminderForm({
        title: "",
        message: "",
        targetDept: "ALL",
        targetBatch: "ALL",
        priority: "INFO",
      });
      loadReminders();
      loadStats();
    } catch (err) {
      notify({ type: "error", title: "Dispatch Failed", message: err.message || "Failed to dispatch reminder." });
    } finally {
      setDispatching(false);
    }
  };

  // Delete Reminder Handler
  const handleDeleteReminder = async (id) => {
    try {
      await deleteFacultyReminder(id);
      notify({ type: "info", title: "Reminder Removed", message: "Broadcast was successfully removed." });
      setReminders((prev) => prev.filter((r) => r.id !== id));
      loadStats();
    } catch (err) {
      notify({ type: "error", title: "Action Failed", message: err.message || "Could not delete reminder." });
    }
  };

  // Create Quiz Handler
  const handleCreateQuiz = async (e) => {
    e.preventDefault();
    if (!quizForm.title.trim()) {
      notify({ type: "warning", title: "Title Required", message: "Please provide a quiz title." });
      return;
    }
    if (quizForm.selectedProblemIds.length === 0) {
      notify({ type: "warning", title: "Problems Required", message: "Select at least 1 problem for the quiz." });
      return;
    }

    try {
      setCreatingQuiz(true);
      await createFacultyQuiz({
        title: quizForm.title,
        description: quizForm.description,
        durationMinutes: Number(quizForm.durationMinutes),
        eligibleDept: quizForm.eligibleDept,
        eligibleBatch: quizForm.eligibleBatch,
        problemIds: quizForm.selectedProblemIds,
      });

      notify({ type: "success", title: "Quiz Created!", message: "Assessment has been configured." });
      setShowQuizModal(false);
      setQuizForm({
        title: "",
        description: "",
        durationMinutes: 45,
        eligibleDept: "ALL",
        eligibleBatch: "ALL",
        selectedProblemIds: [],
      });
      loadQuizzes();
      loadStats();
    } catch (err) {
      notify({ type: "error", title: "Creation Failed", message: err.message || "Failed to create quiz." });
    } finally {
      setCreatingQuiz(false);
    }
  };

  // Delete Quiz Handler
  const handleDeleteQuiz = async (id) => {
    try {
      await deleteFacultyQuiz(id);
      notify({ type: "info", title: "Quiz Removed", message: "The quiz assessment has been revoked." });
      setQuizzes((prev) => prev.filter((q) => q.id !== id));
      loadStats();
    } catch (err) {
      notify({ type: "error", title: "Action Failed", message: err.message || "Could not delete quiz." });
    }
  };

  return (
    <BackgroundPaths>
      <div className="faculty-hub-root">
        {isSuperAdmin && !selectedFaculty ? (
          <div className="faculty-admin-directory-view">
            {/* Header */}
            <div className="faculty-hub-header">
              <div>
                <div className="faculty-header-badge admin-badge">
                  <span className="faculty-badge-dot admin-dot" />
                  <span>SUPER ADMIN FACULTY COMMAND</span>
                </div>
                <h1 className="faculty-hub-title">Registered Faculty Directory</h1>
                <p className="faculty-hub-subtitle">
                  Inspect registered academic faculty across the platform. Click on any faculty member row to open and inspect their dedicated Faculty Hub.
                </p>
              </div>

              <div className="faculty-identity-card admin-card">
                <div className="faculty-avatar-box admin-avatar">
                  <FontAwesomeIcon icon={faUserTie} />
                </div>
                <div className="faculty-identity-meta">
                  <h4>{user?.displayName || "Super Admin"}</h4>
                  <p>
                    <FontAwesomeIcon icon={faShieldHalved} style={{ marginRight: "6px" }} />
                    Platform Administrator • Full Faculty Clearance
                  </p>
                </div>
              </div>
            </div>

            {/* KPI Summary Cards */}
            <div className="faculty-stats-grid">
              <div className="faculty-stat-card">
                <div className="stat-icon-wrapper stat-icon-purple">
                  <FontAwesomeIcon icon={faChalkboardUser} />
                </div>
                <div>
                  <div className="stat-content-val">
                    {loadingFaculties ? "..." : facultiesList.length}
                  </div>
                  <div className="stat-content-label">Registered Faculties</div>
                </div>
              </div>

              <div className="faculty-stat-card">
                <div className="stat-icon-wrapper stat-icon-cyan">
                  <FontAwesomeIcon icon={faBuildingColumns} />
                </div>
                <div>
                  <div className="stat-content-val">
                    {loadingFaculties ? "..." : new Set(facultiesList.map((f) => f.institutionName || "Default")).size}
                  </div>
                  <div className="stat-content-label">Active Institutions</div>
                </div>
              </div>

              <div className="faculty-stat-card">
                <div className="stat-icon-wrapper stat-icon-amber">
                  <FontAwesomeIcon icon={faGraduationCap} />
                </div>
                <div>
                  <div className="stat-content-val">
                    {loadingFaculties ? "..." : new Set(facultiesList.map((f) => f.department).filter(Boolean)).size}
                  </div>
                  <div className="stat-content-label">Departments Represented</div>
                </div>
              </div>

              <div className="faculty-stat-card">
                <div className="stat-icon-wrapper stat-icon-emerald">
                  <FontAwesomeIcon icon={faStopwatch} />
                </div>
                <div>
                  <div className="stat-content-val">
                    {loadingFaculties ? "..." : facultiesList.reduce((acc, f) => acc + (f.quizCount || 0), 0)}
                  </div>
                  <div className="stat-content-label">Total Quizzes Managed</div>
                </div>
              </div>
            </div>

            {/* Search & Filter Toolbar */}
            <div className="faculty-directory-toolbar glass-panel">
              <div className="directory-search-box">
                <FontAwesomeIcon icon={faSearch} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search faculty by name, email, platform code..."
                  value={facultySearch}
                  onChange={(e) => setFacultySearch(e.target.value)}
                  className="directory-search-input"
                />
              </div>

              <div className="directory-filter-box">
                <FontAwesomeIcon icon={faFilter} className="filter-icon" />
                <select
                  value={facultyDeptFilter}
                  onChange={(e) => setFacultyDeptFilter(e.target.value)}
                  className="directory-filter-select"
                >
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept === "ALL" ? "All Departments" : dept}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                className="refresh-directory-btn"
                onClick={loadFaculties}
                disabled={loadingFaculties}
              >
                <FontAwesomeIcon icon={faArrowRotateRight} className={loadingFaculties ? "fa-spin" : ""} />
                <span>Refresh</span>
              </button>
            </div>

            {/* Faculties Registry Table */}
            <div className="faculty-directory-table-wrap glass-panel">
              <div className="table-header-title">
                <h3>Accredited Faculty Members ({facultiesList.length})</h3>
                <span className="table-header-tip">Click on any faculty row to open their dedicated Faculty Hub</span>
              </div>

              <div className="directory-table-responsive">
                <table className="faculty-directory-table">
                  <thead>
                    <tr>
                      <th>Faculty Member</th>
                      <th>Department / School</th>
                      <th>Institution</th>
                      <th>Platform Code</th>
                      <th>Assessments</th>
                      <th>Announcements</th>
                      <th>Registered</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingFaculties ? (
                      <tr>
                        <td colSpan={8} className="table-loading-cell">
                          <FontAwesomeIcon icon={faSpinner} className="fa-spin" /> Loading registered faculty members...
                        </td>
                      </tr>
                    ) : facultiesList.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="table-empty-cell">
                          No faculty members match the current search or department filter.
                        </td>
                      </tr>
                    ) : (
                      facultiesList.map((faculty) => (
                        <tr
                          key={faculty.id}
                          className="faculty-row-clickable"
                          onClick={() => setSelectedFaculty(faculty)}
                          title="Click to open this faculty's Hub"
                        >
                          <td>
                            <div className="faculty-cell-user">
                              <div className="faculty-cell-avatar">
                                {(faculty.displayName || faculty.username || "F").charAt(0).toUpperCase()}
                              </div>
                              <div className="faculty-cell-names">
                                <strong className="faculty-cell-name">{faculty.displayName || faculty.username}</strong>
                                <span className="faculty-cell-email">{faculty.email}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="faculty-dept-badge">{faculty.department || "General Faculty"}</span>
                          </td>
                          <td>
                            <span className="faculty-inst-text">{faculty.institutionName || "MITS Gwalior"}</span>
                          </td>
                          <td>
                            <code className="faculty-code-pill">{faculty.platformCode || "FACULTY"}</code>
                          </td>
                          <td>
                            <span className="metric-pill quiz-metric">
                              <FontAwesomeIcon icon={faStopwatch} /> {faculty.quizCount ?? 0}
                            </span>
                          </td>
                          <td>
                            <span className="metric-pill reminder-metric">
                              <FontAwesomeIcon icon={faBullhorn} /> {faculty.reminderCount ?? 0}
                            </span>
                          </td>
                          <td>
                            <span className="faculty-date-text">
                              {new Date(faculty.createdAt).toLocaleDateString()}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="open-faculty-hub-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedFaculty(faculty);
                              }}
                            >
                              <span>Open Hub</span>
                              <FontAwesomeIcon icon={faArrowRight} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="faculty-hub-detail-view">
            {/* Super Admin Inspection Banner (Page 2) */}
            {isSuperAdmin && selectedFaculty && (
              <div className="superadmin-inspection-banner glass-panel">
                <div className="inspection-banner-left">
                  <button
                    type="button"
                    className="back-to-directory-btn"
                    onClick={() => setSelectedFaculty(null)}
                  >
                    <FontAwesomeIcon icon={faArrowLeft} />
                    <span>Back to Faculty Directory</span>
                  </button>
                  <div className="inspection-target-info">
                    <span className="admin-inspect-chip">SUPER ADMIN INSPECTION</span>
                    <span className="inspecting-label">
                      Viewing Hub for: <strong>{selectedFaculty.displayName || selectedFaculty.username}</strong> ({selectedFaculty.email})
                    </span>
                  </div>
                </div>
                <div className="inspection-banner-right">
                  <span className="faculty-dept-pill">{selectedFaculty.department || "Academic Faculty"}</span>
                </div>
              </div>
            )}

            {/* Header Bar */}
            <div className="faculty-hub-header">
              <div>
                <div className="faculty-header-badge">
                  <span className="faculty-badge-dot" />
                  <span>FACULTY ACADEMIC CONSOLE</span>
                </div>
                <h1 className="faculty-hub-title">Academic & Assessment Command</h1>
                <p className="faculty-hub-subtitle">
                  Dispatch real-time broadcast reminders, curate institutional challenge sets, set timed assessments, and monitor cohort progress.
                </p>
              </div>

              <div className="faculty-identity-card">
                <div className="faculty-avatar-box">
                  <FontAwesomeIcon icon={faChalkboardUser} />
                </div>
                <div className="faculty-identity-meta">
                  <h4>{selectedFaculty ? (selectedFaculty.displayName || selectedFaculty.username) : (profileData?.name || user?.displayName || user?.email?.split("@")[0] || "Faculty Member")}</h4>
                  <p>
                    <FontAwesomeIcon icon={faBuildingColumns} style={{ marginRight: "6px" }} />
                    {selectedFaculty ? (selectedFaculty.institutionName || "Verified Institution") : (profileData?.institutionName || "Verified Institution")} • {selectedFaculty ? (selectedFaculty.department || "Dept. of Computing") : (profileData?.department || "Dept. of Computing")}
                  </p>
                </div>
              </div>
            </div>

        {/* Stats Grid */}
        <div className="faculty-stats-grid">
          <div className="faculty-stat-card">
            <div className="stat-icon-wrapper stat-icon-purple">
              <FontAwesomeIcon icon={faUsers} />
            </div>
            <div>
              <div className="stat-content-val">
                {loadingStats ? "..." : stats.totalStudents}
              </div>
              <div className="stat-content-label">Enrolled Students</div>
            </div>
          </div>

          <div className="faculty-stat-card">
            <div className="stat-icon-wrapper stat-icon-cyan">
              <FontAwesomeIcon icon={faStopwatch} />
            </div>
            <div>
              <div className="stat-content-val">
                {loadingStats ? "..." : stats.activeQuizzes}
              </div>
              <div className="stat-content-label">Active Assessments</div>
            </div>
          </div>

          <div className="faculty-stat-card">
            <div className="stat-icon-wrapper stat-icon-amber">
              <FontAwesomeIcon icon={faBullhorn} />
            </div>
            <div>
              <div className="stat-content-val">
                {loadingStats ? "..." : stats.dispatchedReminders}
              </div>
              <div className="stat-content-label">Broadcast Reminders</div>
            </div>
          </div>

          <div className="faculty-stat-card">
            <div className="stat-icon-wrapper stat-icon-emerald">
              <FontAwesomeIcon icon={faGraduationCap} />
            </div>
            <div>
              <div className="stat-content-val">{allProblems.length}</div>
              <div className="stat-content-label">Available Challenges</div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="faculty-tabs-nav">
          <button
            type="button"
            className={`faculty-tab-btn ${activeTab === "reminders" ? "active" : ""}`}
            onClick={() => setActiveTab("reminders")}
          >
            <FontAwesomeIcon icon={faBullhorn} />
            <span>Reminders & Broadcasts</span>
          </button>

          <button
            type="button"
            className={`faculty-tab-btn ${activeTab === "quizzes" ? "active" : ""}`}
            onClick={() => setActiveTab("quizzes")}
          >
            <FontAwesomeIcon icon={faStopwatch} />
            <span>Quiz & Assessment Setter</span>
          </button>

          <button
            type="button"
            className={`faculty-tab-btn ${activeTab === "students" ? "active" : ""}`}
            onClick={() => setActiveTab("students")}
          >
            <FontAwesomeIcon icon={faUsers} />
            <span>Student Eligibility & Directory</span>
          </button>

          <button
            type="button"
            className={`faculty-tab-btn ${activeTab === "problems" ? "active" : ""}`}
            onClick={() => setActiveTab("problems")}
          >
            <FontAwesomeIcon icon={faFileExcel} />
            <span>Challenge Archive & Import</span>
          </button>
        </div>

        {/* TAB 1: Reminders & Broadcasts */}
        {activeTab === "reminders" && (
          <div className="faculty-panel">
            <div className="reminders-grid">
              {/* Left Column: Form */}
              <div className="composer-col">
                <div className="panel-title-wrap" style={{ marginBottom: "20px" }}>
                  <h3>Dispatch Academic Reminder</h3>
                  <p>Broadcast notices, submission deadlines, and contest announcements directly to students.</p>
                </div>

                <form onSubmit={handleDispatchReminder} className="faculty-form">
                  <div className="faculty-form-group">
                    <label>Broadcast Title</label>
                    <input
                      type="text"
                      className="faculty-input"
                      placeholder="e.g., Mini-Project Milestone 1 Deadline"
                      value={reminderForm.title}
                      onChange={(e) => setReminderForm({ ...reminderForm, title: e.target.value })}
                      required
                    />
                  </div>

                  <div className="faculty-form-group">
                    <label>Target Department</label>
                    <select
                      className="faculty-select"
                      value={reminderForm.targetDept}
                      onChange={(e) => setReminderForm({ ...reminderForm, targetDept: e.target.value })}
                    >
                      {DEPARTMENTS.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept === "ALL" ? "All Departments" : dept}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="faculty-form-group">
                    <label>Target Batch Year</label>
                    <select
                      className="faculty-select"
                      value={reminderForm.targetBatch}
                      onChange={(e) => setReminderForm({ ...reminderForm, targetBatch: e.target.value })}
                    >
                      {BATCH_YEARS.map((yr) => (
                        <option key={yr} value={yr}>
                          {yr === "ALL" ? "All Batches" : `Batch of ${yr}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="faculty-form-group">
                    <label>Priority Level</label>
                    <select
                      className="faculty-select"
                      value={reminderForm.priority}
                      onChange={(e) => setReminderForm({ ...reminderForm, priority: e.target.value })}
                    >
                      <option value="INFO">General Information</option>
                      <option value="IMPORTANT">Important Notice</option>
                      <option value="URGENT">Urgent / Action Required</option>
                    </select>
                  </div>

                  <div className="faculty-form-group">
                    <label>Message Details</label>
                    <textarea
                      rows={4}
                      className="faculty-textarea"
                      placeholder="Write your reminder or announcement text here..."
                      value={reminderForm.message}
                      onChange={(e) => setReminderForm({ ...reminderForm, message: e.target.value })}
                      required
                    />
                  </div>

                  <button type="submit" className="faculty-btn-primary" disabled={dispatching}>
                    <FontAwesomeIcon icon={dispatching ? faSpinner : faBullhorn} spin={dispatching} />
                    <span>{dispatching ? "Dispatching..." : "Dispatch Broadcast"}</span>
                  </button>
                </form>
              </div>

              {/* Right Column: History */}
              <div className="history-col">
                <div className="faculty-panel-header">
                  <div className="panel-title-wrap">
                    <h3>Dispatched Broadcasts</h3>
                    <p>Recent notices active in student notification streams.</p>
                  </div>
                  <button type="button" className="faculty-btn-secondary" onClick={loadReminders}>
                    <FontAwesomeIcon icon={faArrowRotateRight} spin={loadingReminders} />
                  </button>
                </div>

                {loadingReminders ? (
                  <div className="empty-list-placeholder">
                    <FontAwesomeIcon icon={faSpinner} spin />
                    <div>Loading dispatched broadcasts...</div>
                  </div>
                ) : reminders.length === 0 ? (
                  <div className="empty-list-placeholder">
                    <FontAwesomeIcon icon={faBullhorn} />
                    <div>No dispatched broadcasts found. Use the composer on the left to send one.</div>
                  </div>
                ) : (
                  <div className="reminders-list">
                    {reminders.map((rem) => (
                      <div key={rem.id} className="reminder-card">
                        <div className="reminder-header-row">
                          <h4 className="reminder-title">{rem.title}</h4>
                          <div className="reminder-pills">
                            <span className={`reminder-pill reminder-pill-priority-${rem.priority || "INFO"}`}>
                              {rem.priority || "INFO"}
                            </span>
                            <span className="reminder-pill">
                              {rem.targetDept === "ALL" ? "All Depts" : rem.targetDept}
                            </span>
                            <span className="reminder-pill">
                              {rem.targetBatch === "ALL" ? "All Batches" : `Batch ${rem.targetBatch}`}
                            </span>
                          </div>
                        </div>
                        <p className="reminder-body">{rem.message}</p>
                        <div className="reminder-footer-row">
                          <span>{new Date(rem.createdAt).toLocaleString()}</span>
                          <button
                            type="button"
                            className="reminder-delete-btn"
                            title="Revoke / Delete Reminder"
                            onClick={() => handleDeleteReminder(rem.id)}
                          >
                            <FontAwesomeIcon icon={faTrashCan} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Quiz & Assessment Setter */}
        {activeTab === "quizzes" && (
          <div className="faculty-panel">
            <div className="faculty-panel-header">
              <div className="panel-title-wrap">
                <h3>Timed Quizzes & Assessments</h3>
                <p>Configure automated coding assessments targeted to specific departments and cohorts.</p>
              </div>
              <button
                type="button"
                className="faculty-btn-primary"
                onClick={() => setShowQuizModal(!showQuizModal)}
              >
                <FontAwesomeIcon icon={faPlus} />
                <span>{showQuizModal ? "Close Creator" : "Set New Quiz"}</span>
              </button>
            </div>

            {/* Quiz Creator Inline Drawer */}
            {showQuizModal && (
              <div
                style={{
                  background: "rgba(18, 24, 38, 0.7)",
                  border: "1px solid rgba(168, 85, 247, 0.3)",
                  borderRadius: "16px",
                  padding: "24px",
                  marginBottom: "28px",
                }}
              >
                <h4 style={{ margin: "0 0 16px", fontFamily: "'Space Grotesk', sans-serif", color: "#00e5ff" }}>
                  Configure New Coding Assessment
                </h4>

                <form onSubmit={handleCreateQuiz} className="faculty-form">
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
                    <div className="faculty-form-group">
                      <label>Quiz Title</label>
                      <input
                        type="text"
                        className="faculty-input"
                        placeholder="e.g., Mid-Term DSA Evaluation"
                        value={quizForm.title}
                        onChange={(e) => setQuizForm({ ...quizForm, title: e.target.value })}
                        required
                      />
                    </div>

                    <div className="faculty-form-group">
                      <label>Duration (Minutes)</label>
                      <select
                        className="faculty-select"
                        value={quizForm.durationMinutes}
                        onChange={(e) => setQuizForm({ ...quizForm, durationMinutes: e.target.value })}
                      >
                        <option value={15}>15 Minutes</option>
                        <option value={30}>30 Minutes</option>
                        <option value={45}>45 Minutes</option>
                        <option value={60}>60 Minutes (1 Hour)</option>
                        <option value={90}>90 Minutes (1.5 Hours)</option>
                        <option value={120}>120 Minutes (2 Hours)</option>
                      </select>
                    </div>

                    <div className="faculty-form-group">
                      <label>Eligible Department</label>
                      <select
                        className="faculty-select"
                        value={quizForm.eligibleDept}
                        onChange={(e) => setQuizForm({ ...quizForm, eligibleDept: e.target.value })}
                      >
                        {DEPARTMENTS.map((dept) => (
                          <option key={dept} value={dept}>
                            {dept === "ALL" ? "All Departments" : dept}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="faculty-form-group">
                      <label>Eligible Batch Year</label>
                      <select
                        className="faculty-select"
                        value={quizForm.eligibleBatch}
                        onChange={(e) => setQuizForm({ ...quizForm, eligibleBatch: e.target.value })}
                      >
                        {BATCH_YEARS.map((yr) => (
                          <option key={yr} value={yr}>
                            {yr === "ALL" ? "All Batches" : `Batch of ${yr}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="faculty-form-group">
                    <label>Description & Guidelines</label>
                    <textarea
                      rows={2}
                      className="faculty-textarea"
                      placeholder="Instructions, syllabus topics, or scoring criteria..."
                      value={quizForm.description}
                      onChange={(e) => setQuizForm({ ...quizForm, description: e.target.value })}
                    />
                  </div>

                  {/* Problem Picker for Quiz */}
                  <div className="faculty-form-group">
                    <label>
                      Select Quiz Problems ({quizForm.selectedProblemIds.length} Selected)
                    </label>
                    <div
                      style={{
                        maxHeight: "180px",
                        overflowY: "auto",
                        background: "rgba(0, 0, 0, 0.3)",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        borderRadius: "10px",
                        padding: "10px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                      }}
                    >
                      {allProblems.map((prob) => {
                        const pid = String(prob.id || prob._id);
                        const isChecked = quizForm.selectedProblemIds.includes(pid);
                        return (
                          <label
                            key={pid}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                              cursor: "pointer",
                              padding: "6px 8px",
                              borderRadius: "6px",
                              background: isChecked ? "rgba(0, 229, 255, 0.12)" : "transparent",
                              fontSize: "0.85rem",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setQuizForm((prev) => {
                                  const ids = prev.selectedProblemIds.includes(pid)
                                    ? prev.selectedProblemIds.filter((id) => id !== pid)
                                    : [...prev.selectedProblemIds, pid];
                                  return { ...prev, selectedProblemIds: ids };
                                });
                              }}
                            />
                            <span style={{ fontWeight: 600, color: "#ffffff" }}>{prob.title}</span>
                            <span style={{ color: "#00e5ff", fontSize: "0.75rem", marginLeft: "auto" }}>
                              {prob.difficulty}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "10px" }}>
                    <button
                      type="button"
                      className="faculty-btn-secondary"
                      onClick={() => setShowQuizModal(false)}
                      disabled={creatingQuiz}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="faculty-btn-primary" disabled={creatingQuiz}>
                      <FontAwesomeIcon icon={creatingQuiz ? faSpinner : faCheckCircle} spin={creatingQuiz} />
                      <span>{creatingQuiz ? "Creating Quiz..." : "Save Assessment"}</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Quizzes List */}
            {loadingQuizzes ? (
              <div className="empty-list-placeholder">
                <FontAwesomeIcon icon={faSpinner} spin />
                <div>Loading quizzes...</div>
              </div>
            ) : quizzes.length === 0 ? (
              <div className="empty-list-placeholder">
                <FontAwesomeIcon icon={faStopwatch} />
                <div>No assessments created yet. Click "Set New Quiz" to configure your first quiz.</div>
              </div>
            ) : (
              <div className="quizzes-list-grid">
                {quizzes.map((quiz) => (
                  <div key={quiz.id} className="quiz-card">
                    <div className="quiz-card-top">
                      <h4>{quiz.title}</h4>
                      <p>{quiz.description || "Automated coding assessment."}</p>
                      <div className="quiz-meta-pills">
                        <span className="quiz-meta-pill">⏱️ {quiz.durationMinutes} Mins</span>
                        <span className="quiz-meta-pill">
                          🎯 {quiz.eligibleDept === "ALL" ? "All Depts" : quiz.eligibleDept}
                        </span>
                        <span className="quiz-meta-pill">
                          🎓 {quiz.eligibleBatch === "ALL" ? "All Batches" : `Batch ${quiz.eligibleBatch}`}
                        </span>
                        <span className="quiz-meta-pill">
                          🧩 {(quiz.problemIds || []).length} Challenges
                        </span>
                      </div>
                    </div>
                    <div className="quiz-card-footer">
                      <span style={{ fontSize: "0.76rem", color: "#64748b" }}>
                        Created: {new Date(quiz.createdAt).toLocaleDateString()}
                      </span>
                      <button
                        type="button"
                        className="reminder-delete-btn"
                        title="Delete Quiz"
                        onClick={() => handleDeleteQuiz(quiz.id)}
                      >
                        <FontAwesomeIcon icon={faTrashCan} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Student Eligibility & Directory */}
        {activeTab === "students" && (
          <div className="faculty-panel">
            <div className="faculty-panel-header">
              <div className="panel-title-wrap">
                <h3>Student Cohort Directory & Eligibility</h3>
                <p>Filter student eligibility across department and batch year for targeted assessments.</p>
              </div>
              <button type="button" className="faculty-btn-secondary" onClick={loadStudents}>
                <FontAwesomeIcon icon={faArrowRotateRight} spin={loadingStudents} />
              </button>
            </div>

            {/* Filters Bar */}
            <div className="student-filters-bar">
              <div className="student-search-box">
                <FontAwesomeIcon icon={faSearch} className="student-search-icon" />
                <input
                  type="text"
                  className="faculty-input"
                  placeholder="Search students by name, email, or username..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                />
              </div>

              <select
                className="faculty-select"
                style={{ width: "auto", minWidth: "180px" }}
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
              >
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept === "ALL" ? "All Departments" : dept}
                  </option>
                ))}
              </select>

              <select
                className="faculty-select"
                style={{ width: "auto", minWidth: "150px" }}
                value={filterBatch}
                onChange={(e) => setFilterBatch(e.target.value)}
              >
                {BATCH_YEARS.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr === "ALL" ? "All Batches" : `Batch ${yr}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Eligibility Counter Banner */}
            <div className="eligibility-counter-banner">
              <div>
                <strong>Active Cohort Selection:</strong>{" "}
                {filterDept === "ALL" ? "All Departments" : filterDept} •{" "}
                {filterBatch === "ALL" ? "All Batches" : `Batch of ${filterBatch}`}
              </div>
              <div className="eligibility-count-highlight">
                {studentPagination.total} Eligible Students
              </div>
            </div>

            {/* Students Table */}
            {loadingStudents ? (
              <div className="empty-list-placeholder">
                <FontAwesomeIcon icon={faSpinner} spin />
                <div>Loading student roster...</div>
              </div>
            ) : students.length === 0 ? (
              <div className="empty-list-placeholder">
                <FontAwesomeIcon icon={faUsers} />
                <div>No students match the current cohort criteria.</div>
              </div>
            ) : (
              <div className="students-table-wrap">
                <table className="faculty-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Department</th>
                      <th>Batch Year</th>
                      <th>Rating</th>
                      <th>Solved</th>
                      <th>Institution</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((st) => (
                      <tr key={st.id || st.uid}>
                        <td>
                          <div className="student-user-cell">
                            <div className="student-avatar">
                              {(st.name || st.username || st.email || "S").charAt(0).toUpperCase()}
                            </div>
                            <div className="student-name-group">
                              <span className="student-name">
                                {st.name || st.username || "Anonymous Learner"}
                              </span>
                              <span className="student-email">{st.email}</span>
                            </div>
                          </div>
                        </td>
                        <td>{st.department || "Computing"}</td>
                        <td>
                          <span className="batch-tag">{st.batchYear || "2026"}</span>
                        </td>
                        <td style={{ fontWeight: 700, color: "#00e5ff" }}>{st.rating || 1200}</td>
                        <td style={{ fontWeight: 600, color: "#83f2bd" }}>
                          {st._count?.submissions || 0}
                        </td>
                        <td style={{ fontSize: "0.82rem", color: "#94a3b8" }}>
                          {st.institutionName || "Institutional Cohort"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: Challenge Archive & Import */}
        {activeTab === "problems" && (
          <div className="faculty-panel">
            <div className="faculty-panel-header">
              <div className="panel-title-wrap">
                <h3>Curated Question Library & Excel Importer</h3>
                <p>Import problems in bulk via Excel spreadsheets (.xlsx), CSV, or structured JSON documents.</p>
              </div>
              <button
                type="button"
                className="faculty-btn-primary"
                onClick={() => setShowImportModal(true)}
              >
                <FontAwesomeIcon icon={faFileExcel} />
                <span>Import Questions via Excel/Document</span>
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
              <div
                style={{
                  background: "rgba(18, 24, 38, 0.6)",
                  border: "1px solid rgba(0, 229, 255, 0.2)",
                  borderRadius: "14px",
                  padding: "20px",
                }}
              >
                <h4 style={{ margin: "0 0 10px", color: "#00e5ff", fontFamily: "'Space Grotesk', sans-serif" }}>
                  Excel & Document Import
                </h4>
                <p style={{ fontSize: "0.86rem", color: "#94a3b8", lineHeight: 1.5, margin: "0 0 16px" }}>
                  Download the AlgoFight standardized Excel template, fill out problem statements and test cases, then upload directly to the archive.
                </p>
                <button
                  type="button"
                  className="faculty-btn-primary"
                  onClick={() => setShowImportModal(true)}
                >
                  <FontAwesomeIcon icon={faPlus} />
                  <span>Launch Import Dialog</span>
                </button>
              </div>

              <div
                style={{
                  background: "rgba(18, 24, 38, 0.6)",
                  border: "1px solid rgba(168, 85, 247, 0.2)",
                  borderRadius: "14px",
                  padding: "20px",
                }}
              >
                <h4 style={{ margin: "0 0 10px", color: "#c084fc", fontFamily: "'Space Grotesk', sans-serif" }}>
                  Available Problem Pool
                </h4>
                <p style={{ fontSize: "0.86rem", color: "#94a3b8", lineHeight: 1.5, margin: "0 0 16px" }}>
                  Currently <strong>{allProblems.length}</strong> algorithmic challenges available in the global library for quizzes and multiplayer battle arenas.
                </p>
                <a
                  href="/practice"
                  className="faculty-btn-secondary"
                  style={{ textDecoration: "none", display: "inline-flex" }}
                >
                  <span>Explore Practice Archive</span>
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    )}

      {/* Excel & Document Question Import Overlay Modal */}
      <ProblemImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportSuccess={() => {
          loadAvailableProblems();
          loadStats();
        }}
      />
    </div>
      <Footer />
    </BackgroundPaths>
  );
}
