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
    const [isFriendly, setIsFriendly] = useState(false);
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
                    isFriendly,
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

                    <form onSubmit={handleCreate} className="modal-form-compact">
                        <div className="modal-form-grid">
                            {/* Left Column: Participants & Time Limit Dropdowns */}
                            <div className="modal-form-col">
                                {/* Max Participants Dropdown */}
                                <div className="form-group-hud">
                                    <div className="form-group-header">
                                        <label><FontAwesomeIcon icon={faUsers} /> Max Participants</label>
                                        <span className="form-group-value-badge">{maxPlayers} Seats</span>
                                    </div>
                                    <select
                                        className="hud-select"
                                        value={maxPlayers}
                                        onChange={(e) => setMaxPlayers(Number(e.target.value))}
                                    >
                                        <option value={2}>2 Participants (1v1 Duel)</option>
                                        <option value={4}>4 Participants (Small Team)</option>
                                        <option value={8}>8 Participants (Group Tournament)</option>
                                        <option value={16}>16 Participants (Classroom Round)</option>
                                        <option value={25}>25 Participants (Medium Arena)</option>
                                        <option value={50}>50 Participants (Large Arena)</option>
                                        <option value={75}>75 Participants (Mega Tournament)</option>
                                        <option value={100}>100 Participants (Full Hall)</option>
                                    </select>
                                </div>

                                {/* Time Limit Dropdown */}
                                <div className="form-group-hud">
                                    <div className="form-group-header">
                                        <label><FontAwesomeIcon icon={faClock} /> Time Limit</label>
                                        <span className="form-group-value-badge">{timeLimit} Mins</span>
                                    </div>
                                    <select
                                        className="hud-select"
                                        value={timeLimit}
                                        onChange={(e) => setTimeLimit(Number(e.target.value))}
                                    >
                                        <option value={5}>5 Minutes (Blitz Duel)</option>
                                        <option value={10}>10 Minutes (Rapid Round)</option>
                                        <option value={15}>15 Minutes (Standard Match)</option>
                                        <option value={20}>20 Minutes (Extended Round)</option>
                                        <option value={30}>30 Minutes (Deep Challenge)</option>
                                        <option value={45}>45 Minutes (Classroom Session)</option>
                                        <option value={60}>60 Minutes (1 Hour Match)</option>
                                        <option value={90}>90 Minutes (1.5 Hour Marathon)</option>
                                        <option value={120}>120 Minutes (2 Hour Grand Finals)</option>
                                    </select>
                                </div>
                            </div>

                            {/* Right Column: Questions & Difficulty */}
                            <div className="modal-form-col">
                                {/* Question Count */}
                                <div className="form-group-hud">
                                    <div className="form-group-header">
                                        <label><FontAwesomeIcon icon={faPlus} /> Questions</label>
                                        <span className="form-group-value-badge">{questionCount} Qs</span>
                                    </div>
                                    <div className="pill-grid-3">
                                        {[1, 3, 5].map((num) => (
                                            <button
                                                key={num}
                                                type="button"
                                                className={`pill-btn ${questionCount === num ? "active" : ""}`}
                                                onClick={() => setQuestionCount(num)}
                                            >
                                                {num} Qs
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Problem Difficulty */}
                                <div className="form-group-hud">
                                    <div className="form-group-header">
                                        <label><FontAwesomeIcon icon={faFire} /> Difficulty</label>
                                        <span className="form-group-value-badge">{difficulty}</span>
                                    </div>
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
                                </div>
                            </div>
                        </div>

                        <div className="modal-actions" style={{ marginTop: '20px' }}>
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
