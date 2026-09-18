/**
 * Client-Side Crash-Proof Recovery Layer (IndexedDB)
 * Ensures user code and progress during Battles, Quizzes, and Exams
 * is never lost even during unexpected browser crashes, tab reloads,
 * or temporary Redis/WebSocket outages.
 */

const DB_NAME = "algofight_recovery_db";
const DB_VERSION = 1;
const DRAFTS_STORE = "drafts";

let dbPromise = null;

function getDraftKey(activityType, activityId, problemId, userId) {
  return `${activityType || "battle"}_${activityId || "default"}_${problemId || "p0"}_${userId || "anon"}`;
}

function openDatabase() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB is not available in this environment."));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(DRAFTS_STORE)) {
        const store = db.createObjectStore(DRAFTS_STORE, { keyPath: "draftKey" });
        store.createIndex("activityId", "activityId", { unique: false });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      console.error("Failed to open IndexedDB:", event.target.error);
      reject(event.target.error);
    };
  });

  return dbPromise;
}

/**
 * Save draft locally with optimistic monotonic revision tracking.
 */
export async function saveLocalDraft({
  activityType = "battle",
  activityId,
  problemId,
  userId,
  code,
  language = "javascript",
}) {
  const draftKey = getDraftKey(activityType, activityId, problemId, userId);
  const now = Date.now();

  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([DRAFTS_STORE], "readwrite");
      const store = tx.objectStore(DRAFTS_STORE);
      const getReq = store.get(draftKey);

      getReq.onsuccess = () => {
        const existing = getReq.result;
        const localRevision = (existing?.localRevision || 0) + 1;
        const lastAckedRevision = existing?.lastAckedRevision || 0;

        const record = {
          draftKey,
          activityType,
          activityId,
          problemId,
          userId,
          code,
          language,
          localRevision,
          lastAckedRevision,
          syncStatus: "pending_sync",
          updatedAt: now,
        };

        const putReq = store.put(record);
        putReq.onsuccess = () => resolve(record);
        putReq.onerror = () => reject(putReq.error);
      };

      getReq.onerror = () => reject(getReq.error);
    });
  } catch (err) {
    // Graceful fallback to localStorage
    try {
      const key = `af_draft_${draftKey}`;
      const existing = JSON.parse(localStorage.getItem(key) || "{}");
      const localRevision = (existing.localRevision || 0) + 1;
      const record = {
        draftKey,
        activityType,
        activityId,
        problemId,
        userId,
        code,
        language,
        localRevision,
        lastAckedRevision: existing.lastAckedRevision || 0,
        syncStatus: "pending_sync",
        updatedAt: now,
      };
      localStorage.setItem(key, JSON.stringify(record));
      return record;
    } catch {
      return null;
    }
  }
}

/**
 * Marks server acknowledgment of a sync revision.
 */
export async function markDraftAcked({ draftKey, revision }) {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction([DRAFTS_STORE], "readwrite");
      const store = tx.objectStore(DRAFTS_STORE);
      const getReq = store.get(draftKey);

      getReq.onsuccess = () => {
        const record = getReq.result;
        if (record) {
          record.lastAckedRevision = Math.max(record.lastAckedRevision || 0, revision);
          if (record.lastAckedRevision >= record.localRevision) {
            record.syncStatus = "synced";
          }
          store.put(record);
        }
        resolve(true);
      };

      getReq.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/**
 * Updates sync status (e.g. 'degraded', 'pending_sync', 'synced').
 */
export async function setDraftSyncStatus(draftKey, status) {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction([DRAFTS_STORE], "readwrite");
      const store = tx.objectStore(DRAFTS_STORE);
      const getReq = store.get(draftKey);

      getReq.onsuccess = () => {
        const record = getReq.result;
        if (record) {
          record.syncStatus = status;
          store.put(record);
        }
        resolve(true);
      };

      getReq.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/**
 * Retrieves the local draft for quick recovery on mount or tab reconnect.
 */
export async function getLocalDraft(activityType, activityId, problemId, userId) {
  const draftKey = getDraftKey(activityType, activityId, problemId, userId);

  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction([DRAFTS_STORE], "readonly");
      const store = tx.objectStore(DRAFTS_STORE);
      const req = store.get(draftKey);

      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    try {
      const key = `af_draft_${draftKey}`;
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}

/**
 * Clears local draft when a battle/exam problem is submitted or match ends cleanly.
 */
export async function clearDraft(activityType, activityId, problemId, userId) {
  const draftKey = getDraftKey(activityType, activityId, problemId, userId);

  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction([DRAFTS_STORE], "readwrite");
      const store = tx.objectStore(DRAFTS_STORE);
      const req = store.delete(draftKey);

      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  } catch {
    try {
      localStorage.removeItem(`af_draft_${draftKey}`);
      return true;
    } catch {
      return false;
    }
  }
}
