import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Login.css";
import { motion, AnimatePresence } from "framer-motion";
import { GoogleIcon, GithubIcon } from "../Common/icons/Icons";
import CompleteProfileDialog from "../Common/modals/CompleteProfileDialog";
import { emailPasswordSignIn, googleSignIn, githubSignIn } from "../../firebaseConfig.js";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { useNotification } from "../../contexts/NotificationContext.jsx";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOAuthModal, setShowOAuthModal] = useState(false);
  const [oauthToken, setOauthToken] = useState(null);
  const [oauthUser, setOauthUser] = useState(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { notify } = useNotification();

  useEffect(() => {
    if (user && !showOAuthModal) {
      navigate("/home");
    }
  }, [user, navigate, showOAuthModal]);

  const handleSubmit = async (e) => {
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
      const res = await emailPasswordSignIn(email.trim(), password);
      if (res.notice) notify(res.notice);
      if (res.user) {
        navigate("/home");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    try {
      const result = await googleSignIn();
      if (result?.notice) notify(result.notice);
      if (result?.user) {
        const token = await result.user.getIdToken();
        setOauthToken(token);
        setOauthUser(result.user);
        setShowOAuthModal(true);
      }
    } catch {
      notify({ type: "error", title: "Sign-In Error", message: "Google sign-in failed." });
    }
  };

  const handleGithubAuth = async () => {
    try {
      const result = await githubSignIn();
      if (result?.notice) notify(result.notice);
      if (result?.user) {
        const token = await result.user.getIdToken();
        setOauthToken(token);
        setOauthUser(result.user);
        setShowOAuthModal(true);
      }
    } catch {
      notify({ type: "error", title: "Sign-In Error", message: "GitHub sign-in failed." });
    }
  };

  return (
    <div className="login-page">
      <AnimatePresence mode="wait">
        {!showOAuthModal ? (
          <motion.div
            key="login-form-container"
            initial={{ opacity: 0, scale: 0.96, x: -40 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.92, x: 40 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            style={{ width: "100%", display: "flex", justifyContent: "center" }}
          >
            <form className="Login-Container" onSubmit={handleSubmit}>
              <div className="Login-Header">
                <Link to="/" style={{ color: '#00f0ff', fontSize: '0.85rem', textDecoration: 'none', marginBottom: '8px', display: 'inline-block' }}>← Back to Overview</Link>
                <h2>LOGIN TO ALGOFIGHT</h2>
                <span className="auth-subtitle">ENTER THE ARENA WITH YOUR CREDENTIALS</span>
              </div>

              <div className="input-group">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Primary / College Email"
                  autoComplete="email"
                />
                <p className="error-message">{emailError || "\u00A0"}</p>
              </div>

              <div className="input-group">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  autoComplete="current-password"
                />
                <p className="error-message">{passwordError || "\u00A0"}</p>
              </div>

              <div className="auth-switch-text">
                <span>Don't have an account?</span>
                <Link to="/signup" className="signup-link">Sign Up</Link>
              </div>

              <div className="Login-Separator">
                <span>OR CONTINUE WITH</span>
              </div>

              <div className="Login-Social-Options">
                <button className="social-btn google" type="button" onClick={handleGoogleAuth} aria-label="Google Login">
                  <GoogleIcon size={20} />
                  <span>Google</span>
                </button>
                <button className="social-btn github" type="button" onClick={handleGithubAuth} aria-label="GitHub Login">
                  <GithubIcon size={20} />
                  <span>GitHub</span>
                </button>
              </div>

              <button type="submit" className="auth-submit-btn" disabled={loading}>
                {loading ? "AUTHENTICATING..." : "ENTER ARENA"}
              </button>

              <div style={{ marginTop: "16px", textAlign: "center" }}>
                <Link
                  to="/student-login"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    width: "100%",
                    padding: "11px 16px",
                    background: "rgba(0, 240, 255, 0.08)",
                    border: "1px solid rgba(0, 240, 255, 0.35)",
                    borderRadius: "8px",
                    color: "#00f0ff",
                    fontSize: "0.82rem",
                    fontWeight: "700",
                    letterSpacing: "0.06em",
                    textDecoration: "none",
                    transition: "all 0.2s ease"
                  }}
                >
                  🏛️ STUDENT LOGIN (MITS GWALIOR & COLLEGES) →
                </Link>
              </div>
            </form>
          </motion.div>
        ) : (
          <CompleteProfileDialog
            key="complete-profile-dialog"
            user={oauthUser || user}
            authToken={oauthToken}
            onComplete={() => navigate("/home")}
            onSkip={() => navigate("/home")}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default Login;
