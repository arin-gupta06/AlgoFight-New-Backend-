// frontend/src/services/googleAuth.js
const RAW_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const IS_VALID_CLIENT_ID =
  Boolean(RAW_CLIENT_ID) &&
  !RAW_CLIENT_ID.includes("YOUR_CLIENT_ID") &&
  RAW_CLIENT_ID.includes(".apps.googleusercontent.com");

export const GOOGLE_CLIENT_ID = IS_VALID_CLIENT_ID ? RAW_CLIENT_ID : "";

let gisScriptLoading = false;
let gisLoaded = false;
let gisInitialized = false;

export function isGoogleAuthAvailable() {
  return Boolean(GOOGLE_CLIENT_ID);
}

export function loadGoogleScript() {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.accounts?.id) {
    gisLoaded = true;
    return Promise.resolve();
  }
  if (gisScriptLoading) {
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(check);
          gisLoaded = true;
          resolve();
        }
      }, 50);
    });
  }

  gisScriptLoading = true;
  return new Promise((resolve, reject) => {
    const existing = document.getElementById("google-gis-script");
    if (existing) {
      existing.addEventListener("load", () => {
        gisLoaded = true;
        resolve();
      });
      return;
    }
    const script = document.createElement("script");
    script.id = "google-gis-script";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      gisLoaded = true;
      resolve();
    };
    script.onerror = (err) => {
      gisScriptLoading = false;
      reject(err);
    };
    document.head.appendChild(script);
  });
}

let gisCallbackRef = { onSuccess: null, onError: null };

export async function initializeGoogleSignIn(onSuccess, onError) {
  if (!GOOGLE_CLIENT_ID) {
    // If no client ID configured yet, skip GIS initialization to prevent 401 invalid_client
    return;
  }

  // Always refresh active handlers even if already initialized
  gisCallbackRef.onSuccess = onSuccess;
  gisCallbackRef.onError = onError;

  try {
    await loadGoogleScript();
    if (!window.google?.accounts?.id) return;

    if (!gisInitialized) {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => {
          if (response?.credential) {
            gisCallbackRef.onSuccess?.(response.credential);
          } else if (gisCallbackRef.onError) {
            gisCallbackRef.onError(new Error("No credential received from Google"));
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true,
        use_fedcm_for_prompt: true,
      });
      gisInitialized = true;
    }
  } catch (err) {
    if (gisCallbackRef.onError) {
      gisCallbackRef.onError(err);
    }
  }
}

export function renderGoogleButton(containerElement, options = {}, onMissingClientId = null) {
  if (!containerElement) return;

  // If Client ID is not configured yet in .env, render a placeholder button with instructions
  if (!GOOGLE_CLIENT_ID) {
    containerElement.innerHTML = "";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "google-gis-fallback-btn";
    btn.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      width: 100%;
      max-width: 380px;
      padding: 10px 16px;
      background: #131314;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 24px;
      color: #e3e3e3;
      font-size: 0.88rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    `;
    btn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24">
        <path fill="#EA4335" d="M12 5c1.54 0 2.93.56 4.01 1.48l3-3A11.94 11.94 0 0 0 12 0C7.37 0 3.39 2.65 1.44 6.52l3.66 2.84C6.03 6.64 8.76 5 12 5z"/>
        <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58l3.71 2.88c2.16-1.99 3.71-4.93 3.71-8.7z"/>
        <path fill="#FBBC05" d="M5.1 14.64A7.11 7.11 0 0 1 4.73 12c0-.92.13-1.81.37-2.64L1.44 6.52A11.96 11.96 0 0 0 0 12c0 1.92.45 3.74 1.25 5.36l3.85-2.72z"/>
        <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.71-2.88c-1.07.72-2.45 1.16-4.22 1.16-3.24 0-5.97-2.14-6.9-5.11L1.25 17.36C3.21 21.29 7.27 24 12 24z"/>
      </svg>
      <span>${options.text === "signup_with" ? "Sign up with Google" : "Sign in with Google"}</span>
    `;

    btn.onclick = () => {
      if (typeof onMissingClientId === "function") {
        onMissingClientId();
      } else {
        alert("Google Sign-In configuration required: Please add VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com to frontend/.env");
      }
    };

    containerElement.appendChild(btn);
    return;
  }

  if (!window.google?.accounts?.id) return;

  // GIS button width must be an integer between 200 and 400 (pixels), or undefined
  const validWidth = typeof options.width === "number" ? Math.min(Math.max(options.width, 200), 400) : 360;

  window.google.accounts.id.renderButton(containerElement, {
    theme: options.theme || "filled_black",
    size: options.size || "large",
    width: validWidth,
    shape: "pill",
    text: options.text || "signin_with",
    ...options,
  });
}
