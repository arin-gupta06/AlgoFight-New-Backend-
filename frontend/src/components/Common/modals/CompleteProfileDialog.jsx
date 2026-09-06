import React, { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { GithubIcon } from "../icons/Icons";
import { useAuth } from "../../../contexts/AuthContext";
import { useNotification } from "../../../contexts/NotificationContext";
import { toApiUrl } from "../../../services/api";
import "./CompleteProfileDialog.css";

function LinkedInIcon({ size = 18, className = "" }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
            <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
        </svg>
    );
}

export default function CompleteProfileDialog({
    user: propUser,
    authToken,
    onComplete,
    onSkip,
    initialGithub = "",
    initialLinkedin = ""
}) {
    const { user: authUser } = useAuth();
    const currentUser = propUser || authUser;
    const { notify } = useNotification();
    const navigate = useNavigate();

    const [githubUrl, setGithubUrl] = useState(initialGithub);
    const [linkedinUrl, setLinkedinUrl] = useState(initialLinkedin);
    const [loading, setLoading] = useState(false);

    const handleSkip = () => {
        if (onSkip) {
            onSkip();
        } else {
            navigate("/home");
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const token = authToken || (currentUser ? await currentUser.getIdToken() : null);
            if (currentUser) {
                const response = await fetch(toApiUrl("/api/users"), {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        ...(token ? { Authorization: `Bearer ${token}` } : {})
                    },
                    body: JSON.stringify({
                        uid: currentUser.uid,
                        id: currentUser.uid,
                        email: currentUser.email,
                        username: currentUser.displayName || currentUser.email?.split("@")[0] || "Player",
                        displayName: currentUser.displayName || currentUser.email?.split("@")[0] || "Player",
                        photoURL: currentUser.photoURL,
                        githubUrl: githubUrl.trim() || null,
                        linkedinUrl: linkedinUrl.trim() || null
                    })
                });

                if (!response.ok) {
                    throw new Error(`Failed with status ${response.status}`);
                }
            }

            notify({
                type: "success",
                title: "Profile Completed",
                message: "Your profile details have been saved successfully!"
            });

            if (onComplete) {
                onComplete();
            } else {
                navigate("/home");
            }
        } catch (err) {
            console.error("Error updating profile in dialog:", err);
            notify({
                type: "warning",
                title: "Notice",
                message: "Proceeding to Arena. You can update social links in your Profile anytime."
            });
            if (onComplete) {
                onComplete();
            } else {
                navigate("/home");
            }
        } finally {
            setLoading(false);
        }
    };

    const displayName = currentUser?.displayName || currentUser?.email?.split("@")[0] || "New Combatant";
    const email = currentUser?.email || "";
    const photoURL = currentUser?.photoURL;

    return (
        <motion.div
            className="complete-profile-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
        >
            <motion.div
                className="complete-profile-card"
                initial={{ opacity: 0, scale: 0.94, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 30 }}
                transition={{ type: "spring", stiffness: 350, damping: 30 }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="complete-profile-title"
            >
                {/* Header */}
                <div className="complete-profile-header">
                    <span className="complete-profile-badge">⚡ COMBAT IDENTIFIER</span>
                    <h2 id="complete-profile-title">COMPLETE PROFILE</h2>
                    <p className="complete-profile-subtitle">
                        Link your developer handles to display on your battle cards & leaderboards.
                    </p>
                </div>

                {/* User Identity Preview */}
                {currentUser && (
                    <div className="complete-profile-user-preview">
                        {photoURL ? (
                            <img
                                src={photoURL}
                                alt={displayName}
                                className="complete-profile-avatar"
                                referrerPolicy="no-referrer"
                            />
                        ) : (
                            <div className="complete-profile-avatar-fallback">
                                {displayName.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <div className="complete-profile-user-info">
                            <span className="complete-profile-name">{displayName}</span>
                            {email && <span className="complete-profile-email">{email}</span>}
                        </div>
                    </div>
                )}

                {/* Form */}
                <form className="complete-profile-form" onSubmit={handleSubmit}>
                    <div className="complete-profile-field">
                        <label htmlFor="complete-profile-github" className="complete-profile-label">
                            <GithubIcon size={16} />
                            <span>GitHub Profile (Optional)</span>
                        </label>
                        <div className="complete-profile-input-wrapper">
                            <input
                                id="complete-profile-github"
                                type="url"
                                placeholder="https://github.com/username"
                                value={githubUrl}
                                onChange={(e) => setGithubUrl(e.target.value)}
                                autoComplete="url"
                            />
                        </div>
                    </div>

                    <div className="complete-profile-field">
                        <label htmlFor="complete-profile-linkedin" className="complete-profile-label">
                            <LinkedInIcon size={16} />
                            <span>LinkedIn Profile (Optional)</span>
                        </label>
                        <div className="complete-profile-input-wrapper">
                            <input
                                id="complete-profile-linkedin"
                                type="url"
                                placeholder="https://linkedin.com/in/username"
                                value={linkedinUrl}
                                onChange={(e) => setLinkedinUrl(e.target.value)}
                                autoComplete="url"
                            />
                        </div>
                    </div>

                    <div className="complete-profile-actions">
                        <button
                            type="button"
                            className="complete-profile-btn-skip"
                            onClick={handleSkip}
                            disabled={loading}
                        >
                            Skip For Now
                        </button>
                        <button
                            type="submit"
                            className="complete-profile-btn-save"
                            disabled={loading}
                        >
                            {loading ? "INITIALIZING..." : "SAVE & ENTER ARENA ➔"}
                        </button>
                    </div>
                </form>
            </motion.div>
        </motion.div>
    );
}
