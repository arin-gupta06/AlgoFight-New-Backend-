import { auth } from "../firebaseConfig";

const rawApiUrl = (import.meta.env.VITE_API_URL || "").trim();
const isLocal = typeof window !== "undefined" && 
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

const getEffectiveApiUrl = () => {
  if (rawApiUrl) {
    if (!isLocal && (rawApiUrl.includes("localhost") || rawApiUrl.includes("127.0.0.1"))) {
      // In production deployment, ignore baked-in localhost URL
      return "";
    }
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
  const userUid = auth.currentUser?.uid || "";
  const cacheKey = isGet ? `${path}:${includeAuth ? userUid : "anon"}` : null;

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

    if (includeAuth && auth.currentUser) {
      try {
        const token = await auth.currentUser.getIdToken();
        if (token) {
          requestHeaders.Authorization = `Bearer ${token}`;
        }
      } catch (error) {
        console.warn("Unable to attach auth token", error);
      }
    }

    const res = await fetch(toApiUrl(path), {
      ...restOptions,
      headers: requestHeaders,
    });
    const parsedBody = await parseResponseBody(res);

    if (!res.ok) {
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
export async function syncUserToBackend({ uid, email, displayName, photoURL, authToken, githubUrl, linkedinUrl }) {
  invalidateApiCache("/api/users");
  return requestJson("/api/users", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify({ uid, email, displayName, photoURL, githubUrl, linkedinUrl }),
    includeAuth: true,
  });
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
 * Fetch user profile by Firebase UID
 */
export async function fetchUserProfile(uid) {
  try {
    const identifier = uid || auth.currentUser?.email || auth.currentUser?.uid;
    if (!identifier) return null;
    let res = await requestJson(`/api/users/${encodeURIComponent(identifier)}?t=${Date.now()}`, {
      includeAuth: true,
      cache: "no-store",
    });
    if (!res && auth.currentUser?.email && identifier !== auth.currentUser.email) {
      res = await requestJson(`/api/users/${encodeURIComponent(auth.currentUser.email)}?t=${Date.now()}`, {
        includeAuth: true,
        cache: "no-store",
      });
    }
    return res;
  } catch {
    if (auth.currentUser?.email && uid !== auth.currentUser.email) {
      try {
        return await requestJson(`/api/users/${encodeURIComponent(auth.currentUser.email)}?t=${Date.now()}`, {
          includeAuth: true,
          cache: "no-store",
        });
      } catch {
        return null;
      }
    }
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
export async function recordPracticeProgress({ uid, problemId, passed }) {
  return requestJson(`/api/users/${uid}/practice-progress`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ problemId, passed }),
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
 * Fetch available players from backend
 */
export async function fetchAvailablePlayers({ search = "", status = "", limit = 50, excludeUserId = "" } = {}) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (status) params.set("status", status);
  if (limit) params.set("limit", String(limit));
  if (excludeUserId) params.set("excludeUserId", excludeUserId);

  const queryString = params.toString();
  return requestJson(`/api/players/available${queryString ? `?${queryString}` : ""}`, { ttlMs: 5000 });
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
export async function fetchFacultyStudents({ department = "", branch = "", batchYear = "", search = "", page = 1, limit = 50 } = {}) {
  const params = new URLSearchParams();
  if (department && department !== "ALL") params.set("department", department);
  if (branch && branch !== "ALL") params.set("branch", branch);
  if (batchYear && batchYear !== "ALL") params.set("batchYear", batchYear);
  if (search) params.set("search", search);
  params.set("page", String(page));
  params.set("limit", String(limit));

  return requestJson(`/api/faculty/students?${params.toString()}`, {
    includeAuth: true,
    cache: "no-store",
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

export async function fetchFacultyReminders() {
  return requestJson("/api/faculty/reminders", {
    includeAuth: true,
    cache: "no-store",
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

export async function fetchFacultyQuizzes() {
  return requestJson("/api/faculty/quizzes", {
    includeAuth: true,
    cache: "no-store",
  });
}

export async function deleteFacultyQuiz(id) {
  return requestJson(`/api/faculty/quizzes/${id}`, {
    method: "DELETE",
    includeAuth: true,
  });
}

export async function fetchFacultyStats() {
  return requestJson("/api/faculty/stats", {
    includeAuth: true,
    cache: "no-store",
  });
}




