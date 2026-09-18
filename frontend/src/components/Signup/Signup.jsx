import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Signup.css";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../contexts/AuthContext";
import { useNotification } from "../../contexts/NotificationContext.jsx";
import GoogleAuthButton from "../Common/GoogleAuthButton.jsx";

function Signup() {
  const [authMethod, setAuthMethod] = useState("google"); // "google" | "manual"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { user, signupManual, loginWithGoogle } = useAuth();
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
        title: "Account Created",
        message: "Welcome to AlgoFight! Signed up with Google.",
      });
      navigate("/home");
    } catch (err) {
      notify({
        type: "error",
        title: "Sign-Up Failed",
        message: err?.message || "Google registration failed.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = (err) => {
    console.warn("GIS signup error:", err);
    notify({
      type: "error",
      title: "Google Sign-Up Error",
      message: err?.message || "Could not complete Google Sign-Up.",
    });
  };

  const validateManual = () => {
    const errs = {};
    const cleanEmail = email.trim();

    if (!cleanEmail) {
      errs.email = "Email address is required";
    } else if (!/\S+@\S+\.\S+/.test(cleanEmail)) {
      errs.email = "Invalid email format";
    }

    if (!password) {
      errs.password = "Password is required";
    } else if (password.length < 6) {
      errs.password = "Password must be at least 6 characters";
    }

    if (password !== confirmPassword) {
      errs.confirmPassword = "Passwords do not match";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleManualSignUp = async (e) => {
    e.preventDefault();
    if (!validateManual()) return;

    setLoading(true);
    try {
      const cleanEmail = email.trim();
      const defaultUsername = cleanEmail.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "");

      await signupManual({
        email: cleanEmail,
        password,
        username: defaultUsername,
        userType: "INDIVIDUAL",
      });

      notify({
        type: "success",
        title: "Account Created",
        message: "Welcome to AlgoFight! Your account is ready.",
      });
      navigate("/home");
    } catch (err) {
      notify({
        type: "error",
        title: "Sign-Up Failed",
        message: err?.message || "Registration failed.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-page">
      <motion.div
        key="signup-form-container"
        initial={{ opacity: 0, scale: 0.96, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        style={{ width: "100%", display: "flex", justifyContent: "center" }}
      >
        <div className="Signup-Container">
          <div className="Signup-Heading">
            <h1>Create an Account</h1>
            <p>Join the next generation of competitive programmers</p>
          </div>

          {/* Segmented Slidable Switcher */}
          <div className="auth-mode-switch" role="tablist" aria-label="Sign-up methods">
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
                key="signup-google-view"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="google-tab-content"
              >
                <GoogleAuthButton
                  mode="signup"
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  loading={loading}
                />
              </motion.div>
            ) : (
              <motion.form
                key="signup-manual-view"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                onSubmit={handleManualSignUp}
                className="Signup-Form-Options"
              >
                {/* Email Address */}
                <div className="input-group">
                  <input
                    type="email"
                    placeholder="Email Address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                  <p className="error-message">{errors.email || "\u00A0"}</p>
                </div>

                {/* Password */}
                <div className="input-group">
                  <input
                    type="password"
                    placeholder="Password (min 6 characters)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                  <p className="error-message">{errors.password || "\u00A0"}</p>
                </div>

                {/* Confirm Password */}
                <div className="input-group">
                  <input
                    type="password"
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                  <p className="error-message">{errors.confirmPassword || "\u00A0"}</p>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  className="auth-submit-btn"
                  disabled={loading}
                  style={{ marginTop: "8px", width: "100%" }}
                >
                  {loading ? "INITIALIZING COMBAT TAG..." : "CREATE ACCOUNT"}
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Bottom Switch to Login */}
          <div className="auth-switch-text" style={{ marginTop: "20px" }}>
            <span>Already registered?</span>
            <Link to="/login" className="Login-link">
              Login
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default Signup;
