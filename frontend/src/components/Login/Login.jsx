import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Login.css";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { useNotification } from "../../contexts/NotificationContext.jsx";
import GoogleAuthButton from "../Common/GoogleAuthButton.jsx";

function Login() {
  const [authMethod, setAuthMethod] = useState("google"); // "google" | "manual"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { user, loginManual, loginWithGoogle } = useAuth();
  const { notify } = useNotification();

  useEffect(() => {
    if (user) {
      navigate("/home");
    }
  }, [user, navigate]);

  const handleGoogleSuccess = async (credential) => {
    setLoading(true);
    try {
      await loginWithGoogle(credential);
      notify({
        type: "success",
        title: "Signed In",
        message: "Welcome back! Signed in with Google.",
      });
      navigate("/home");
    } catch (err) {
      notify({
        type: "error",
        title: "Sign-In Failed",
        message: err?.message || "Google authentication failed.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = (err) => {
    console.warn("GIS login error:", err);
    notify({
      type: "error",
      title: "Google Sign-In Error",
      message: err?.message || "Could not complete Google Sign-In.",
    });
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    setEmailError("");
    setPasswordError("");

    let isValid = true;
    if (!email.trim()) {
      setEmailError("Email address is required");
      isValid = false;
    }
    if (!password.trim()) {
      setPasswordError("Password is required");
      isValid = false;
    }
    if (!isValid) return;

    setLoading(true);
    try {
      await loginManual(email.trim(), password);
      notify({
        type: "success",
        title: "Signed In",
        message: "Welcome back!",
      });
      navigate("/home");
    } catch (err) {
      notify({
        type: "error",
        title: "Sign-In Failed",
        message: err?.message || "Invalid email or password.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <motion.div
        key="login-form-container"
        initial={{ opacity: 0, scale: 0.96, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        style={{ width: "100%", display: "flex", justifyContent: "center" }}
      >
        <div className="Login-Container">
          <div className="Login-Heading">
            <h1>Welcome Back</h1>
            <p>Enter the competitive coding arena</p>
          </div>

          {/* Segmented Slidable Switcher */}
          <div className="auth-mode-switch" role="tablist" aria-label="Sign-in methods">
            <button
              type="button"
              role="tab"
              aria-selected={authMethod === "google"}
              className={`auth-mode-btn ${authMethod === "google" ? "active" : ""}`}
              onClick={() => setAuthMethod("google")}
            >
              <span>⚡ Google One-Tap</span>
              {authMethod === "google" && (
                <motion.div
                  className="auth-mode-pill"
                  layoutId="auth-mode-pill"
                  transition={{ type: "spring", stiffness: 450, damping: 35 }}
                />
              )}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={authMethod === "manual"}
              className={`auth-mode-btn ${authMethod === "manual" ? "active" : ""}`}
              onClick={() => setAuthMethod("manual")}
            >
              <span>✉️ Email & Password</span>
              {authMethod === "manual" && (
                <motion.div
                  className="auth-mode-pill"
                  layoutId="auth-mode-pill"
                  transition={{ type: "spring", stiffness: 450, damping: 35 }}
                />
              )}
            </button>
          </div>

          {/* Mutually Exclusive Views */}
          <AnimatePresence mode="wait">
            {authMethod === "google" ? (
              <motion.div
                key="login-google-view"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="google-tab-content"
              >
                <GoogleAuthButton
                  mode="signin"
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  loading={loading}
                />
              </motion.div>
            ) : (
              <motion.form
                key="login-manual-view"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                onSubmit={handleManualSubmit}
                className="Login-Box"
              >
                <div className="input-group">
                  <input
                    type="email"
                    placeholder="Email Address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                  <p className="error-message">{emailError || "\u00A0"}</p>
                </div>

                <div className="input-group">
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                  <p className="error-message">{passwordError || "\u00A0"}</p>
                </div>

                <button
                  type="submit"
                  className="auth-submit-btn"
                  disabled={loading}
                  style={{ marginTop: "8px", width: "100%" }}
                >
                  {loading ? "AUTHENTICATING..." : "ENTER ARENA"}
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Bottom Switch to Sign Up */}
          <div className="auth-switch-text" style={{ marginTop: "20px" }}>
            <span>Don't have an account?</span>
            <Link to="/signup" className="signup-link">
              Sign Up
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default Login;
