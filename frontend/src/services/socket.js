// frontend/src/services/socket.js
export const getWsUrl = () => {
  const envWs = (import.meta.env.VITE_WS_URL || "").trim();
  const envApi = (import.meta.env.VITE_API_URL || "").trim();
  const isLocal = typeof window !== "undefined" && 
      (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

  // Helper to convert any HTTP/HTTPS or raw hostname to a valid WebSocket (ws:// or wss://) URL
  const normalizeToWs = (url, isApiPath = false) => {
    if (!url) return null;
    let clean = url.trim();

    // Convert http/https schemes to ws/wss
    if (clean.startsWith("https://")) {
      clean = clean.replace(/^https:\/\//, "wss://");
    } else if (clean.startsWith("http://")) {
      if (typeof window !== "undefined" && window.location.protocol === "https:") {
        clean = clean.replace(/^http:\/\//, "wss://");
      } else {
        clean = clean.replace(/^http:\/\//, "ws://");
      }
    } else if (!clean.startsWith("ws://") && !clean.startsWith("wss://")) {
      const proto = (typeof window !== "undefined" && window.location.protocol === "https:") ? "wss://" : "ws://";
      clean = `${proto}${clean.replace(/^\/+/, "")}`;
    }

    // Force WSS on HTTPS deployment to prevent browser mixed-content blockage
    if (typeof window !== "undefined" && window.location.protocol === "https:" && clean.startsWith("ws://")) {
      if (!clean.includes("localhost") && !clean.includes("127.0.0.1")) {
        clean = clean.replace(/^ws:\/\//, "wss://");
      }
    }

    // Strip trailing /api and trailing slashes
    clean = clean.replace(/\/api\/?$/, "").replace(/\/+$/, "");

    // If derived from API server or if path is omitted, append /ws
    if (isApiPath || clean.endsWith(".onrender.com") || clean.endsWith(".railway.app") || clean.endsWith(".fly.dev")) {
      if (!clean.endsWith("/ws")) {
        clean = `${clean}/ws`;
      }
    }

    return clean;
  };

  // 1. Explicit VITE_WS_URL configured in deployment platform
  if (envWs) {
    if (!isLocal && (envWs.includes("localhost") || envWs.includes("127.0.0.1"))) {
      // Ignore local localhost WS_URL if bundled into production deployment
    } else {
      const normalized = normalizeToWs(envWs, false);
      if (normalized) return normalized;
    }
  }

  // 2. Derive automatically from VITE_API_URL if configured
  if (envApi) {
    if (!isLocal && (envApi.includes("localhost") || envApi.includes("127.0.0.1"))) {
      // Ignore local localhost API_URL if bundled into production deployment
    } else {
      const normalized = normalizeToWs(envApi, true);
      if (normalized) return normalized;
    }
  }

  // 3. Deployed browser fallback (reverse proxy / same domain)
  if (typeof window !== "undefined" && !isLocal) {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}/ws`;
  }

  // 4. Default local development URL
  return "ws://127.0.0.1:4001";
};

export const WS_URL = getWsUrl();

class BrowserSocketClient {
  constructor() {
    this.ws = null;
    this.listeners = new Map();
    this.connected = false;
    this.auth = {};
    
    // Reconnection State
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 6;
    this.reconnectTimeout = null;
    this.intentionalDisconnect = false;

    // Heartbeat State
    this.pingInterval = null;
  }

  connect() {
    this.intentionalDisconnect = false;

    // If socket is already connected or currently connecting, do not create a second socket
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      if (this.ws.readyState === WebSocket.OPEN && (this.auth?.uid || this.auth?.userId)) {
        this.emit("auth", {
          token: this.auth.token,
          userId: this.auth.uid || this.auth.userId,
          username: this.auth.username || this.auth.displayName || "Player",
          email: this.auth.email,
        });
      }
      return;
    }

    try {
      const wsUrl = getWsUrl();
      const ws = new WebSocket(wsUrl);
      this.ws = ws;

      ws.onopen = () => {
        if (this.ws !== ws) return; // Stale instance check
        this.connected = true;
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        this.trigger("connect");

        if (this.auth?.uid || this.auth?.userId) {
          this.emit("auth", {
            token: this.auth.token,
            userId: this.auth.uid || this.auth.userId,
            username: this.auth.username || this.auth.displayName || "Player",
            email: this.auth.email,
          });
        }
      };

      ws.onmessage = (event) => {
        if (this.ws !== ws) return; // Stale instance check
        try {
          if (event.data === "pong") return;
          
          const raw = JSON.parse(event.data);
          const eventName = raw.event || raw.action || raw.type;
          if (eventName) {
            const data = raw.payload !== undefined
              ? (typeof raw.payload === "object" ? { ...raw, ...raw.payload } : raw.payload)
              : raw;
            this.trigger(eventName, data);
          }
        } catch (e) {
          console.error("Socket parse error:", e);
        }
      };

      ws.onclose = () => {
        if (this.ws !== ws) return; // Stale instance check
        this.connected = false;
        this.stopHeartbeat();
        this.trigger("disconnect");
        this.handleReconnect();
      };

      ws.onerror = (err) => {
        if (this.ws !== ws) return; // Stale instance check
        this.trigger("connect_error", err);
      };
    } catch (err) {
      this.trigger("connect_error", err);
      this.handleReconnect();
    }
  }

  handleReconnect() {
    if (this.intentionalDisconnect) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    if (this.reconnectTimeout) return; // Already scheduled
    
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn("[WebSocket] Max reconnect attempts reached. Will retry on next interaction.");
      return;
    }

    const baseDelay = Math.pow(2, this.reconnectAttempts) * 1000;
    const cappedDelay = Math.min(baseDelay, 15000);
    const jitter = Math.floor(Math.random() * 300);
    const delay = cappedDelay + jitter;

    this.reconnectAttempts++;
    console.log(`[WebSocket] Disconnected. Reconnecting in ${delay}ms (Attempt ${this.reconnectAttempts})...`);
    
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      if (!this.intentionalDisconnect) {
        this.connect();
      }
    }, delay);
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ action: "ping", type: "ping" }));
      }
    }, 25000);
  }

  stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);

    // If component registers for "connect" and socket is ALREADY connected, immediately notify on next tick
    if (event === "connect" && this.connected && this.ws?.readyState === WebSocket.OPEN) {
      setTimeout(() => {
        try {
          callback();
        } catch (e) {
          console.error("[WebSocket] Connect callback error:", e);
        }
      }, 0);
    }

    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (!callback) {
      this.listeners.delete(event);
      return;
    }
    const set = this.listeners.get(event);
    if (set) {
      set.delete(callback);
    }
  }

  emit(action, data = {}) {
    const payload = JSON.stringify({ action, type: action, ...data });
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(payload);
    } else {
      const onOpen = () => {
        if (this.ws) {
          this.ws.removeEventListener("open", onOpen);
        }
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(payload);
        }
      };
      if (this.ws) {
        this.ws.addEventListener("open", onOpen);
      } else {
        this.connect();
        if (this.ws) {
          this.ws.addEventListener("open", onOpen);
        }
      }
    }
  }

  send(action, data = {}) {
    this.emit(action, data);
  }

  trigger(event, data) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach((cb) => {
        try {
          cb(data);
        } catch (err) {
          console.error(`Error in listener for ${event}:`, err);
        }
      });
    }
  }

  disconnect() {
    this.intentionalDisconnect = true;
    this.stopHeartbeat();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.ws) {
      const closingWs = this.ws;
      this.ws = null;
      this.connected = false;
      
      // Detach listeners to prevent old events from leaking
      closingWs.onopen = null;
      closingWs.onmessage = null;
      closingWs.onerror = null;
      closingWs.onclose = null;
      
      try {
        closingWs.close();
      } catch (e) {
        // Ignore close errors on teardown
      }
    }
  }
}

let socketInstance = null;

export function getSocket() {
  if (!socketInstance) {
    socketInstance = new BrowserSocketClient();
  }
  return socketInstance;
}

export function connectSocket(token, uid, username) {
  const s = getSocket();
  s.auth = {
    ...(token ? { token } : {}),
    ...(uid ? { uid, userId: uid } : {}),
    ...(username ? { username, displayName: username } : {}),
  };
  s.connect();
  return s;
}

export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
  }
}
