import { getSessionToken, clearAuthStorage } from "./authStorage";

const rawApiUrl = (import.meta.env.VITE_API_URL || "").trim();
const isLocal = typeof window !== "undefined" && 
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

const getEffectiveApiUrl = () => {
  // In local browser development, leverage Vite dev proxy (/api) to eliminate CORS and preflight mismatches
  if (isLocal) {
    return "";
  }
  if (rawApiUrl) {
    return rawApiUrl.replace(/\/api\/?$/, "").replace(/\/+$/, "");
  }
  return "";
};

// Strip trailing /api to avoid /api/api calls
export const API_URL = getEffectiveApiUrl();

export function toApiUrl(path) {
  return API_URL ? `${API_URL}${path}` : path;
}

async function parseResponseBody(res) {
  const text = await res.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    const preview = text.slice(0, 120).replace(/\s+/g, " ").trim();
    throw new Error(
      `Expected JSON response but got: ${preview || "<empty>"}`
    );
  }
}

function extractErrorMessage(parsedBody, status) {
  if (parsedBody && typeof parsedBody === "object") {
    return parsedBody.message || parsedBody.error || `Request failed (${status})`;
  }
  return `Request failed (${status})`;
}

// In-flight request deduplication map (coalesces identical concurrent GETs)
const inFlightRequests = new Map();

// Short TTL response cache for safe GET requests
const responseCache = new Map();

export function invalidateApiCache(pattern) {
  if (!pattern) {
    responseCache.clear();
    return;
  }
  for (const key of responseCache.keys()) {
    if (key.includes(pattern)) {
      responseCache.delete(key);
    }
  }
}

export async function requestJson(path, options = {}) {
  const {
    includeAuth = false,
    headers,
    ttlMs = 0,
    skipCache = false,
    ...restOptions
  } = options;

  const method = (restOptions.method || "GET").toUpperCase();
  const isGet = method === "GET";
  const sessionToken = getSessionToken();
  const cacheKey = isGet ? `${path}:${includeAuth && sessionToken ? "auth" : "anon"}` : null;

  // 1. Check TTL cache if enabled
  if (isGet && !skipCache && restOptions.cache !== "no-store" && ttlMs > 0 && cacheKey) {
    const cached = responseCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return JSON.parse(JSON.stringify(cached.data));
    }
  }

  // 2. Coalesce in-flight identical GET requests to avoid duplicate wire roundtrips
  if (isGet && cacheKey && inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey);
  }

  const executionPromise = (async () => {
    const requestHeaders = {
      ...(headers || {}),
    };

    if ((includeAuth || sessionToken) && sessionToken) {
      requestHeaders.Authorization = `Bearer ${sessionToken}`;
    }

    const res = await fetch(toApiUrl(path), {
      ...restOptions,
      headers: requestHeaders,
    });
    const parsedBody = await parseResponseBody(res);

    if (!res.ok) {
      if (res.status === 401) {
        clearAuthStorage();
      }
      throw new Error(extractErrorMessage(parsedBody, res.status));
    }

    // Save into cache if eligible
    if (isGet && !skipCache && restOptions.cache !== "no-store" && ttlMs > 0 && cacheKey) {
      responseCache.set(cacheKey, {
        data: parsedBody,
        expiresAt: Date.now() + ttlMs,
      });
      if (responseCache.size > 100) {
        const oldestKey = responseCache.keys().next().value;
        responseCache.delete(oldestKey);
      }
    }

    return parsedBody;
  })();

  if (isGet && cacheKey) {
    inFlightRequests.set(cacheKey, executionPromise);
    executionPromise
      .catch(() => {})
      .finally(() => {
        inFlightRequests.delete(cacheKey);
      });
  }

  return executionPromise;
}

/**
 * Sync Firebase user to backend after login/signup
 */
export async function syncUserToBackend({ uid, email, displayName, photoURL, originalPhotoURL, avatarFrame, themePreference, authToken, githubUrl, linkedinUrl }) {
  invalidateApiCache("/api/users");
  return requestJson("/api/users", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify({ uid, email, displayName, photoURL, originalPhotoURL, avatarFrame, themePreference, githubUrl, linkedinUrl }),
    includeAuth: true,
  });
}

