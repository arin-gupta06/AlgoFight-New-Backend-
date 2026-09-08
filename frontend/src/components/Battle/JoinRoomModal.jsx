import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faKey, faArrowRight } from "@fortawesome/free-solid-svg-icons";
import { requestJson } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import { useNotification } from "../../contexts/NotificationContext";
import { useNavigate } from "react-router-dom";

export default function JoinRoomModal({ isOpen, onClose }) {
    const { user } = useAuth();
    const { notify } = useNotification();
    const navigate = useNavigate();

    const [roomCode, setRoomCode] = useState("");
    const [joining, setJoining] = useState(false);

    if (!isOpen) return null;

    const handleJoin = async (e) => {
        e.preventDefault();
        const cleanCode = roomCode.trim();

        if (!cleanCode) {
            notify({ type: "warning", title: "Code Required", message: "Please enter a valid room code (e.g. BTL-1234)." });
            return;
        }
        if (!user) {
            notify({ type: "error", title: "Authentication Required", message: "Please log in to join a room." });
            return;
        }

        try {
            setJoining(true);
            await requestJson(`/api/battle/rooms/${encodeURIComponent(cleanCode)}/join`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: user.uid || user.email,
                }),
                includeAuth: true,
            });

            notify({ type: "success", title: "Joined Room!", message: `Entering lobby ${cleanCode}...` });
            onClose();
            navigate(`/battle/room/${cleanCode}`);
        } catch (err) {
            notify({ type: "error", title: "Unable to Join", message: err.message || "Room code not found or room is full." });
        } finally {
            setJoining(false);
        }
    };

    return (
        <AnimatePresence>
            <div className="modal-overlay" onClick={onClose}>
                <motion.div
                    className="modal-content-hud modal-sm"
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="modal-header">
                        <div className="modal-title-group">
                            <span className="modal-tag">Direct Access</span>
                            <h2>Enter Room Code</h2>
                        </div>
                        <button className="modal-close-btn" onClick={onClose}>
                            <FontAwesomeIcon icon={faTimes} />
                        </button>
                    </div>

                    <form onSubmit={handleJoin} className="modal-form">
                        <div className="form-group-hud">
                            <div className="form-group-header">
                                <label><FontAwesomeIcon icon={faKey} /> Room Passcode</label>
                                <span className="form-group-value-badge">
                                    {roomCode.trim() ? `${roomCode.trim().length} Chars` : 'Required'}
                                </span>
                            </div>
                            <input
                                type="text"
                                className="code-input"
                                placeholder="e.g. BTL-8492"
                                value={roomCode}
                                onChange={(e) => setRoomCode(e.target.value)}
                                autoFocus
                                maxLength={12}
                            />
                            <p className="form-group-hint">Have a room code from a friend or instructor? Enter it here to join their live battle lobby.</p>
                        </div>

                        <div className="modal-actions" style={{ marginTop: '16px' }}>
                            <button type="button" className="btn-hud-secondary" onClick={onClose} disabled={joining}>
                                Cancel
                            </button>
                            <button type="submit" className="btn-hud-primary" disabled={joining || !roomCode.trim()}>
                                {joining ? "Connecting..." : "Join Battle"} <FontAwesomeIcon icon={faArrowRight} />
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
