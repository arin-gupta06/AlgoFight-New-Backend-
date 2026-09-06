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

export async function requestJson(path, options = {}) {
  const {
    includeAuth = false,
    headers,
    ...restOptions
  } = options;

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

  return parsedBody;
}

/**
 * Sync Firebase user to backend after login/signup
 */
export async function syncUserToBackend({ uid, email, displayName, photoURL, authToken, githubUrl, linkedinUrl }) {
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
  return requestJson("/api/leaderboard");
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

  return requestJson(`/api/problems?${params.toString()}`);
}

/**
 * Fetch one problem with only public testcase data.
 */
export async function fetchProblemById(problemId) {
  return requestJson(`/api/problems/${problemId}`);
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
  return requestJson(`/api/players/available${queryString ? `?${queryString}` : ""}`);
}

export async function fetchUserNotifications(userId) {
  if (!userId) return { notifications: [], unreadCount: 0, total: 0 };
  return requestJson(`/api/notifications?userId=${encodeURIComponent(userId)}`, { includeAuth: true });
}

export async function markNotificationAsRead(userId, notificationId) {
  if (!userId || !notificationId) return { success: false };
  return requestJson(`/api/notifications/${encodeURIComponent(notificationId)}/read`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
    includeAuth: true
  });
}

export async function markAllNotificationsAsRead(userId) {
  if (!userId) return { count: 0 };
  return requestJson(`/api/notifications/read-all`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
    includeAuth: true
  });
}

export async function clearUserNotifications(userId) {
  if (!userId) return { success: false };
  return requestJson(`/api/notifications`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
    includeAuth: true
  });
}

export async function fetchActiveSystemAnnouncements() {
  return requestJson(`/api/notifications/active-broadcasts`);
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

export async function fetchAdminAuditLogs(adminKey, { category = "ALL", severity = "ALL", search = "", limit = 50 } = {}) {
  const params = new URLSearchParams();
  if (category && category !== "ALL") params.set("category", category);
  if (severity && severity !== "ALL") params.set("severity", severity);
  if (search) params.set("search", search);
  if (limit) params.set("limit", String(limit));

  const query = params.toString() ? `?${params.toString()}` : "";
  return requestJson(`/api/admin/audit-logs${query}`, {
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