/**
 * Persist active theme preference to user's profile
 */
export async function updateUserThemePreference(themeId) {
  invalidateApiCache("/api/users");
  return requestJson("/api/users/theme", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ themeId }),
    includeAuth: true,
  }).catch(() => null);
}

/**
 * Pre-auth student email validation and institute detection preview
 */
export async function resolveStudentEmail(email) {
  return requestJson("/api/student/resolve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

/**
 * Dedicated Student Sync
 */
export async function syncStudentToBackend({ uid, email, displayName, authToken, githubUrl, linkedinUrl }) {
  invalidateApiCache("/api/users");
  return requestJson("/api/student/sync", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify({ id: uid, uid, email, displayName, githubUrl, linkedinUrl }),
    includeAuth: true,
  });
}

/**
 * Fetch leaderboard data from backend
 */
export async function fetchLeaderboard() {
  return requestJson("/api/leaderboard", { ttlMs: 10000 });
}

/**
/**
 * Direct AlgoFight Auth Endpoints (Issue 5)
 */
export async function loginWithGoogleApi(idToken) {
  return requestJson("/api/auth/google", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
}

export async function loginManualApi(email, password) {
  return requestJson("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

export async function signupManualApi(payload) {
  return requestJson("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function logoutApi() {
  try {
    await requestJson("/api/auth/logout", {
      method: "POST",
      includeAuth: true,
    });
  } catch {
    // Ignored
  } finally {
    clearAuthStorage();
  }
}

export async function fetchMeApi() {
  return requestJson("/api/auth/me", {
    includeAuth: true,
    cache: "no-store",
  });
}

/**
 * Fetch user profile by ID or username
 */
export async function fetchUserProfile(identifier) {
  if (!identifier) return null;
  try {
    return await requestJson(`/api/users/${encodeURIComponent(identifier)}?t=${Date.now()}`, {
      includeAuth: true,
      cache: "no-store",
    });
  } catch {
    return null;
  }
}


/**
 * Fetch problems with optional filters.
 */
export async function fetchPracticeProblems({ page = 1, limit = 50, difficulty = "", tags = "", mode = "" } = {}) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  if (mode) {
    params.set("mode", mode);
  }
  if (difficulty) {
    params.set("difficulty", difficulty);
  }
  if (tags) {
    params.set("tags", tags);
  }

  return requestJson(`/api/problems?${params.toString()}`, { ttlMs: 15000 });
}

/**
 * Fetch one problem with only public testcase data.
 */
export async function fetchProblemById(problemId) {
  return requestJson(`/api/problems/${problemId}`, { ttlMs: 30000 });
}

/**
 * Record a practice submission for the current user.
 */
export async function recordPracticeProgress({ uid, problemId, passed, code, language, executionTime }) {
  invalidateApiCache("/api/users");
  invalidateApiCache("/api/problems");
  return requestJson(`/api/users/${uid}/practice-progress`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ problemId, passed, code, language, executionTime }),
    includeAuth: true,
  });
}

/**
 * Evaluate practice code against sample or balanced submit suite.
 */
export async function evaluatePracticeCode({ problemId, code, language, mode }) {
  return requestJson("/api/practice/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ problemId, code, language, mode }),
    includeAuth: true,
  });
}

/**
 * Fetch saved practice checkpoint (Redis -> PostgreSQL -> null)
 */
export async function fetchPracticeCheckpoint(problemId) {
  if (!problemId) return null;
  return requestJson(`/api/practice/checkpoints/${encodeURIComponent(problemId)}`, {
    includeAuth: true,
  });
}

/**
 * Save practice checkpoint to Redis
 */
