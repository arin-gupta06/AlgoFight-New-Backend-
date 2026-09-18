// frontend/src/services/authStorage.js
const SESSION_TOKEN_KEY = "algofight_session_token";
const USER_PROFILE_KEY = "algofight_user_profile";

export function getSessionToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(SESSION_TOKEN_KEY);
}

export function setSessionToken(token) {
  if (typeof window === "undefined") return;
  if (token) {
    localStorage.setItem(SESSION_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(SESSION_TOKEN_KEY);
  }
}

export function getStoredUser() {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_PROFILE_KEY);
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user) {
  if (typeof window === "undefined") return;
  if (user) {
    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_PROFILE_KEY);
  }
}

export function clearAuthStorage() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_TOKEN_KEY);
  localStorage.removeItem(USER_PROFILE_KEY);
}
