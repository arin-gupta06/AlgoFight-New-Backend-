import React, { useState, useEffect } from "react";
import "./Signup.css";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { GoogleIcon, GithubIcon } from "../Common/icons/Icons";
import CompleteProfileDialog from "../Common/modals/CompleteProfileDialog";
import { emailPasswordSignUp, googleSignIn, githubSignIn } from "../../firebaseConfig.js";
import { useAuth } from "../../contexts/AuthContext";
import { useNotification } from "../../contexts/NotificationContext.jsx";

function Signup() {
  const [userType, setUserType] = useState("STUDENT"); // "STUDENT" | "FACULTY" | "INDIVIDUAL"
  const [username, setUsername] = useState("");
  const [collegeEmail, setCollegeEmail] = useState("");
  const [secondaryEmail, setSecondaryEmail] = useState("");
  const [institutionName, setInstitutionName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showOAuthModal, setShowOAuthModal] = useState(false);
  const [oauthToken, setOauthToken] = useState(null);
  const [oauthUser, setOauthUser] = useState(null);

  const navigate = useNavigate();
  const { user } = useAuth();
  const { notify } = useNotification();

  const isCollegeUser = userType === "STUDENT" || userType === "FACULTY";

  useEffect(() => {
    if (user && !showOAuthModal) {
      navigate("/home");
    }
  }, [user, navigate, showOAuthModal]);

  const validate = () => {
    const errs = {};
    if (!username.trim()) errs.username = "Username is required";

    if (isCollegeUser) {
      if (!collegeEmail.trim()) {
        errs.collegeEmail = "College / Institutional Email is mandatory";
      } else if (!/\S+@\S+\.\S+/.test(collegeEmail)) {
        errs.collegeEmail = "Invalid email format";
      }
      if (!institutionName.trim()) {
        errs.institutionName = "College / Institution name is mandatory";
      }
    } else {
      if (!collegeEmail.trim()) {
        errs.collegeEmail = "Email address is required";
      } else if (!/\S+@\S+\.\S+/.test(collegeEmail)) {
        errs.collegeEmail = "Invalid email format";
      }
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

  const handleSignUpSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const res = await emailPasswordSignUp({
        email: collegeEmail.trim(),
        password,
        username: username.trim(),
        userType,
        institutionName: isCollegeUser ? institutionName.trim() : null,
        secondaryEmail: secondaryEmail.trim() || null,
        githubUrl: githubUrl.trim() || null,
        linkedinUrl: linkedinUrl.trim() || null,
      });

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
      notify({ type: "error", title: "Sign-Up Error", message: "Google sign-up failed." });
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
      notify({ type: "error", title: "Sign-Up Error", message: "GitHub sign-up failed." });
    }
  };

  return (
    <div className="signup-page">
      <AnimatePresence mode="wait">
        {!showOAuthModal ? (
          <motion.div
            key="signup-form-container"
            initial={{ opacity: 0, scale: 0.96, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: -40 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            style={{ width: "100%", display: "flex", justifyContent: "center" }}
          >
            <form className="Signup-Container" onSubmit={handleSignUpSubmit}>
              <div className="Signup-Header">
                <Link to="/" style={{ color: '#00f0ff', fontSize: '0.85rem', textDecoration: 'none', marginBottom: '8px', display: 'inline-block' }}>← Back to Overview</Link>
                <h1>CREATE ACCOUNT</h1>
                <span className="auth-subtitle">SELECT YOUR IDENTITY & ENTER THE ARENA</span>
              </div>

              {/* Identity Category Selector */}
              <div className="role-selector-tabs">
                <button
                  type="button"
                  className={`role-tab ${userType === "STUDENT" ? "active" : ""}`}
                  onClick={() => setUserType("STUDENT")}
                >
                  🎓 Student
                </button>
                <button
                  type="button"
                  className={`role-tab ${userType === "FACULTY" ? "active" : ""}`}
                  onClick={() => setUserType("FACULTY")}
                >
                  🏛️ Faculty
                </button>
                <button
                  type="button"
                  className={`role-tab ${userType === "INDIVIDUAL" ? "active" : ""}`}
                  onClick={() => setUserType("INDIVIDUAL")}
                >
                  💻 Independent
                </button>
              </div>

              <div className="Signup-Form-Options">
                {/* Username */}
                <div className="input-group">
                  <input
                    type="text"
                    placeholder="Username / Combat Tag"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                  <p className="error-message">{errors.username || "\u00A0"}</p>
                </div>

                {/* Primary / College Email */}
                <div className="input-group">
                  <input
                    type="email"
                    placeholder={isCollegeUser ? "College / Institution Email (Mandatory)" : "Primary Email Address"}
                    value={collegeEmail}
                    onChange={(e) => setCollegeEmail(e.target.value)}
                  />
                  <p className="error-message">{errors.collegeEmail || "\u00A0"}</p>
                </div>

                {/* Institution Name (Mandatory for College users) */}
                {isCollegeUser && (
                  <div className="input-group">
                    <input
                      type="text"
                      placeholder="College / University Name (Mandatory)"
                      value={institutionName}
                      onChange={(e) => setInstitutionName(e.target.value)}
                    />
                    <p className="error-message">{errors.institutionName || "\u00A0"}</p>
                  </div>
                )}

                {/* Secondary Email (Optional) */}
                <div className="input-group">
                  <input
                    type="email"
                    placeholder="Secondary / Personal Email (Optional)"
                    value={secondaryEmail}
                    onChange={(e) => setSecondaryEmail(e.target.value)}
                  />
                  <p className="error-message">{"\u00A0"}</p>
                </div>
                {/* GitHub URL (Optional) */}
                <div className="input-group">
                  <input
                    type="url"
                    placeholder="GitHub URL (Optional)"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                  />
                  <p className="error-message">{"\u00A0"}</p>
                </div>
                {/* LinkedIn URL (Optional) */}
                <div className="input-group">
                  <input
                    type="url"
                    placeholder="LinkedIn URL (Optional)"
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                  />
                  <p className="error-message">{"\u00A0"}</p>
                </div>
                {/* Password & Confirm */}
                <div className="input-group">
                  <input
                    type="password"
                    placeholder="Password (min 6 characters)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <p className="error-message">{errors.password || "\u00A0"}</p>
                </div>

                <div className="input-group">
                  <input
                    type="password"
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  <p className="error-message">{errors.confirmPassword || "\u00A0"}</p>
                </div>

                <div className="auth-switch-text">
                  <span>Already registered?</span>
                  <Link to="/" className="Login-link">Login</Link>
                </div>

                <div className="Signup-Separator">
                  <span>OR REGISTER WITH</span>
                </div>

                <div className="Signup-Social-Options">
                  <button className="social-btn google" type="button" onClick={handleGoogleAuth}>
                    <GoogleIcon size={20} />
                    <span>Google</span>
                  </button>
                  <button className="social-btn github" type="button" onClick={handleGithubAuth}>
                    <GithubIcon size={20} />
                    <span>GitHub</span>
                  </button>
                </div>

                <button type="submit" className="auth-submit-btn" disabled={loading}>
                  {loading ? "INITIALIZING COMBAT TAG..." : "REGISTER & GET INSTITUTIONAL CODE"}
                </button>
              </div>
            </form>
          </motion.div>
        ) : (
          <CompleteProfileDialog
            key="complete-profile-dialog-signup"
            user={oauthUser || user}
            authToken={oauthToken}
            initialGithub={githubUrl}
            initialLinkedin={linkedinUrl}
            onComplete={() => navigate("/home")}
            onSkip={() => navigate("/home")}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default Signup;