export async function savePracticeCheckpoint({ problemId, code, language, revision }) {
  if (!problemId) return null;
  return requestJson(`/api/practice/checkpoints/${encodeURIComponent(problemId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, language, revision }),
    includeAuth: true,
  });
}


/**
 * Fetch available players from backend
 */
export async function fetchAvailablePlayers({ search = "", status = "", limit = 50, excludeUserId = "" } = {}) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (status) params.set("status", status);
  if (limit) params.set("limit", String(limit));
  if (excludeUserId) params.set("excludeUserId", excludeUserId);

  const queryString = params.toString();
  return requestJson(`/api/players/available${queryString ? `?${queryString}` : ""}`, {
    includeAuth: true,
    ttlMs: 5000,
  });
}

export async function fetchUserNotifications(userId) {
  if (!userId) return { notifications: [], unreadCount: 0, total: 0 };
  return requestJson(`/api/notifications?userId=${encodeURIComponent(userId)}`, {
    includeAuth: true,
    ttlMs: 5000,
  });
}

export async function markNotificationAsRead(userId, notificationId) {
  if (!userId || !notificationId) return { success: false };
  invalidateApiCache("/api/notifications");
  return requestJson(`/api/notifications/${encodeURIComponent(notificationId)}/read`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
    includeAuth: true
  });
}

export async function markAllNotificationsAsRead(userId) {
  if (!userId) return { count: 0 };
  invalidateApiCache("/api/notifications");
  return requestJson(`/api/notifications/read-all`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
    includeAuth: true
  });
}

export async function clearUserNotifications(userId) {
  if (!userId) return { success: false };
  invalidateApiCache("/api/notifications");
  return requestJson(`/api/notifications`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
    includeAuth: true
  });
}

export async function fetchActiveSystemAnnouncements() {
  return requestJson(`/api/notifications/active-broadcasts`, { ttlMs: 15000 });
}

export async function dispatchAdminBroadcast(adminKey, broadcastData) {
  return requestJson(`/api/admin/broadcast`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-key": adminKey,
    },
    body: JSON.stringify(broadcastData),
  });
}

export async function fetchAdminBroadcasts(adminKey) {
  return requestJson(`/api/admin/broadcasts`, {
    headers: {
      "x-admin-key": adminKey,
    },
  });
}

export async function deleteAdminBroadcast(adminKey, broadcastId) {
  return requestJson(`/api/admin/broadcast/${encodeURIComponent(broadcastId)}`, {
    method: "DELETE",
    headers: {
      "x-admin-key": adminKey,
    },
  });
}

export async function uploadBroadcastMedia(adminKey, mediaPayload) {
  return requestJson(`/api/admin/media`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-key": adminKey,
    },
    body: JSON.stringify(mediaPayload),
  });
}

export async function fetchAdminAuditLogs(adminKey, { category = "ALL", severity = "ALL", method = "ALL", search = "", limit = 50 } = {}) {
  const params = new URLSearchParams();
  if (category && category !== "ALL") params.set("category", category);
  if (severity && severity !== "ALL") params.set("severity", severity);
  if (method && method !== "ALL") params.set("method", method);
  if (search) params.set("search", search);
  if (limit) params.set("limit", String(limit));

  const query = params.toString() ? `?${params.toString()}` : "";
  return requestJson(`/api/admin/audit-logs${query}`, {
    headers: { "x-admin-key": adminKey },
  });
}

export async function fetchAdminAnalytics(adminKey) {
  return requestJson(`/api/admin/analytics`, {
    headers: { "x-admin-key": adminKey },
    skipCache: true,
    cache: "no-store",
  });
}

export async function probeAdminFleet(adminKey, payload = {}) {
  return requestJson(`/api/admin/runtime-pool/probe-all`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-key": adminKey,
    },
    body: JSON.stringify(payload),
  });
}

export async function scaleAdminFleet(adminKey, direction = "out", reason = "") {
  const endpoint = direction === "out" ? "/api/admin/runtime-pool/scale-out" : "/api/admin/runtime-pool/scale-in";
  return requestJson(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-key": adminKey,
    },
    body: JSON.stringify({ reason }),
  });
}

/**
 * Bulk import problems into the problem archive (Admin or Verified Faculty)
 */
export async function importProblemsBulk(problems) {
  invalidateApiCache("/api/problems");
  return requestJson("/api/problems/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ problems }),
    includeAuth: true,
  });
}

/**
 * Faculty Control Hub APIs
 */
export async function fetchFacultyStudents({ department = "", branch = "", batchYear = "", search = "", page = 1, limit = 50, facultyId = "" } = {}) {
  const params = new URLSearchParams();
  if (department && department !== "ALL") params.set("department", department);
  if (branch && branch !== "ALL") params.set("branch", branch);
  if (batchYear && batchYear !== "ALL") params.set("batchYear", batchYear);
  if (search) params.set("search", search);
  if (facultyId) params.set("facultyId", facultyId);
  params.set("page", String(page));
  params.set("limit", String(limit));

  return requestJson(`/api/faculty/students?${params.toString()}`, {
    includeAuth: true,
    cache: "no-store",
  });
}

export async function fetchRegisteredFaculties({ search = "", department = "" } = {}) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (department && department !== "ALL") params.set("department", department);
  const queryStr = params.toString() ? `?${params.toString()}` : "";

  return requestJson(`/api/faculty/faculties${queryStr}`, {
    includeAuth: true,
    cache: "no-store",
    skipCache: true,
  });
}

export async function dispatchFacultyReminder(payload) {
  invalidateApiCache("/api/notifications");
  return requestJson("/api/faculty/reminders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    includeAuth: true,
  });
}

export async function fetchFacultyReminders(facultyId = "") {
  const url = facultyId ? `/api/faculty/reminders?facultyId=${encodeURIComponent(facultyId)}` : "/api/faculty/reminders";
  return requestJson(url, {
    includeAuth: true,
    cache: "no-store",
    skipCache: true,
  });
}

export async function deleteFacultyReminder(id) {
  return requestJson(`/api/faculty/reminders/${id}`, {
    method: "DELETE",
    includeAuth: true,
  });
}

export async function createFacultyQuiz(payload) {
  return requestJson("/api/faculty/quizzes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    includeAuth: true,
  });
}

export async function fetchFacultyQuizzes(facultyId = "") {
  const url = facultyId ? `/api/faculty/quizzes?facultyId=${encodeURIComponent(facultyId)}` : "/api/faculty/quizzes";
  return requestJson(url, {
    includeAuth: true,
    cache: "no-store",
    skipCache: true,
  });
}

export async function deleteFacultyQuiz(id) {
  return requestJson(`/api/faculty/quizzes/${id}`, {
    method: "DELETE",
    includeAuth: true,
  });
}

export async function fetchFacultyStats(facultyId = "") {
  const url = facultyId ? `/api/faculty/stats?facultyId=${encodeURIComponent(facultyId)}` : "/api/faculty/stats";
  return requestJson(url, {
    includeAuth: true,
    cache: "no-store",
    skipCache: true,
  });
}

export async function submitPlatformFeedback(payload) {
  return requestJson("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    includeAuth: true,
  });
}

export async function fetchShowcaseFeedbacks(limit = 10) {
  return requestJson(`/api/feedback/showcase?limit=${limit}`, {
    ttlMs: 30000,
  });
}

/**
 * Update Faculty Institutional Profile (School/Centre, Department, Designation)
 */
export async function updateFacultyProfile(payload) {
  invalidateApiCache("/api/faculty");
  invalidateApiCache("/api/users");
  try {
    return await requestJson("/api/faculty/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      includeAuth: true,
    });
  } catch {
    // Fallback to /api/users/faculty-profile
    return await requestJson("/api/users/faculty-profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      includeAuth: true,
    });
  }
}

/**
 * Upsert or update authenticated user profile details
 */
export async function saveUserProfile(payload) {
  invalidateApiCache("/api/users");
  return requestJson("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    includeAuth: true,
  });
}

/**
 * Fetch active public rooms/challenges for home dispatch and arena
 */
export async function fetchPublicRooms() {
  return requestJson("/api/battle/public-rooms", {
    method: "GET",
    cache: "no-store",
  });
}

/**
 * Fetch actual enrolled coder stats
 */
export async function fetchPlatformStats() {
  return requestJson("/api/platform/stats", {
    method: "GET",
    ttlMs: 30000,
  });
}

/**
 * Fetch showcase user feedbacks/testimonials for home page
 */
export async function fetchShowcaseFeedback() {
  return requestJson("/api/feedback/showcase?limit=15", {
    method: "GET",
    ttlMs: 30000,
  });
}

// ==========================================
// ALGOFIGHT INTEL API HELPERS
// ==========================================

export async function fetchIntelFeed({ category = "ALL", search = "", page = 1, limit = 9 } = {}) {
  const params = new URLSearchParams();
  if (category && category !== "ALL") params.set("category", category);
  if (search) params.set("search", search);
  params.set("page", String(page));
  params.set("limit", String(limit));

  return requestJson(`/api/intel?${params.toString()}`, {
    method: "GET",
    ttlMs: 15000,
  });
}

export async function fetchIntelFeatured() {
  return requestJson("/api/intel/featured", {
    method: "GET",
    ttlMs: 20000,
  });
}

export async function fetchIntelEvents({ type = "ALL" } = {}) {
  const params = new URLSearchParams();
  if (type && type !== "ALL") params.set("type", type);

  return requestJson(`/api/intel/events?${params.toString()}`, {
    method: "GET",
    ttlMs: 15000,
  });
}

export async function fetchIntelPostBySlug(slug, adminKey = null) {
  const headers = {};
  if (adminKey) headers["x-admin-key"] = adminKey;

  return requestJson(`/api/intel/${slug}`, {
    method: "GET",
    headers,
    cache: "no-store",
    skipCache: true,
  });
}

export async function fetchAdminIntelPosts(adminKey, { status = "ALL", category = "ALL", search = "", page = 1, limit = 20 } = {}) {
  const params = new URLSearchParams();
  if (status && status !== "ALL") params.set("status", status);
  if (category && category !== "ALL") params.set("category", category);
  if (search) params.set("search", search);
  params.set("page", String(page));
  params.set("limit", String(limit));

  return requestJson(`/api/admin/intel?${params.toString()}`, {
    method: "GET",
    headers: { "x-admin-key": adminKey },
    cache: "no-store",
    skipCache: true,
  });
}

export async function createAdminIntelPost(adminKey, payload) {
  invalidateApiCache("/api/intel");
  return requestJson("/api/admin/intel", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-key": adminKey,
    },
    body: JSON.stringify(payload),
  });
}

export async function updateAdminIntelPost(adminKey, id, payload) {
  invalidateApiCache("/api/intel");
  return requestJson(`/api/admin/intel/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-admin-key": adminKey,
    },
    body: JSON.stringify(payload),
  });
}

