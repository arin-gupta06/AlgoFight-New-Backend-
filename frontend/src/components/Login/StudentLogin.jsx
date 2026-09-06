import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import "./StudentLogin.css";
import { GoogleIcon } from "../Common/icons/Icons";
import { emailPasswordSignIn, emailPasswordSignUp, googleSignIn } from "../../firebaseConfig.js";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { useNotification } from "../../contexts/NotificationContext.jsx";
import { resolveStudentEmail, syncStudentToBackend } from "../../services/api.js";

function StudentLogin() {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [detectionState, setDetectionState] = useState(null); // { isSupportedInstitute, instituteName, isValidFormat, preview, message }
  const [formError, setFormError] = useState("");

  const navigate = useNavigate();
  const { user } = useAuth();
  const { notify } = useNotification();

  useEffect(() => {
    if (user) {
      navigate("/home");
    }
  }, [user, navigate]);

  // Live institute detection debounced
  useEffect(() => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes("@") || trimmed.split("@")[1]?.length < 3) {
      setDetectionState(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await resolveStudentEmail(trimmed);
        setDetectionState(res);
      } catch {
        // Silent catch for pre-auth typing
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [email]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setFormError("Institutional email is required.");
      return;
    }

    if (!password || password.length < 6) {
      setFormError("Password must be at least 6 characters.");
      return;
    }

    if (mode === "register" && !username.trim()) {
      setFormError("Username is required for registration.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "login") {
        const res = await emailPasswordSignIn(trimmedEmail, password);
        if (res.notice) notify(res.notice);
        if (res.user) {
          const token = await res.user.getIdToken();
          try {
            await syncStudentToBackend({
              uid: res.user.uid,
              email: trimmedEmail,
              displayName: res.user.displayName || username,
              authToken: token,
            });
          } catch {
            // Already synced or fallback
          }
          navigate("/profile");
        }
      } else {
        // Register flow
        const res = await emailPasswordSignUp({
          email: trimmedEmail,
          password,
          username: username.trim(),
          userType: "STUDENT",
          institutionName: detectionState?.instituteName || "MITS Gwalior",
        });

        if (res.notice) notify(res.notice);
        if (res.user) {
          const token = await res.user.getIdToken();
          await syncStudentToBackend({
            uid: res.user.uid,
            email: trimmedEmail,
            displayName: username.trim(),
            authToken: token,
          });
          notify({
            type: "success",
            title: "Student Identity Verified",
            message: "Welcome! Your institutional profile has been established.",
          });
          navigate("/profile");
        }
      }
    } catch (err) {
      setFormError(err.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    try {
      const result = await googleSignIn();
      if (!result?.user) return;

      const verifiedEmail = result.user.email?.toLowerCase();
      const token = await result.user.getIdToken();

      // Check if the Google email belongs to a supported college
      const resolution = await resolveStudentEmail(verifiedEmail);
      if (!resolution.isSupportedInstitute) {
        notify({
          type: "warning",
          title: "Personal Account Detected",
          message: `Signed in with ${verifiedEmail}. For institutional features & rank, please sign in with your college email.`,
        });
        navigate("/home");
        return;
      }

      // Synchronize through canonical student identity pipeline
      await syncStudentToBackend({
        uid: result.user.uid,
        email: verifiedEmail,
        displayName: result.user.displayName || verifiedEmail.split("@")[0],
        authToken: token,
      });

      notify({
        type: "success",
        title: "🎓 Institutional Identity Verified",
        message: `${resolution.instituteName} verified from Google account!`,
      });
      navigate("/profile");
    } catch (err) {
      notify({
        type: "error",
        title: "Google Authentication Failed",
        message: err.message || "Failed to sign in with Google.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="student-login-page">
      <motion.div
        className="student-login-card"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      >
        <div className="student-login-header">
          <Link to="/login" className="back-link">
            ← Back to Standard Login
          </Link>
          <div className="badge-wrapper">
            <span className="institute-pill">🏛️ MITS GWALIOR / INSTITUTIONAL ACCESS</span>
          </div>
          <h2>STUDENT ARENA ACCESS</h2>
          <p className="subtitle">
            Instant academic recognition powered by verified institutional email
          </p>
        </div>

        {/* Mode Switcher (Login vs Register) */}
        <div className="student-auth-tabs">
          <button
            type="button"
            className={`tab-btn ${mode === "login" ? "active" : ""}`}
            onClick={() => { setMode("login"); setFormError(""); }}
          >
            STUDENT SIGN IN
          </button>
          <button
            type="button"
            className={`tab-btn ${mode === "register" ? "active" : ""}`}
            onClick={() => { setMode("register"); setFormError(""); }}
          >
            REGISTER STUDENT ID
          </button>
        </div>

        <form onSubmit={handleSubmit} className="student-form">
          {mode === "register" && (
            <div className="input-field">
              <label htmlFor="student-username">Arena Handle / Name</label>
              <input
                id="student-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. CyberWarrior or Full Name"
                autoComplete="username"
              />
            </div>
          )}

          <div className="input-field">
            <label htmlFor="student-email">Verified Institutional Email</label>
            <input
              id="student-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. 24ai10ar16@mitsgwl.ac.in"
              autoComplete="email"
              required
            />
          </div>

          {/* Live Dynamic Detection Card */}
          <AnimatePresence>
            {detectionState && (
              <motion.div
                className={`detection-card ${
                  detectionState.isSupportedInstitute && detectionState.isValidFormat
                    ? "success"
                    : detectionState.isSupportedInstitute
                    ? "warning"
                    : "danger"
                }`}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                {detectionState.isSupportedInstitute && detectionState.isValidFormat && detectionState.preview ? (
                  <div className="detection-content">
                    <div className="detection-title">
                      <span className="indicator-dot green" />
                      <strong>{detectionState.instituteName} Identified</strong>
                    </div>
                    <div className="detection-grid">
                      <div className="grid-item">
                        <span className="grid-label">Branch</span>
                        <span className="grid-val">{detectionState.preview.identity.branchName}</span>
                      </div>
                      <div className="grid-item">
                        <span className="grid-label">Batch</span>
                        <span className="grid-val">{detectionState.preview.identity.admissionYear}</span>
                      </div>
                      <div className="grid-item">
                        <span className="grid-label">Current Year</span>
                        <span className="grid-val">{detectionState.preview.academicProfile.yearLabel}</span>
                      </div>
                      <div className="grid-item">
                        <span className="grid-label">Semester</span>
                        <span className="grid-val">{detectionState.preview.academicProfile.semesterLabel}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="detection-error">
                    <span className="indicator-dot red" />
                    <span>{detectionState.message || "Invalid institutional email"}</span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="input-field">
            <label htmlFor="student-password">Password</label>
            <input
              id="student-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>

          {formError && <p className="form-error-text">{formError}</p>}

          <button
            type="submit"
            className="student-submit-btn"
            disabled={loading}
          >
            {loading ? "AUTHENTICATING..." : mode === "login" ? "ENTER ARENA WITH STUDENT ID" : "VERIFY & REGISTER"}
          </button>

          <div className="student-separator">
            <span>OR CONNECT WITH GOOGLE</span>
          </div>

          <button
            type="button"
            className="student-google-btn"
            onClick={handleGoogleAuth}
            disabled={loading}
          >
            <GoogleIcon size={20} />
            <span>Continue with College Google Account</span>
          </button>
        </form>

        <div className="student-footer-note">
          <p>
            ℹ️ AlgoFight detects your college, batch, branch, and dynamic semester automatically. No manual college selection required.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export default StudentLogin;
