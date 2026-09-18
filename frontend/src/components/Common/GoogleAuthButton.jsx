import React, { useEffect, useRef, useState } from "react";
import { GoogleIcon } from "./icons/Icons";
import {
  GOOGLE_CLIENT_ID,
  initializeGoogleSignIn,
  renderGoogleButton,
} from "../../services/googleAuth";
import { useNotification } from "../../contexts/NotificationContext";

export default function GoogleAuthButton({
  mode = "signin", // "signin" | "signup"
  onSuccess,
  onError,
  loading = false,
}) {
  const containerRef = useRef(null);
  const [gisRendered, setGisRendered] = useState(false);
  const { notify } = useNotification();

  const label = mode === "signup" ? "Sign up with Google" : "Sign in with Google";

  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);

  // Keep refs pointing at the latest handlers on every render
  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  });

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      return;
    }

    const init = async () => {
      try {
        await initializeGoogleSignIn(
          (credential) => onSuccessRef.current?.(credential),
          (err) => onErrorRef.current?.(err)
        );

        if (containerRef.current) {
          renderGoogleButton(
            containerRef.current,
            {
              theme: "filled_black",
              size: "large",
              text: mode === "signup" ? "signup_with" : "signin_with",
              width: 380,
            },
            () => {
              notify({
                type: "warning",
                title: "Google OAuth Setup",
                message: "Please configure VITE_GOOGLE_CLIENT_ID in frontend/.env",
              });
            }
          );
          setGisRendered(true);
        }
      } catch (e) {
        console.warn("GIS button setup error:", e);
      }
    };

    init();
  }, [mode, notify]);

  const handleManualClick = () => {
    if (!GOOGLE_CLIENT_ID) {
      notify({
        type: "warning",
        title: "Google OAuth Setup Required",
        message: "Please define VITE_GOOGLE_CLIENT_ID in frontend/.env with your Google Cloud Client ID.",
        duration: 5000,
      });
      return;
    }

    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          console.warn("One-tap dismissed or not displayed");
        }
      });
    }
  };

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        minHeight: "48px",
      }}
    >
      {/* Official GIS container if Google client ID is configured */}
      <div
        ref={containerRef}
        style={{
          display: gisRendered ? "flex" : "none",
          justifyContent: "center",
          width: "100%",
        }}
      />

      {/* Guaranteed Always-Visible Cyber Google Button (Active fallback or primary when GIS iframe is pending) */}
      {!gisRendered && (
        <button
          type="button"
          onClick={handleManualClick}
          disabled={loading}
          className="google-auth-button-ui"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            width: "100%",
            height: "48px",
            background: "rgba(10, 20, 34, 0.8)",
            border: "1px solid rgba(0, 229, 255, 0.28)",
            borderRadius: "50px",
            color: "#ffffff",
            fontFamily: "'Inter', sans-serif",
            fontSize: "0.95rem",
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.25s ease",
            boxShadow: "0 4px 18px rgba(0, 0, 0, 0.5), inset 0 0 10px rgba(0, 229, 255, 0.05)",
          }}
        >
          <GoogleIcon size={20} />
          <span>{loading ? "Authenticating..." : label}</span>
        </button>
      )}
    </div>
  );
}