export async function publishAdminIntelPost(adminKey, id) {
  invalidateApiCache("/api/intel");
  return requestJson(`/api/admin/intel/${id}/publish`, {
    method: "POST",
    headers: { "x-admin-key": adminKey },
  });
}

export async function unpublishAdminIntelPost(adminKey, id) {
  invalidateApiCache("/api/intel");
  return requestJson(`/api/admin/intel/${id}/unpublish`, {
    method: "POST",
    headers: { "x-admin-key": adminKey },
  });
}

export async function deleteAdminIntelPost(adminKey, id) {
  invalidateApiCache("/api/intel");
  return requestJson(`/api/admin/intel/${id}`, {
    method: "DELETE",
    headers: { "x-admin-key": adminKey },
  });
}

export async function fetchRewardsAnalytics(adminKey, options = {}) {
  const params = new URLSearchParams();
  if (options.timeframe) params.set("timeframe", options.timeframe);
  if (options.startDate) params.set("startDate", options.startDate);
  if (options.endDate) params.set("endDate", options.endDate);

  const query = params.toString() ? `?${params.toString()}` : "";
  return requestJson(`/api/admin/analytics/rewards${query}`, {
    headers: { "x-admin-key": adminKey },
    skipCache: true,
    cache: "no-store",
  });
}

export async function fetchMyClaimedRewards(targetUserId = null) {
  const query = targetUserId ? `?targetUserId=${encodeURIComponent(targetUserId)}` : "";
  return requestJson(`/api/rewards/my-claims${query}`, {
    includeAuth: true,
    skipCache: true,
    cache: "no-store",
  });
}

export async function syncArenaPointBalance() {
  return requestJson("/api/rewards/sync-balance", {
    method: "POST",
    includeAuth: true,
  });
}


