import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faUsers,
    faBolt,
    faTrophy,
    faMagnifyingGlass,
    faShieldHalved,
    faCircle,
    faCopy,
    faCrosshairs,
    faArrowRotateRight,
    faBuildingColumns,
    faCheck,
    faTimes,
    faFire,
    faHourglassHalf,
    faGamepad,
} from "@fortawesome/free-solid-svg-icons";
import { fetchAvailablePlayers } from "../../services/api";
import { connectSocket, getSocket } from "../../services/socket";
import { useAuth } from "../../contexts/AuthContext";
import { useNotification } from "../../contexts/NotificationContext";
import RankEmblem, { getRankTier } from "../Common/gamification/RankEmblem";
import "./AvailablePlayers.css";

export default function AvailablePlayers({ onPlayerCountChange }) {
    const { user } = useAuth();
    const { notify } = useNotification();
    const navigate = useNavigate();

    const [dbPlayers, setDbPlayers] = useState([]);
    const [onlinePresences, setOnlinePresences] = useState(new Map());
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL"); // ALL | ONLINE | AVAILABLE | IN_BATTLE
    const [sortBy, setSortBy] = useState("rating"); // rating | wins | winRate | name

    // Direct Challenge States
    const [outgoingChallenge, setOutgoingChallenge] = useState(null); // { challengeId, targetUsername, expiresAt }
    const [incomingChallenge, setIncomingChallenge] = useState(null); // { challengeId, fromUsername, fromRating, expiresAt }
    const [challengeTimeRemaining, setChallengeTimeRemaining] = useState(30);

    const currentUserId = user?.uid || user?.email || "Guest";
    const currentUsername = user?.displayName || user?.email?.split("@")[0] || "Player";

    // 1. Fetch Registered Players from REST API
    const loadPlayersFromDb = async () => {
        try {
            setLoading(true);
            const data = await fetchAvailablePlayers({ limit: 100 });
            if (Array.isArray(data)) {
                setDbPlayers(data);
            }
        } catch (err) {
            console.error("Failed to load players directory:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPlayersFromDb();
    }, []);

    // 2. Setup WebSocket Presence & Challenge listeners
    useEffect(() => {
        let active = true;
        let token = null;

        const initSocket = async () => {
            if (user) {
                token = await user.getIdToken().catch(() => null);
            }
            if (!active) return;

            const socket = connectSocket(token, currentUserId, currentUsername);

            // Ask for current online snapshot
            socket.emit("get_available_players");

            const handlePresenceSync = (data) => {
                const list = data?.onlinePlayers || data?.payload?.onlinePlayers || [];
                const nextMap = new Map();
                for (const p of list) {
                    if (p.userId) nextMap.set(p.userId, p);
                }
                setOnlinePresences(nextMap);
            };

            const handlePresenceUpdate = (presence) => {
                if (!presence?.userId) return;
                setOnlinePresences((prev) => {
                    const next = new Map(prev);
                    next.set(presence.userId, presence);
                    return next;
                });
            };

            const handlePlayerOffline = (data) => {
                const uid = data?.userId || data?.payload?.userId;
                if (!uid) return;
                setOnlinePresences((prev) => {
                    const next = new Map(prev);
                    next.delete(uid);
                    return next;
                });
            };

            const handleChallengeReceived = (challenge) => {
                setIncomingChallenge(challenge);
                setChallengeTimeRemaining(30);
                notify({
                    type: "info",
                    title: "⚔️ Duel Challenge!",
                    message: `${challenge.fromUsername} challenged you to a 1v1 battle!`,
                    duration: 5000,
                });
            };

            const handleChallengeSent = (challenge) => {
                setOutgoingChallenge(challenge);
                setChallengeTimeRemaining(30);
                notify({
                    type: "success",
                    title: "Challenge Dispatched",
                    message: `Waiting for ${challenge.targetUsername} to accept...`,
                    duration: 4000,
                });
            };

            const handleChallengeDeclined = (data) => {
                setOutgoingChallenge(null);
                notify({
                    type: "warning",
                    title: "Duel Declined",
                    message: `${data.targetUsername || "Player"} declined the battle challenge.`,
                    duration: 4000,
                });
            };

            const handleChallengeCancelled = () => {
                setIncomingChallenge(null);
                setOutgoingChallenge(null);
                notify({
                    type: "info",
                    title: "Challenge Cancelled",
                    message: "The challenge was cancelled.",
                    duration: 3000,
                });
            };

            const handleChallengeExpired = () => {
                setIncomingChallenge(null);
                setOutgoingChallenge(null);
            };

            const handleMatchFound = (matchPayload) => {
                setIncomingChallenge(null);
                setOutgoingChallenge(null);
                notify({
                    type: "success",
                    title: "Combat Engaged!",
                    message: "Entering live battle arena...",
                    duration: 2500,
                });
                navigate("/battle/live", { state: { matchData: matchPayload } });
            };

            socket.on("presence_sync", handlePresenceSync);
            socket.on("player_presence_update", handlePresenceUpdate);
            socket.on("player_offline", handlePlayerOffline);
            socket.on("challenge_received", handleChallengeReceived);
            socket.on("challenge_sent", handleChallengeSent);
            socket.on("challenge_declined", handleChallengeDeclined);
            socket.on("challenge_cancelled", handleChallengeCancelled);
            socket.on("challenge_expired", handleChallengeExpired);
            socket.on("match_found", handleMatchFound);

            return () => {
                socket.off("presence_sync", handlePresenceSync);
                socket.off("player_presence_update", handlePresenceUpdate);
                socket.off("player_offline", handlePlayerOffline);
                socket.off("challenge_received", handleChallengeReceived);
                socket.off("challenge_sent", handleChallengeSent);
                socket.off("challenge_declined", handleChallengeDeclined);
                socket.off("challenge_cancelled", handleChallengeCancelled);
                socket.off("challenge_expired", handleChallengeExpired);
                socket.off("match_found", handleMatchFound);
            };
        };

        const cleanupPromise = initSocket();

        return () => {
            active = false;
            cleanupPromise.then((cleanup) => {
                if (typeof cleanup === "function") cleanup();
            });
        };
    }, [currentUserId, currentUsername, navigate, notify, user]);

    // 3. Countdown timer for active challenges
    useEffect(() => {
        if (!outgoingChallenge && !incomingChallenge) return;

        const timer = setInterval(() => {
            setChallengeTimeRemaining((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    setOutgoingChallenge(null);
                    setIncomingChallenge(null);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [outgoingChallenge, incomingChallenge]);

    // 4. Merge DB players with live WebSocket presences
    const mergedPlayers = useMemo(() => {
        const map = new Map();

        // Populate from DB baseline
        for (const p of dbPlayers) {
            const isMe = p.id === currentUserId || p.email === user?.email;
            map.set(p.id, {
                id: p.id,
                username: p.username || "Player",
                platformCode: p.platformCode || "",
                institutionName: p.institutionName || "",
                userType: p.userType || "INDIVIDUAL",
                rating: p.rating ?? 0,
                matchesWon: p.matchesWon ?? p.wins ?? 0,
                matchesPlayed: p.matchesPlayed ?? ((p.wins || 0) + (p.losses || 0)),
                winRate: p.winRate ?? (p.wins && (p.wins + p.losses) > 0 ? Math.round((p.wins / (p.wins + p.losses)) * 100) : 0),
                status: "OFFLINE",
                isMe,
            });
        }

        // Overlay with live presence entries
        for (const [userId, pres] of onlinePresences.entries()) {
            const existing = map.get(userId);
            const isMe = userId === currentUserId || pres.username === currentUsername;
            if (existing) {
                map.set(userId, {
                    ...existing,
                    username: pres.username || existing.username,
                    platformCode: pres.platformCode || existing.platformCode,
                    rating: pres.rating ?? existing.rating ?? 0,
                    status: pres.status || "AVAILABLE",
                    isMe,
                });
            } else {
                map.set(userId, {
                    id: userId,
                    username: pres.username || "Player",
                    platformCode: pres.platformCode || "",
                    institutionName: pres.institutionName || "",
                    userType: pres.userType || "INDIVIDUAL",
                    rating: pres.rating ?? 0,
                    matchesWon: 0,
                    matchesPlayed: 0,
                    winRate: 0,
                    status: pres.status || "AVAILABLE",
                    isMe,
                });
            }
        }

        return Array.from(map.values());
    }, [dbPlayers, onlinePresences, currentUserId, currentUsername, user?.email]);

    // Live counts
    const onlineCount = useMemo(() => {
        return mergedPlayers.filter((p) => p.status !== "OFFLINE").length;
    }, [mergedPlayers]);

    const availableCount = useMemo(() => {
        return mergedPlayers.filter((p) => p.status === "AVAILABLE" && !p.isMe).length;
    }, [mergedPlayers]);

    const battlingCount = useMemo(() => {
        return mergedPlayers.filter((p) => p.status === "IN_BATTLE").length;
    }, [mergedPlayers]);

    // Update parent tab badge if callback provided
    useEffect(() => {
        if (typeof onPlayerCountChange === "function") {
            onPlayerCountChange(onlineCount);
        }
    }, [onlineCount, onPlayerCountChange]);

    // 5. Filter and Sort
    const filteredPlayers = useMemo(() => {
        return mergedPlayers
            .filter((p) => {
                // Search query match
                if (searchQuery.trim()) {
                    const q = searchQuery.toLowerCase().trim();
                    const matchName = p.username.toLowerCase().includes(q);
                    const matchCode = p.platformCode.toLowerCase().includes(q);
                    const matchInst = p.institutionName.toLowerCase().includes(q);
                    if (!matchName && !matchCode && !matchInst) return false;
                }

                // Status filter
                if (statusFilter === "ONLINE") {
                    return p.status !== "OFFLINE";
                }
                if (statusFilter === "AVAILABLE") {
                    return p.status === "AVAILABLE";
                }
                if (statusFilter === "IN_BATTLE") {
                    return p.status === "IN_BATTLE";
                }

                return true;
            })
            .sort((a, b) => {
                // Pin self or online players near top if not sorting by specific field
                if (sortBy === "rating") {
                    return (b.rating || 0) - (a.rating || 0);
                }
                if (sortBy === "wins") {
                    return (b.matchesWon || 0) - (a.matchesWon || 0);
                }
                if (sortBy === "winRate") {
                    return (b.winRate || 0) - (a.winRate || 0);
                }
                if (sortBy === "name") {
                    return a.username.localeCompare(b.username);
                }
                return 0;
            });
    }, [mergedPlayers, searchQuery, statusFilter, sortBy]);

    // 6. Action Handlers
    const handleSendChallenge = (targetPlayer) => {
        const socket = getSocket();
        if (!socket || !socket.connected) {
            notify({ type: "error", title: "Connection Error", message: "Connecting to server, please try again." });
            return;
        }

        socket.emit("send_challenge", {
            targetUserId: targetPlayer.id,
            targetUsername: targetPlayer.username,
            fromUsername: currentUsername,
        });
    };

    const handleAcceptChallenge = () => {
        if (!incomingChallenge) return;
        const socket = getSocket();
        socket.emit("accept_challenge", {
            challengeId: incomingChallenge.challengeId,
        });
    };

    const handleDeclineChallenge = () => {
        if (!incomingChallenge) return;
        const socket = getSocket();
        socket.emit("decline_challenge", {
            challengeId: incomingChallenge.challengeId,
        });
        setIncomingChallenge(null);
    };

    const handleCancelChallenge = () => {
        if (!outgoingChallenge) return;
        const socket = getSocket();
        socket.emit("cancel_challenge", {
            challengeId: outgoingChallenge.challengeId,
        });
        setOutgoingChallenge(null);
    };

    const copyCode = (code) => {
        if (!code) return;
        navigator.clipboard.writeText(code);
        notify({ type: "success", title: "Copied!", message: `Player code ${code} copied to clipboard.` });
    };

    return (
        <div className="ap-container">
            {/* Top Real-Time Stats Row */}
            <div className="ap-stats-row">
                <div className="ap-stat-card tone-gold">
                    <div className="ap-stat-icon-wrap">
                        <FontAwesomeIcon icon={faUsers} />
                    </div>
                    <div className="ap-stat-info">
                        <div className="ap-stat-number">{mergedPlayers.length}</div>
                        <div className="ap-stat-label">Total Registered Coders</div>
                    </div>
                </div>

                <div className="ap-stat-card tone-cyan">
                    <div className="ap-stat-icon-wrap">
                        <FontAwesomeIcon icon={faBolt} />
                    </div>
                    <div className="ap-stat-info">
                        <div className="ap-stat-number">{onlineCount}</div>
                        <div className="ap-stat-label">Online Right Now</div>
                    </div>
                </div>

                <div className="ap-stat-card tone-pink">
                    <div className="ap-stat-icon-wrap">
                        <FontAwesomeIcon icon={faFire} />
                    </div>
                    <div className="ap-stat-info">
                        <div className="ap-stat-number">{battlingCount}</div>
                        <div className="ap-stat-label">In Live Duels</div>
                    </div>
                </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="ap-toolbar">
                {/* Search Input */}
                <div className="ap-search-box">
                    <FontAwesomeIcon icon={faMagnifyingGlass} className="ap-search-icon" />
                    <input
                        type="text"
                        className="ap-search-input"
                        placeholder="Search by username, code (AF-...), university..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                {/* Status Filter Tabs */}
                <div className="ap-filters-group">
                    <button
                        className={`ap-tab-btn ${statusFilter === "ALL" ? "active" : ""}`}
                        onClick={() => setStatusFilter("ALL")}
                    >
                        All <span className="ap-count-pill">{mergedPlayers.length}</span>
                    </button>

                    <button
                        className={`ap-tab-btn ${statusFilter === "ONLINE" ? "active" : ""}`}
                        onClick={() => setStatusFilter("ONLINE")}
                    >
                        🟢 Online <span className="ap-count-pill">{onlineCount}</span>
                    </button>

                    <button
                        className={`ap-tab-btn ${statusFilter === "AVAILABLE" ? "active" : ""}`}
                        onClick={() => setStatusFilter("AVAILABLE")}
                    >
                        ⚡ Available <span className="ap-count-pill">{availableCount}</span>
                    </button>

                    <button
                        className={`ap-tab-btn ${statusFilter === "IN_BATTLE" ? "active" : ""}`}
                        onClick={() => setStatusFilter("IN_BATTLE")}
                    >
                        ⚔️ In Battle <span className="ap-count-pill">{battlingCount}</span>
                    </button>

                    {/* Sorting dropdown */}
                    <select
                        className="ap-sort-select"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                    >
                        <option value="rating">Highest Rating</option>
                        <option value="wins">Most Wins</option>
                        <option value="winRate">Best Win Rate</option>
                        <option value="name">Name (A-Z)</option>
                    </select>

                    {/* Refresh Button */}
                    <button className="ap-refresh-btn" onClick={loadPlayersFromDb} title="Refresh Directory">
                        <FontAwesomeIcon icon={faArrowRotateRight} spin={loading} />
                    </button>
                </div>
            </div>

            {/* Players Grid */}
            <div className="ap-grid">
                {filteredPlayers.map((player) => {
                    const tier = getRankTier(player.rating);
                    const isOnline = player.status !== "OFFLINE";
                    const isAvailable = player.status === "AVAILABLE" && !player.isMe;
                    const isInBattle = player.status === "IN_BATTLE";

                    return (
                        <motion.div
                            key={player.id}
                            className={`ap-card ${player.isMe ? "is-self" : ""} ${isInBattle ? "is-in-battle" : ""}`}
                            onClick={() => navigate(player.isMe ? "/profile" : `/profile/${encodeURIComponent(player.id)}`)}
                            title={`Click to view ${player.username}'s full profile`}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            {/* Card Header */}
                            <div className="ap-card-header">
                                <div className="ap-avatar-wrap">
                                    <div className="ap-avatar">
                                        {(player.username || "P")[0].toUpperCase()}
                                    </div>
                                    <span className={`ap-status-indicator ${player.status.toLowerCase()}`} />
                                </div>

                                <div className="ap-player-meta">
                                    <div className="ap-player-name-row">
                                        <span className="ap-player-name">{player.username}</span>
                                        {player.isMe && <span className="ap-self-pill">YOU</span>}
                                    </div>

                                    <span
                                        className="ap-code-badge"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const codeToCopy = player.platformCode || `AF-USR-${player.id ? player.id.slice(0, 6).toUpperCase() : "PLAYER"}`;
                                            copyCode(codeToCopy);
                                        }}
                                        title="Click to copy Platform Code"
                                    >
                                        {player.platformCode || `AF-USR-${player.id ? player.id.slice(0, 6).toUpperCase() : "PLAYER"}`} <FontAwesomeIcon icon={faCopy} />
                                    </span>

                                    {player.institutionName && (
                                        <div className="ap-inst-text" title={player.institutionName}>
                                            <FontAwesomeIcon icon={faBuildingColumns} /> {player.institutionName}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Card Body Stats */}
                            <div className="ap-card-body">
                                <div className="ap-rating-tier-row">
                                    <div className="ap-rating-box">
                                        <span className="ap-rating-value">{player.rating ?? 0}</span>
                                        <span className="ap-rating-label">Rating</span>
                                    </div>

                                    <RankEmblem rating={player.rating ?? 0} size={26} showBadge={true} glow={false} />
                                </div>

                                <div className="ap-winrate-bar-wrap">
                                    <div className="ap-winrate-labels">
                                        <span>Win Rate: <b>{player.winRate || 0}%</b></span>
                                        <span>Won: <b>{player.matchesWon || 0}</b></span>
                                    </div>
                                    <div className="ap-winrate-track">
                                        <div
                                            className="ap-winrate-fill"
                                            style={{ width: `${Math.min(100, Math.max(5, player.winRate || 0))}%` }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Card Footer Actions */}
                            <div className="ap-card-footer">
                                {player.isMe ? (
                                    <div className="ap-btn-disabled">
                                        <FontAwesomeIcon icon={faShieldHalved} /> Your Profile
                                    </div>
                                ) : isAvailable ? (
                                    <button
                                        className="ap-btn-challenge"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleSendChallenge(player);
                                        }}
                                        title={`Send direct 1v1 duel challenge to ${player.username}`}
                                    >
                                        <FontAwesomeIcon icon={faBolt} /> Challenge 1v1
                                    </button>
                                ) : isInBattle ? (
                                    <div className="ap-btn-disabled in_battle">
                                        <FontAwesomeIcon icon={faFire} /> In Active Duel
                                    </div>
                                ) : isOnline ? (
                                    <div className="ap-btn-disabled">
                                        <FontAwesomeIcon icon={faHourglassHalf} /> In Lobby
                                    </div>
                                ) : (
                                    <div className="ap-btn-disabled">
                                        <FontAwesomeIcon icon={faCircle} /> Offline
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    );
                })}

                {/* Empty State */}
                {filteredPlayers.length === 0 && !loading && (
                    <div className="ap-empty-box">
                        <FontAwesomeIcon icon={faUsers} className="ap-empty-icon" />
                        <h3>No Players Found</h3>
                        <p>No players matched your active search or status filters.</p>
                        <button
                            className="ap-empty-reset-btn"
                            onClick={() => {
                                setSearchQuery("");
                                setStatusFilter("ALL");
                            }}
                        >
                            Reset Filters
                        </button>
                    </div>
                )}
            </div>

            {/* Outgoing Challenge Dialog */}
            <AnimatePresence>
                {outgoingChallenge && (
                    <motion.div
                        className="ap-modal-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            className="ap-challenge-modal"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                        >
                            <div className="ap-modal-icon-halo">
                                <FontAwesomeIcon icon={faCrosshairs} />
                            </div>
                            <h3 className="ap-modal-title">Duel Challenge Sent!</h3>
                            <p className="ap-modal-desc">
                                Waiting for <span className="ap-modal-target-name">{outgoingChallenge.targetUsername}</span> to accept your 1v1 challenge...
                            </p>

                            <div className="ap-modal-timer-bar">
                                <div
                                    className="ap-modal-timer-progress"
                                    style={{ width: `${(challengeTimeRemaining / 30) * 100}%` }}
                                />
                            </div>

                            <button className="ap-modal-btn-cancel" onClick={handleCancelChallenge}>
                                Cancel Challenge ({challengeTimeRemaining}s)
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Incoming Challenge Modal */}
            <AnimatePresence>
                {incomingChallenge && (
                    <motion.div
                        className="ap-modal-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            className="ap-challenge-modal ap-incoming-card"
                            initial={{ scale: 0.85, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.85, opacity: 0 }}
                        >
                            <div className="ap-modal-icon-halo ap-incoming-icon-halo">
                                <FontAwesomeIcon icon={faFire} />
                            </div>
                            <h3 className="ap-modal-title">Incoming 1v1 Challenge!</h3>
                            <p className="ap-modal-desc">
                                <span className="ap-modal-target-name">{incomingChallenge.fromUsername}</span> (Rating: {incomingChallenge.fromRating ?? 0}) has challenged you to an instant battle duel!
                            </p>

                            <div className="ap-modal-timer-bar">
                                <div
                                    className="ap-modal-timer-progress"
                                    style={{ width: `${(challengeTimeRemaining / 30) * 100}%` }}
                                />
                            </div>

                            <div className="ap-incoming-actions">
                                <button className="ap-btn-accept" onClick={handleAcceptChallenge}>
                                    <FontAwesomeIcon icon={faCheck} /> Accept Duel ({challengeTimeRemaining}s)
                                </button>
                                <button className="ap-btn-decline" onClick={handleDeclineChallenge}>
                                    <FontAwesomeIcon icon={faTimes} /> Decline
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
