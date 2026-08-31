import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faPlus, faUsers, faClock, faFire } from "@fortawesome/free-solid-svg-icons";
import { requestJson } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import { useNotification } from "../../contexts/NotificationContext";
import { useNavigate } from "react-router-dom";

export default function CreateRoomModal({ isOpen, onClose }) {
    const { user } = useAuth();
    const { notify } = useNotification();
    const navigate = useNavigate();

    const [maxPlayers, setMaxPlayers] = useState(2);
    const [timeLimit, setTimeLimit] = useState(15);
    const [difficulty, setDifficulty] = useState("MEDIUM");
    const [questionCount, setQuestionCount] = useState(3);
    const [creating, setCreating] = useState(false);

    if (!isOpen) return null;

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!user) {
            notify({ type: "error", title: "Authentication Required", message: "Please log in to create a custom room." });
            return;
        }

        try {
            setCreating(true);
            const res = await requestJson("/api/battle/rooms", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    hostId: user.uid || user.email,
                    maxPlayers: Number(maxPlayers),
                    timeLimitMinutes: Number(timeLimit),
                    difficulty,
                    questionCount: Number(questionCount),
                }),
                includeAuth: true,
            });

            const roomCode = res.room?.roomCode || res.roomCode;
            notify({ type: "success", title: "Room Created!", message: `Room Code: ${roomCode}` });
            onClose();
            navigate(`/battle/room/${roomCode}`);
        } catch (err) {
            notify({ type: "error", title: "Room Creation Failed", message: err.message || "Could not create room." });
        } finally {
            setCreating(false);
        }
    };

    return (
        <AnimatePresence>
            <div className="modal-overlay" onClick={onClose}>
                <motion.div
                    className="modal-content-hud"
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="modal-header">
                        <div className="modal-title-group">
                            <span className="modal-tag">Lobby Host</span>
                            <h2>Create Custom Battle Room</h2>
                        </div>
                        <button className="modal-close-btn" onClick={onClose}>
                            <FontAwesomeIcon icon={faTimes} />
                        </button>
                    </div>

                    <form onSubmit={handleCreate} className="modal-form">
                        <div className="form-group-hud">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <label><FontAwesomeIcon icon={faUsers} /> Max Participants (Classroom / Arena)</label>
                                <span style={{ fontSize: '0.85rem', color: '#00e5ff', fontWeight: 700, fontFamily: 'Space Grotesk' }}>
                                    {maxPlayers} Students
                                </span>
                            </div>
                            <div className="pill-grid-4">
                                {[2, 4, 8, 16, 25, 50, 75, 100].map((num) => (
                                    <button
                                        key={num}
                                        type="button"
                                        className={`pill-btn ${maxPlayers === num ? "active" : ""}`}
                                        onClick={() => setMaxPlayers(num)}
                                    >
                                        {num} Players
                                    </button>
                                ))}
                            </div>
                            <div className="custom-size-row">
                                <div className="custom-size-left">
                                    <span className="custom-size-label">Custom Class Size:</span>
                                    <div className="custom-size-input-wrapper">
                                        <input
                                            type="number"
                                            min="2"
                                            max="100"
                                            value={maxPlayers}
                                            onChange={(e) => setMaxPlayers(Math.max(2, Math.min(100, Number(e.target.value) || 2)))}
                                            className="custom-size-input"
                                        />
                                        <span className="custom-size-unit">Seats</span>
                                    </div>
                                </div>
                                <span className="custom-size-hint">Direct Entry (2–100)</span>
                            </div>
                        </div>

                        <div className="form-group-hud">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <label><FontAwesomeIcon icon={faClock} /> Time Limit</label>
                                <span style={{ fontSize: '0.85rem', color: '#00e5ff', fontWeight: 700, fontFamily: 'Space Grotesk' }}>
                                    {timeLimit} Mins
                                </span>
                            </div>
                            <div className="pill-grid-3">
                                {[5, 10, 15, 30, 45, 60].map((mins) => (
                                    <button
                                        key={mins}
                                        type="button"
                                        className={`pill-btn ${timeLimit === mins ? "active" : ""}`}
                                        onClick={() => setTimeLimit(mins)}
                                    >
                                        {mins} Mins
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="form-group-hud">
                            <label><FontAwesomeIcon icon={faPlus} /> Number of Questions</label>
                            <div className="pill-grid-3">
                                {[1, 3, 5].map((num) => (
                                    <button
                                        key={num}
                                        type="button"
                                        className={`pill-btn ${questionCount === num ? "active" : ""}`}
                                        onClick={() => setQuestionCount(num)}
                                    >
                                        {num} {num === 1 ? 'Question' : 'Questions'}
                                    </button>
                                ))}
                            </div>
                            <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', marginTop: '6px' }}>The battle ends strictly when the time expires or a participant completes all questions.</p>
                        </div>

                        <div className="form-group-hud">
                            <label><FontAwesomeIcon icon={faFire} /> Problem Difficulty</label>
                            <div className="pill-grid-4">
                                {["EASY", "MEDIUM", "HARD", "MIX"].map((diff) => (
                                    <button
                                        key={diff}
                                        type="button"
                                        className={`pill-btn ${difficulty === diff ? "active" : ""}`}
                                        onClick={() => setDifficulty(diff)}
                                    >
                                        {diff}
                                    </button>
                                ))}
                            </div>
                            <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', marginTop: '6px' }}>MIX will dynamically balance questions: ~30% Hard, 50% Medium, 20% Easy.</p>
                        </div>

                        <div className="modal-actions">
                            <button type="button" className="btn-hud-secondary" onClick={onClose} disabled={creating}>
                                Cancel
                            </button>
                            <button type="submit" className="btn-hud-primary" disabled={creating}>
                                <FontAwesomeIcon icon={faPlus} /> {creating ? "Generating Room..." : "Create Room"}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
