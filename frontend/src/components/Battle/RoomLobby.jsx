import React, { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faCrown,
    faCheckCircle,
    faHourglassHalf,
    faCopy,
    faPlay,
    faArrowLeft,
    faUsers,
    faShieldHalved,
    faBolt,
    faUserSlash,
    faUserCheck,
    faTimes,
    faCheck,
    faBell,
    faSearch,
    faFilter,
    faCheckDouble,
    faUserGraduate,
    faGraduationCap,
    faClock,
    faEye,
    faUserShield,
} from "@fortawesome/free-solid-svg-icons";
import { requestJson } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import { useNotification } from "../../contexts/NotificationContext";
import { useActiveEvent } from "../../contexts/ActiveEventContext";
import { getWsUrl } from "../../services/socket";
import { getSessionToken } from "../../services/authStorage";
import RankEmblem from "../Common/gamification/RankEmblem";
import "./RoomLobby.css";

export default function RoomLobby() {
    const { roomCode } = useParams();
    const { user } = useAuth();
    const { notify } = useNotification();
    const { setActiveEvent, clearActiveEvent } = useActiveEvent();
    const navigate = useNavigate();

    const [room, setRoom] = useState(null);
    const [participants, setParticipants] = useState([]);
    const [isReady, setIsReady] = useState(false);
    const [loading, setLoading] = useState(true);
    const [starting, setStarting] = useState(false);
    const [countdown, setCountdown] = useState(null);
    const [joinRequests, setJoinRequests] = useState([]);
    const [pardonRequests, setPardonRequests] = useState([]);
    const [removedParticipants, setRemovedParticipants] = useState([]);
    const [waitingForAdmission, setWaitingForAdmission] = useState(false);
    const waitingForAdmissionRef = useRef(false);
    const [kickingUserId, setKickingUserId] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterTab, setFilterTab] = useState("ALL"); // "ALL" | "READY" | "WAITING"

    const socketRef = useRef(null);
    const hasAttemptedAutoJoin = useRef(false);
    const hasHandledExitRef = useRef(false);

    const currentUserId = user?.uid || user?.email || "Guest";
    const currentUsername = user?.displayName || user?.email?.split("@")[0] || "Player";
    const isHost = room?.hostId === currentUserId || room?.host?.id === currentUserId;
    const isHostRef = useRef(isHost);

    const isHostViewer = Boolean(
        isHost && (
            room?.hostRole === "VIEWER" ||
            (!participants.some((p) => p.userId === currentUserId) && (room?.status === "WAITING" || room?.status === "READY"))
        )
    );

    useEffect(() => {
        isHostRef.current = isHost;
    }, [isHost]);

    useEffect(() => {
        waitingForAdmissionRef.current = waitingForAdmission;
    }, [waitingForAdmission]);

    const loadRoom = async (isBackgroundSync = false) => {
        try {
            if (!isBackgroundSync) setLoading(true);
            const data = await requestJson(`/api/battle/rooms/${encodeURIComponent(roomCode)}`);
            const roomData = data.room || data;

            if (roomData?.status === "CANCELLED") {
                if (!hasHandledExitRef.current) {
                    hasHandledExitRef.current = true;
                    clearActiveEvent();
                    notify({ type: "info", title: "Lobby Closed", message: "All participants left or the lobby was closed." });
                    navigate("/battle");
                }
                return;
            }

            const currentParticipants = data.participants || roomData?.participants || [];
            
            // Check if current user is still in the room
            const me = currentParticipants.find((p) => p.userId === currentUserId);
            const amIHost = roomData?.hostId === currentUserId || roomData?.host?.id === currentUserId;
            
            // If the user is not in the participants list and not the host, attempt auto-join or enter waiting-for-admission state
            if (!me && !amIHost && roomData) {
                if (!hasAttemptedAutoJoin.current && (roomData.status === "WAITING" || roomData.status === "READY")) {
                    hasAttemptedAutoJoin.current = true;
                    try {
                        await requestJson(`/api/battle/rooms/${encodeURIComponent(roomCode)}/join`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ userId: currentUserId }),
                            includeAuth: true,
                        });
                        return loadRoom(isBackgroundSync);
                    } catch (joinErr) {
                        console.warn("Auto-join lobby failed, requesting admission from host:", joinErr?.message);
                        if (socketRef.current?.readyState === WebSocket.OPEN) {
                            socketRef.current.send(JSON.stringify({
                                action: "request_join_room",
                                payload: {
                                    roomCode,
                                    userId: currentUserId,
                                    username: currentUsername,
                                    rating: user?.rating ?? 0,
                                },
                            }));
                        }
                        setWaitingForAdmission(true);
                    }
                } else if (!waitingForAdmission) {
                    setWaitingForAdmission(true);
                }
                setRoom(roomData);
                setParticipants(currentParticipants);
                return;
            }

            if (me || (amIHost && roomData.status === "RUNNING")) {
                setWaitingForAdmission(false);
                if (me) setIsReady(me.isReady);
                if (roomData.status === "RUNNING") {
                    const persisted = roomData.persistedTimeRemaining;
                    if (persisted !== undefined && currentUserId) {
                        try {
                            localStorage.setItem(`af_persisted_time_${roomData.id || roomCode}_${currentUserId}`, String(persisted));
                        } catch (_) {}
                    }
                    const hostIsViewer = !me && amIHost;
                    navigate("/battle/live", {
                        state: {
                            matchData: {
                                roomId: roomData.id,
                                roomCode: roomData.roomCode || roomCode,
                                persistedTimeRemaining: persisted,
                                timeLimitSeconds: persisted || (roomData.timeLimitMinutes ? roomData.timeLimitMinutes * 60 : undefined),
                                hostRole: roomData.hostRole,
                                hostId: roomData.hostId,
                                isViewer: hostIsViewer,
                            },
                            roomCode: roomData.roomCode || roomCode,
                            isViewer: hostIsViewer,
                        }
                    });
                    return;
                }
            }

            setRoom(roomData);
            setParticipants(currentParticipants);

            if (me || amIHost) {
                setActiveEvent({
                    type: "LOBBY",
                    roomCode: roomData.roomCode || roomCode,
                    roomId: roomData.id,
                    roomName: roomData.name || `Room ${roomCode}`,
                    status: roomData.status || "WAITING",
                    isHost: amIHost,
                    participantCount: currentParticipants.length,
                    maxParticipants: roomData.maxParticipants || 8,
                    problemId: roomData.problemId,
                    mode: roomData.mode,
                    timeLimitMinutes: roomData.timeLimitMinutes,
                });
            }
        } catch (err) {
            if (!isBackgroundSync) {
                notify({ type: "error", title: "Lobby Error", message: err.message || "Failed to load lobby." });
                navigate("/battle");
            }
        } finally {
            if (!isBackgroundSync) setLoading(false);
        }
    };

    // Initial load + automatic 2.5s background sync fallback
    useEffect(() => {
        loadRoom();
        const interval = setInterval(() => {
            loadRoom(true);
        }, 2500);
        return () => clearInterval(interval);
    }, [roomCode, currentUserId]);

    // 2. Connect to WebSocket for Instant Real-Time Lobby Sync
    useEffect(() => {
        let ws;
        try {
            const resolvedWsUrl = getWsUrl();
            ws = new WebSocket(resolvedWsUrl);
            socketRef.current = ws;

            ws.onopen = () => {
                const token = getSessionToken();
                // Authenticate socket with session token & join room channel
                ws.send(JSON.stringify({
                    action: "identify",
                    payload: { userId: currentUserId, username: currentUsername, token },
                }));

                ws.send(JSON.stringify({
                    action: "join_room_channel",
                    payload: { roomCode, userId: currentUserId, username: currentUsername },
                }));

                if (waitingForAdmissionRef.current) {
                    ws.send(JSON.stringify({
                        action: "request_join_room",
                        payload: {
                            roomCode,
                            userId: currentUserId,
                            username: currentUsername,
                            rating: user?.rating ?? 0,
                        },
                    }));
                }
            };

            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    const { event: evt, payload } = message;

                    if (evt === "join_request_received") {
                        if (isHostRef.current && payload) {
                            setJoinRequests((prev) => [
                                ...prev.filter((r) => r.userId !== payload.userId),
                                payload,
                            ]);
                            notify({
                                type: "info",
                                title: "Join Request",
                                message: `${payload.username || "A player"} wants to enter your lobby.`
                            });
                        }
                    }

                    if (evt === "join_request_approved") {
                        setWaitingForAdmission(false);
                        notify({
                            type: "success",
                            title: "Access Granted!",
                            message: "The host admitted you into the room."
                        });
                        const persisted = payload?.persistedTimeRemaining;
                        if (persisted !== undefined && currentUserId) {
                            try {
                                localStorage.setItem(`af_persisted_time_${room?.id || roomCode}_${currentUserId}`, String(persisted));
                            } catch (_) {}
                        }
                        if (payload?.battleRunning || room?.status === "RUNNING") {
                            navigate("/battle/live", {
                                state: {
                                    matchData: {
                                        roomId: payload?.roomId || room?.id,
                                        roomCode: payload?.roomCode || roomCode,
                                        persistedTimeRemaining: persisted,
                                        timeLimitSeconds: persisted || (room?.timeLimitMinutes ? room.timeLimitMinutes * 60 : undefined),
                                    },
                                    roomCode: payload?.roomCode || roomCode
                                }
                            });
                        } else {
                            loadRoom(true);
                        }
                    }

                    if (evt === "readmitted_to_battle") {
                        setWaitingForAdmission(false);
                        notify({
                            type: "success",
                            title: "Re-admitted to Battle!",
                            message: payload?.message || "The host has re-admitted you to the battle."
                        });
                        const persisted = payload?.persistedTimeRemaining;
                        if (persisted !== undefined && currentUserId) {
                            try {
                                localStorage.setItem(`af_persisted_time_${room?.id || roomCode}_${currentUserId}`, String(persisted));
                            } catch (_) {}
                        }
                        navigate("/battle/live", {
                            state: {
                                matchData: {
                                    roomId: payload?.roomId || room?.id,
                                    roomCode: payload?.roomCode || roomCode,
                                    persistedTimeRemaining: persisted,
                                    timeLimitSeconds: persisted || (room?.timeLimitMinutes ? room.timeLimitMinutes * 60 : undefined),
                                },
                                roomCode: payload?.roomCode || roomCode
                            }
                        });
                    }

                    if (evt === "anticheat_pardon_requested") {
                        if (isHostRef.current && payload) {
                            setPardonRequests((prev) => [
                                ...prev.filter((r) => r.userId !== payload.userId),
                                payload,
                            ]);
                            notify({
                                type: "warning",
                                title: "Pardon Request",
                                message: `${payload.username || "A player"} requested re-entry after anti-cheat disqualification (${payload.tabSwitches || 3} tab switches).`,
                                duration: 8000,
                            });
                        }
                    }

                    if (evt === "anticheat_reentry_approved") {
                        if (payload?.targetUserId === currentUserId) {
                            notify({
                                type: "success",
                                title: "Re-Entry Approved!",
                                message: "The host approved your re-entry into the room.",
                                duration: 5000,
                            });
                            loadRoom(true);
                        }
                    }

                    if (evt === "anticheat_reentry_rejected") {
                        if (payload?.targetUserId === currentUserId) {
                            notify({
                                type: "error",
                                title: "Request Declined",
                                message: payload?.reason || "The host declined your re-entry request.",
                                duration: 5000,
                            });
                        }
                    }

                    if (evt === "join_request_rejected") {
                        clearActiveEvent();
                        notify({
                            type: "error",
                            title: "Access Declined",
                            message: payload?.message || "The host declined your join request."
                        });
                        navigate("/battle");
                    }

                    if (evt === "kicked_from_room") {
                        clearActiveEvent();
                        notify({
                            type: "error",
                            title: "Removed from Lobby",
                            message: payload?.message || "You were removed from the lobby by the host."
                        });
                        navigate("/battle");
                    }

                    if (evt === "player_kicked") {
                        if (payload?.targetUserId !== currentUserId) {
                            notify({
                                type: "warning",
                                title: "Combatant Evicted",
                                message: `${payload?.targetUsername || "A player"} was removed by the host.`
                            });
                            // Store in removedParticipants so host has 1-click button to let them back in
                            if (isHostRef.current && payload?.targetUserId) {
                                setRemovedParticipants((prev) => [
                                    ...prev.filter((p) => p.userId !== payload.targetUserId),
                                    { userId: payload.targetUserId, username: payload.targetUsername || "Player" }
                                ]);
                            }
                        }
                        loadRoom(true);
                    }

                    if (evt === "player_left") {
                        if (payload?.username && payload.userId !== currentUserId) {
                            notify({
                                type: "warning",
                                title: "Combatant Departed",
                                message: `${payload.username} has left the lobby.`
                            });
                            // Store in removedParticipants so host can re-admit them
                            if (isHostRef.current && payload?.userId) {
                                setRemovedParticipants((prev) => [
                                    ...prev.filter((p) => p.userId !== payload.userId),
                                    { userId: payload.userId, username: payload.username || "Player" }
                                ]);
                            }
                        }
                        if (payload?.newHostId) {
                            if (payload.newHostId === currentUserId) {
                                notify({
                                    type: "info",
                                    title: "Promoted to Host",
                                    message: "The previous host left. You are now the room host!",
                                });
                            } else {
                                notify({
                                    type: "info",
                                    title: "Host Migrated",
                                    message: "Host privileges were transferred to the next combatant.",
                                });
                            }
                        }
                        loadRoom(true);
                    }

                    if (evt === "room_updated" || evt === "player_joined" || evt === "player_ready_changed" || evt === "host_role_updated") {
                        if (evt === "player_joined" && payload?.username && payload.userId !== currentUserId) {
                            notify({
                                type: "info",
                                title: "Combatant Joined",
                                message: `${payload.username} joined the lobby.`
                            });
                        }
                        if (payload?.newHostId) {
                            if (payload.newHostId === currentUserId) {
                                notify({
                                    type: "info",
                                    title: "Promoted to Host",
                                    message: "The previous host left. You are now the room host!",
                                });
                            }
                        }
                        loadRoom(true);
                    }

                    if (evt === "squad_roster_updated") {
                        loadRoom(true);
                    }

                    if (evt === "squad_approval_updated") {
                        setRoom((prev) => {
                            if (!prev) return prev;
                            const updatedTeams = (prev.teams || []).map((t) => {
                                if (t.teamSide === "ALPHA") return { ...t, captainApproved: payload?.alphaApproved };
                                if (t.teamSide === "BETA") return { ...t, captainApproved: payload?.betaApproved };
                                return t;
                            });
                            return {
                                ...prev,
                                teams: updatedTeams,
                                rosterVersion: payload?.rosterVersion ?? prev.rosterVersion,
                            };
                        });
                    }

                    if (evt === "squad_countdown_tick") {
                        setCountdown(payload?.count);
                    }

                    if (evt === "squad_countdown_aborted") {
                        setCountdown(null);
                        notify({
                            type: "warning",
                            title: "Countdown Cancelled",
                            message: payload?.reason || "A captain cancelled approval or the roster changed.",
                        });
                    }

                    if (evt === "battle_started" || evt === "match_found") {
                        setActiveEvent({
                            type: "BATTLE",
                            roomCode: payload?.roomCode || roomCode,
                            roomId: payload?.roomId || room?.id,
                            status: "RUNNING",
                            isHost: isHostRef.current,
                            participantCount: participants.length,
                        });
                        setStarting(true);
                        setCountdown(3);

                        let count = 3;
                        const timer = setInterval(() => {
                            count -= 1;
                            setCountdown(count);
                            if (count <= 0) {
                                clearInterval(timer);
                                const isHostViewing = Boolean(
                                    isHostRef.current && (
                                        room?.hostRole === "VIEWER" ||
                                        !participants.some((p) => p.userId === currentUserId)
                                    )
                                );
                                navigate("/battle/live", {
                                    state: {
                                        matchData: {
                                            ...(payload || {}),
                                            hostRole: room?.hostRole,
                                            hostId: room?.hostId,
                                            isViewer: isHostViewing,
                                        },
                                        roomCode,
                                        isViewer: isHostViewing,
                                    }
                                });
                            }
                        }, 1000);
                    }
                } catch (err) {
                    console.error("Socket error in lobby:", err);
                }
            };
        } catch (err) {
            console.warn("Could not initiate WebSocket in lobby:", err);
        }

        return () => {
            if (ws) {
                ws.close();
            }
        };
    }, [roomCode, currentUserId, currentUsername]);

    // Copy Room Code to Clipboard
    const copyCode = () => {
        navigator.clipboard.writeText(roomCode);
        notify({ type: "success", title: "Copied!", message: `Room Code ${roomCode} copied to clipboard.` });
    };

    // Leave Lobby
    const handleLeaveLobby = async () => {
        try {
            clearActiveEvent();
            if (socketRef.current?.readyState === WebSocket.OPEN) {
                socketRef.current.send(JSON.stringify({
                    action: "leave_room_channel",
                    payload: { roomCode, userId: currentUserId, username: currentUsername },
                }));
            }

            if (room?.id || roomCode) {
                await requestJson(`/api/battle/rooms/${room?.id || roomCode}/leave`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userId: currentUserId }),
                    includeAuth: true,
                }).catch(() => {});
            }
        } finally {
            navigate("/battle");
        }
    };

    // Host Approves Single Join Request
    const handleApproveJoin = async (req) => {
        try {
            setJoinRequests((prev) => prev.filter((r) => r.userId !== req.userId));
            setRemovedParticipants((prev) => prev.filter((r) => r.userId !== req.userId));

            await requestJson(`/api/battle/rooms/${room?.id || roomCode}/join`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: req.userId }),
                includeAuth: true,
            }).catch(() => {});

            if (socketRef.current?.readyState === WebSocket.OPEN) {
                socketRef.current.send(JSON.stringify({
                    action: "approve_join_request",
                    payload: {
                        roomCode,
                        hostId: currentUserId,
                        targetUserId: req.userId,
                        targetUsername: req.username,
                    },
                }));
            }

            notify({ type: "success", title: "Combatant Admitted", message: `${req.username} was allowed into the lobby.` });
            loadRoom(true);
        } catch (err) {
            notify({ type: "error", title: "Approval Failed", message: err.message });
        }
    };

    // Host Approves ALL Join Requests in Batch
    const handleApproveAllJoin = async () => {
        if (joinRequests.length === 0) return;
        const currentBatch = [...joinRequests];
        setJoinRequests([]);

        try {
            for (const req of currentBatch) {
                await requestJson(`/api/battle/rooms/${room?.id || roomCode}/join`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userId: req.userId }),
                    includeAuth: true,
                }).catch(() => {});
            }

            if (socketRef.current?.readyState === WebSocket.OPEN) {
                socketRef.current.send(JSON.stringify({
                    action: "approve_all_join_requests",
                    payload: {
                        roomCode,
                        hostId: currentUserId,
                        requests: currentBatch,
                    },
                }));
            }

            notify({ type: "success", title: "Batch Admission", message: `Admitted ${currentBatch.length} students into the lobby.` });
            loadRoom(true);
        } catch (err) {
            notify({ type: "error", title: "Batch Approval Failed", message: err.message });
        }
    };

    // Host Rejects Single Join Request
    const handleRejectJoin = (req) => {
        setJoinRequests((prev) => prev.filter((r) => r.userId !== req.userId));
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({
                action: "reject_join_request",
                payload: {
                    roomCode,
                    hostId: currentUserId,
                    targetUserId: req.userId,
                    reason: "Host declined your join request.",
                },
            }));
        }
        notify({ type: "info", title: "Request Declined", message: `Declined entry for ${req.username}.` });
    };

    // Host Rejects ALL Join Requests
    const handleRejectAllJoin = () => {
        if (joinRequests.length === 0) return;
        const currentBatch = [...joinRequests];
        setJoinRequests([]);

        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({
                action: "reject_all_join_requests",
                payload: {
                    roomCode,
                    hostId: currentUserId,
                    requests: currentBatch,
                    reason: "Host declined all pending join requests.",
                },
            }));
        }
        notify({ type: "info", title: "Requests Declined", message: `Declined ${currentBatch.length} pending join requests.` });
    };

    // Host Approves Anti-Cheat Pardon Request
    const handleApprovePardon = (req) => {
        setPardonRequests((prev) => prev.filter((r) => r.userId !== req.userId));
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({
                action: "approve_anticheat_reentry",
                payload: {
                    roomId: room?.id || roomCode,
                    targetUserId: req.userId,
                },
            }));
        }
        notify({ type: "success", title: "Pardon Approved", message: `Admitted ${req.username || "player"} back.` });
        loadRoom(true);
    };

    // Host Rejects Anti-Cheat Pardon Request
    const handleRejectPardon = (req) => {
        setPardonRequests((prev) => prev.filter((r) => r.userId !== req.userId));
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({
                action: "reject_anticheat_reentry",
                payload: {
                    roomId: room?.id || roomCode,
                    targetUserId: req.userId,
                },
            }));
        }
        notify({ type: "info", title: "Request Declined", message: `Declined pardon for ${req.username || "player"}.` });
    };

    // Host Kicks Player
    const handleKickPlayer = async (targetUserId, targetUsername) => {
        if (!window.confirm(`Are you sure you want to remove ${targetUsername} from the lobby?`)) {
            return;
        }

        try {
            setKickingUserId(targetUserId);
            // Track in removed list so host can re-admit them at any time
            setRemovedParticipants((prev) => [
                ...prev.filter((p) => p.userId !== targetUserId),
                { userId: targetUserId, username: targetUsername || "Player" }
            ]);

            // Send ONLY via WebSocket to ensure proper event broadcasting
            // (REST call removed to prevent duplicate kicks/race conditions that break the kicked_from_room event)
            if (socketRef.current?.readyState === WebSocket.OPEN) {
                socketRef.current.send(JSON.stringify({
                    action: "kick_player",
                    payload: {
                        roomCode,
                        hostId: currentUserId,
                        targetUserId,
                        targetUsername,
                    },
                }));
            } else {
                throw new Error("Connection lost. Please try again.");
            }

            // Let the websocket response (player_kicked) handle the UI update
        } catch (err) {
            notify({ type: "error", title: "Kick Failed", message: err.message || "Failed to remove player." });
            setKickingUserId(null);
        }
    };

    // Toggle Ready Status
    const handleToggleReady = async () => {
        try {
            const nextReady = !isReady;
            setIsReady(nextReady);

            if (room?.id) {
                await requestJson(`/api/battle/rooms/${room.id}/ready`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userId: currentUserId, isReady: nextReady }),
                    includeAuth: true,
                });
            }

            if (socketRef.current?.readyState === WebSocket.OPEN) {
                socketRef.current.send(JSON.stringify({
                    action: "toggle_ready",
                    payload: { roomCode, userId: currentUserId, isReady: nextReady },
                }));
            }
        } catch (err) {
            setIsReady(!isReady); // Revert on failure
            notify({ type: "error", title: "Ready Check Failed", message: err.message });
        }
    };

    // Host switches role between Viewer/Proctor and Active Participant
    const handleToggleHostRole = async () => {
        try {
            const nextRole = isHostViewer ? "PARTICIPANT" : "VIEWER";
            await requestJson(`/api/battle/rooms/${room?.id || roomCode}/role`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ hostRole: nextRole }),
                includeAuth: true,
            });
            setRoom((prev) => (prev ? { ...prev, hostRole: nextRole } : prev));
            notify({
                type: "success",
                title: "Host Role Updated",
                message: nextRole === "VIEWER"
                    ? "Switched to Spectator / Proctor. Your player slot is now freed for other participants."
                    : "Switched to Active Competitor. You are now entered as a combatant in the battle."
            });
            loadRoom(true);
        } catch (err) {
            notify({
                type: "error",
                title: "Role Switch Failed",
                message: err.message || "Failed to switch host role."
            });
        }
    };

    // Host Starts Battle
    const handleStartBattle = async () => {
        if (participants.length < 2) {
            notify({ type: "warning", title: "Waiting for Combatants", message: "At least 2 participants are required to launch battle." });
            return;
        }

        try {
            setStarting(true);
            if (room?.id) {
                await requestJson(`/api/battle/rooms/${room.id}/start`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ hostId: currentUserId }),
                    includeAuth: true,
                });
            }

            if (socketRef.current?.readyState === WebSocket.OPEN) {
                socketRef.current.send(JSON.stringify({
                    action: "start_room_battle",
                    payload: { roomCode, hostId: currentUserId },
                }));
            }
        } catch (err) {
            setStarting(false);
            notify({ type: "error", title: "Launch Failed", message: err.message || "Cannot start battle." });
        }
    };

    // Squad Battle Specific Properties & Handlers
    const isSquadBattle = room?.battleMode === "SQUAD_BATTLE" || Boolean(room?.teams?.length);
    const alphaTeam = (room?.teams || []).find((t) => t.teamSide === "ALPHA");
    const betaTeam = (room?.teams || []).find((t) => t.teamSide === "BETA");
    const squadSize = room?.squadSize || 2;
    const squadCapacity = squadSize * 2;

    const alphaParticipants = participants.filter(
        (p) => p.teamId === alphaTeam?.id || p.teamSide === "ALPHA" || p.participantCode?.startsWith("A-")
    );
    const betaParticipants = participants.filter(
        (p) => p.teamId === betaTeam?.id || p.teamSide === "BETA" || p.participantCode?.startsWith("B-")
    );

    const isAlphaCaptain = Boolean(
        alphaTeam && (alphaTeam.captainUserId === currentUserId || (isHost && !alphaTeam.captainUserId))
    );
    const isBetaCaptain = Boolean(
        betaTeam && (betaTeam.captainUserId === currentUserId)
    );
    const isAnyCaptain = isAlphaCaptain || isBetaCaptain;
    const alphaApproved = Boolean(alphaTeam?.captainApproved);
    const betaApproved = Boolean(betaTeam?.captainApproved);

    const handleToggleSquadApproval = async () => {
        const myApproval = isAlphaCaptain ? alphaApproved : betaApproved;
        const nextApproved = !myApproval;
        try {
            await requestJson(`/api/battle/squad/${encodeURIComponent(room?.roomCode || roomCode)}/approve`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: currentUserId,
                    isApproved: nextApproved,
                    rosterVersion: room?.rosterVersion || 1,
                }),
                includeAuth: true,
            });

            if (socketRef.current?.readyState === WebSocket.OPEN) {
                socketRef.current.send(JSON.stringify({
                    action: "squad_approval_toggle",
                    payload: {
                        roomCode: room?.roomCode || roomCode,
                        userId: currentUserId,
                        isApproved: nextApproved,
                        rosterVersion: room?.rosterVersion || 1,
                    },
                }));
            }

            notify({
                type: nextApproved ? "success" : "info",
                title: nextApproved ? "Squad Approved" : "Approval Retracted",
                message: nextApproved ? "Waiting for opposing captain's approval..." : "Approval cancelled.",
            });
            loadRoom(true);
        } catch (err) {
            notify({
                type: "error",
                title: "Approval Failed",
                message: err.message || "Failed to update squad approval.",
            });
        }
    };

    const handleKickSquadMember = async (targetUserId, targetUsername) => {
        if (!window.confirm(`Kick ${targetUsername} from your squad?`)) return;
        try {
            await requestJson(`/api/battle/squad/${encodeURIComponent(room?.roomCode || roomCode)}/kick`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    captainUserId: currentUserId,
                    targetUserId,
                }),
                includeAuth: true,
            });
            notify({
                type: "info",
                title: "Member Evicted",
                message: `${targetUsername} was removed from your squad.`,
            });
            loadRoom(true);
        } catch (err) {
            notify({
                type: "error",
                title: "Kick Failed",
                message: err.message || "Could not kick squad member.",
            });
        }
    };

    const copyTeamCode = (teamCode, teamLabel) => {
        if (!teamCode) return;
        navigator.clipboard.writeText(teamCode);
        notify({
            type: "success",
            title: "Code Copied!",
            message: `${teamLabel} Invite Code (${teamCode}) copied to clipboard.`,
        });
    };

    // Metrics for classroom / 50-student scaling
    const maxCapacity = isSquadBattle ? squadCapacity : (room?.maxPlayers || 2);
    const readyCount = useMemo(() => {
        return participants.filter((p) => p.isReady || ((p.userId === room?.hostId || p.userId === room?.host?.id) && room?.hostRole !== "VIEWER")).length;
    }, [participants, room?.hostId, room?.host?.id, room?.hostRole]);

    const readyPercentage = useMemo(() => {
        if (participants.length === 0) return 0;
        return Math.round((readyCount / participants.length) * 100);
    }, [readyCount, participants.length]);

    // Filter & Search
    const filteredParticipants = useMemo(() => {
        return participants.filter((p) => {
            const isMe = p.userId === currentUserId;
            const name = (
                p.user?.username || 
                p.username || 
                (isMe ? currentUsername : null) || 
                (p.user?.email ? p.user.email.split('@')[0] : "")
            ).toLowerCase();
            const id = (p.userId || "").toLowerCase();
            const query = searchQuery.trim().toLowerCase();
            const matchesSearch = !query || name.includes(query) || id.includes(query);

            const isPlayerHost = (p.userId === room?.hostId || p.userId === room?.host?.id) && room?.hostRole !== "VIEWER";
            const isPlayerReady = p.isReady || isPlayerHost;

            if (!matchesSearch) return false;
            if (filterTab === "READY") return isPlayerReady;
            if (filterTab === "WAITING") return !isPlayerReady;
            return true;
        });
    }, [participants, searchQuery, filterTab, room?.hostId, room?.host?.id, room?.hostRole]);

    if (loading) {
        return (
            <div className="lobby-root">
                <div className="lobby-loader">
                    <FontAwesomeIcon icon={faBolt} spin />
                    <h2>INITIALIZING COMBAT LOBBY...</h2>
                </div>
            </div>
        );
    }

    if (waitingForAdmission) {
        return (
            <div className="lobby-root">
                <div className="lobby-container" style={{ maxWidth: "600px", margin: "80px auto", textAlign: "center" }}>
                    <motion.div
                        className="lobby-card-main"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        style={{ padding: "40px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}
                    >
                        <div style={{ width: "70px", height: "70px", borderRadius: "50%", background: "rgba(0, 240, 255, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem", color: "#00f0ff" }}>
                            <FontAwesomeIcon icon={faHourglassHalf} className="pulse" />
                        </div>
                        <h2 style={{ margin: 0, fontSize: "1.6rem", color: "#fff", letterSpacing: "1px" }}>
                            ADMISSION REQUEST PENDING
                        </h2>
                        <p style={{ color: "#aaa", fontSize: "0.95rem", maxWidth: "450px", lineHeight: "1.6", margin: 0 }}>
                            You have requested entry into battle room <strong>{roomCode}</strong>. The host has been notified and can admit you directly into the lobby.
                        </p>
                        <div style={{ display: "flex", gap: "12px", marginTop: "10px" }}>
                            <button
                                className="btn-hud-primary"
                                style={{ padding: "10px 20px" }}
                                onClick={() => {
                                    if (socketRef.current?.readyState === WebSocket.OPEN) {
                                        socketRef.current.send(JSON.stringify({
                                            action: "request_join_room",
                                            payload: {
                                                roomCode,
                                                userId: currentUserId,
                                                username: currentUsername,
                                                rating: user?.rating ?? 0,
                                            },
                                        }));
                                        notify({ type: "info", title: "Request Sent", message: "Admission request re-sent to the room host." });
                                    }
                                }}
                            >
                                <FontAwesomeIcon icon={faBolt} /> Re-request Access
                            </button>
                            <button
                                className="btn-hud-back"
                                style={{ padding: "10px 20px" }}
                                onClick={() => navigate("/battle")}
                            >
                                <FontAwesomeIcon icon={faArrowLeft} /> Exit to Arenas
                            </button>
                        </div>
                    </motion.div>
                </div>
            </div>
        );
    }

    return (
        <div className="lobby-root">
            {countdown !== null && (
                <div className="countdown-overlay">
                    <motion.div
                        className="countdown-number"
                        key={countdown}
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1.5, opacity: 1 }}
                        exit={{ scale: 2, opacity: 0 }}
                    >
                        {countdown === 0 ? "FIGHT!" : countdown}
                    </motion.div>
                </div>
            )}

            <div className="lobby-container">
                {/* Header Bar */}
                <div className="lobby-header">
                    <button className="btn-hud-back" onClick={handleLeaveLobby}>
                        <FontAwesomeIcon icon={faArrowLeft} /> Leave Lobby
                    </button>
                    <div className="lobby-badge">
                        <FontAwesomeIcon icon={isSquadBattle ? faShieldHalved : (maxCapacity >= 16 ? faGraduationCap : faUsers)} />
                        {isSquadBattle
                            ? `SQUAD BATTLE ARENA (${squadSize}v${squadSize})`
                            : (maxCapacity >= 16 ? `CLASSROOM ARENA (${maxCapacity} SEATS)` : "CUSTOM BATTLE LOBBY")}
                    </div>
                </div>

                {/* Room Information Card */}
                <motion.div
                    className="lobby-card-main"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <div className="room-meta-strip">
                        <div className="room-code-display" onClick={copyCode} title="Click to copy invite code">
                            <span className="code-label">ROOM CODE</span>
                            <div className="code-value">
                                {roomCode} <FontAwesomeIcon icon={faCopy} className="copy-icon" />
                            </div>
                        </div>

                        {isSquadBattle && alphaTeam?.teamCode && (
                            <div
                                className="room-code-display"
                                onClick={() => copyTeamCode(alphaTeam.teamCode, "Team Alpha")}
                                title="Click to copy Alpha invite code"
                                style={{ borderColor: "rgba(6, 182, 212, 0.4)", background: "rgba(6, 182, 212, 0.08)" }}
                            >
                                <span className="code-label" style={{ color: "#38bdf8" }}>ALPHA INVITE CODE</span>
                                <div className="code-value" style={{ color: "#38bdf8" }}>
                                    {alphaTeam.teamCode} <FontAwesomeIcon icon={faCopy} className="copy-icon" />
                                </div>
                            </div>
                        )}

                        {isSquadBattle && betaTeam?.teamCode && (
                            <div
                                className="room-code-display"
                                onClick={() => copyTeamCode(betaTeam.teamCode, "Team Beta")}
                                title="Click to copy Beta invite code"
                                style={{ borderColor: "rgba(168, 85, 247, 0.4)", background: "rgba(168, 85, 247, 0.08)" }}
                            >
                                <span className="code-label" style={{ color: "#c084fc" }}>BETA INVITE CODE</span>
                                <div className="code-value" style={{ color: "#c084fc" }}>
                                    {betaTeam.teamCode} <FontAwesomeIcon icon={faCopy} className="copy-icon" />
                                </div>
                            </div>
                        )}

                        <div className="room-specs">
                            <div className="spec-item">
                                <span className="spec-label">Capacity</span>
                                <span className="spec-val">{participants.length} / {maxCapacity}</span>
                            </div>
                            <div className="spec-item">
                                <span className="spec-label">Time Limit</span>
                                <span className="spec-val">{room?.timeLimitMinutes || 15} Mins</span>
                            </div>
                            <div className="spec-item">
                                <span className="spec-label">Problems</span>
                                <span className="spec-val">{room?.questionCount || 3} ({room?.difficulty || "MIX"})</span>
                            </div>
                            <div className="spec-item">
                                <span className="spec-label">Host</span>
                                <span className="spec-val" style={{ color: '#ffd500', fontWeight: 600 }}>
                                    {room?.host?.username || (isHost ? currentUsername : "Host")}
                                </span>
                            </div>
                            <div className="spec-item">
                                <span className="spec-label">Host Role</span>
                                <span className="spec-val" style={{ color: room?.hostRole === "VIEWER" ? "#c084fc" : "#38bdf8", fontWeight: 700 }}>
                                    {room?.hostRole === "VIEWER" ? "👁️ Proctor / Viewer" : "⚔️ Competitor"}
                                </span>
                            </div>
                            <div className="spec-item">
                                <span className="spec-label">Status</span>
                                <span className={`spec-status ${room?.status?.toLowerCase()}`}>{room?.status || "WAITING"}</span>
                            </div>
                        </div>
                    </div>

                    {/* Readiness Progress Bar for Classroom / Tournament */}
                    {!isSquadBattle && (
                        <div className="readiness-meter-container">
                            <div className="readiness-meter-labels">
                                <span className="meter-title">
                                    <FontAwesomeIcon icon={faCheckCircle} /> Readiness Status: <strong>{readyCount} / {participants.length} Students Ready</strong> ({readyPercentage}%)
                                </span>
                                <span className="meter-sub">
                                    {participants.length >= 2 ? "Ready to start battle when instructor launches" : "Waiting for at least 2 participants to join"}
                                </span>
                            </div>
                            <div className="readiness-progress-track">
                                <motion.div
                                    className="readiness-progress-fill"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${readyPercentage}%` }}
                                    transition={{ duration: 0.4 }}
                                />
                            </div>
                        </div>
                    )}
                </motion.div>

                {/* Host Join Requests Queue */}
                <AnimatePresence>
                    {isHost && joinRequests.length > 0 && (
                        <motion.div
                            className="host-join-requests-panel"
                            initial={{ opacity: 0, y: -15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            <div className="requests-header">
                                <div className="requests-title">
                                    <FontAwesomeIcon icon={faBell} className="request-bell pulse" />
                                    <span>Incoming Join Requests ({joinRequests.length})</span>
                                </div>
                                <div className="requests-batch-actions">
                                    <button
                                        className="btn-batch-allow"
                                        onClick={handleApproveAllJoin}
                                        title="Admit all waiting students into the lobby"
                                    >
                                        <FontAwesomeIcon icon={faCheckDouble} /> Admit All ({joinRequests.length})
                                    </button>
                                    <button
                                        className="btn-batch-reject"
                                        onClick={handleRejectAllJoin}
                                        title="Decline all waiting requests"
                                    >
                                        <FontAwesomeIcon icon={faTimes} /> Decline All
                                    </button>
                                </div>
                            </div>

                            <div className="requests-list">
                                {joinRequests.map((req) => (
                                    <motion.div
                                        key={req.userId}
                                        className="request-item-card"
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                    >
                                        <div className="req-user-info">
                                            <div className="req-avatar">
                                                {(req.username || "P")[0].toUpperCase()}
                                            </div>
                                            <div className="req-meta">
                                                <div className="req-name">{req.username || "Anonymous"}</div>
                                                <div className="req-rating" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <RankEmblem rating={req.rating ?? 0} size={18} glow={false} />
                                                    <span>Rating: {req.rating ?? 0}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="req-actions">
                                            <button
                                                className="btn-req-allow"
                                                onClick={() => handleApproveJoin(req)}
                                                title="Admit player into lobby"
                                            >
                                                <FontAwesomeIcon icon={faUserCheck} /> Allow
                                            </button>
                                            <button
                                                className="btn-req-reject"
                                                onClick={() => handleRejectJoin(req)}
                                                title="Decline player"
                                            >
                                                <FontAwesomeIcon icon={faTimes} />
                                            </button>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Host Anti-Cheat Pardon Requests Queue */}
                <AnimatePresence>
                    {isHost && pardonRequests.length > 0 && (
                        <motion.div
                            className="host-join-requests-panel"
                            style={{ borderColor: "rgba(245, 158, 11, 0.45)", background: "rgba(24, 20, 12, 0.85)" }}
                            initial={{ opacity: 0, y: -15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            <div className="requests-header">
                                <div className="requests-title">
                                    <FontAwesomeIcon icon={faShieldHalved} style={{ color: "#fbbf24" }} className="pulse" />
                                    <span style={{ color: "#fbbf24" }}>Anti-Cheat Pardon Requests ({pardonRequests.length})</span>
                                </div>
                            </div>

                            <div className="requests-list">
                                {pardonRequests.map((req) => (
                                    <motion.div
                                        key={req.userId}
                                        className="request-item-card"
                                        style={{ borderColor: "rgba(245, 158, 11, 0.35)" }}
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                    >
                                        <div className="req-user-info">
                                            <div className="req-avatar" style={{ background: "rgba(245, 158, 11, 0.2)", color: "#fbbf24", border: "1px solid rgba(245, 158, 11, 0.4)" }}>
                                                {(req.username || "P")[0].toUpperCase()}
                                            </div>
                                            <div className="req-meta">
                                                <div className="req-name" style={{ color: "#f8fafc" }}>{req.username || "Anonymous"}</div>
                                                <div className="req-rating" style={{ color: "#f87171", fontSize: "0.8rem", fontWeight: 600 }}>
                                                    Disqualified: {req.tabSwitches || 3} Tab Switches
                                                </div>
                                            </div>
                                        </div>

                                        <div className="req-actions">
                                            <button
                                                className="btn-req-allow"
                                                style={{ background: "linear-gradient(135deg, rgba(16, 185, 129, 0.3), rgba(5, 150, 105, 0.4))", borderColor: "rgba(16, 185, 129, 0.6)", color: "#6ee7b7" }}
                                                onClick={() => handleApprovePardon(req)}
                                                title="Pardon anti-cheat violations and admit back"
                                            >
                                                <FontAwesomeIcon icon={faCheck} /> Approve Re-Entry
                                            </button>
                                            <button
                                                className="btn-req-reject"
                                                onClick={() => handleRejectPardon(req)}
                                                title="Decline pardon"
                                            >
                                                <FontAwesomeIcon icon={faTimes} />
                                            </button>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Host Re-admit Removed Combatants Panel */}
                <AnimatePresence>
                    {isHost && removedParticipants.length > 0 && (
                        <motion.div
                            className="host-join-requests-panel"
                            style={{ borderColor: "rgba(255, 170, 0, 0.4)", background: "rgba(25, 20, 10, 0.75)" }}
                            initial={{ opacity: 0, y: -15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            <div className="requests-header">
                                <div className="requests-title">
                                    <FontAwesomeIcon icon={faUserSlash} style={{ color: "#ffaa00" }} />
                                    <span>Removed / Departed Players ({removedParticipants.length})</span>
                                </div>
                                <div className="requests-batch-actions">
                                    <button
                                        className="btn-batch-allow"
                                        style={{ background: "#ffaa00", color: "#000" }}
                                        onClick={() => {
                                            removedParticipants.forEach((p) => handleApproveJoin(p));
                                        }}
                                        title="Allow all removed combatants back into the room"
                                    >
                                        <FontAwesomeIcon icon={faCheckDouble} /> Allow All Back In
                                    </button>
                                </div>
                            </div>

                            <div className="requests-list">
                                {removedParticipants.map((p) => (
                                    <motion.div
                                        key={p.userId}
                                        className="request-item-card"
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                    >
                                        <div className="req-user-info">
                                            <div className="req-avatar" style={{ background: "rgba(255, 170, 0, 0.2)", color: "#ffaa00" }}>
                                                {(p.username || "P")[0].toUpperCase()}
                                            </div>
                                            <div className="req-meta">
                                                <div className="req-name">{p.username || "Player"}</div>
                                                <div className="req-rating" style={{ color: "#aaa", fontSize: "0.85rem" }}>
                                                    <span>Player exited or was removed</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="req-actions">
                                            <button
                                                className="btn-req-allow"
                                                style={{ background: "rgba(255, 170, 0, 0.2)", color: "#ffaa00", borderColor: "rgba(255, 170, 0, 0.5)" }}
                                                onClick={() => handleApproveJoin(p)}
                                                title="Let player back into the room"
                                            >
                                                <FontAwesomeIcon icon={faUserCheck} /> Allow Back In
                                            </button>
                                            <button
                                                className="btn-req-reject"
                                                onClick={() => setRemovedParticipants((prev) => prev.filter((r) => r.userId !== p.userId))}
                                                title="Dismiss"
                                            >
                                                <FontAwesomeIcon icon={faTimes} />
                                            </button>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Squad Battle Dual-Captain Approval Gate */}
                {isSquadBattle && (
                    <motion.div
                        className="squad-gate-card"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <div className="squad-gate-top">
                            <div className="squad-gate-title">
                                <FontAwesomeIcon icon={faShieldHalved} style={{ color: "#38bdf8" }} />
                                <span>Dual-Captain Approval Gate</span>
                            </div>
                            <div className="squad-gate-notice">
                                Both captains must approve before synchronized launch • Roster changes reset approvals
                            </div>
                        </div>

                        <div className="squad-captains-status-grid">
                            <div className={`captain-status-badge alpha-side ${alphaApproved ? 'approved' : ''}`}>
                                <div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#38bdf8' }}>TEAM ALPHA CAPTAIN</div>
                                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc' }}>
                                        {alphaTeam?.captainUserId ? (
                                            participants.find((p) => p.userId === alphaTeam.captainUserId)?.username || "Alpha Captain"
                                        ) : (
                                            "Pending Assignment"
                                        )}
                                    </div>
                                </div>
                                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: alphaApproved ? '#34d399' : '#f59e0b' }}>
                                    {alphaApproved ? '✓ APPROVED & READY' : '⏳ PENDING'}
                                </span>
                            </div>

                            <div className="gate-vs-badge">VS</div>

                            <div className={`captain-status-badge beta-side ${betaApproved ? 'approved' : ''}`}>
                                <div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#c084fc' }}>TEAM BETA CAPTAIN</div>
                                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc' }}>
                                        {betaTeam?.captainUserId ? (
                                            participants.find((p) => p.userId === betaTeam.captainUserId)?.username || "Beta Captain"
                                        ) : (
                                            "Pending Assignment"
                                        )}
                                    </div>
                                </div>
                                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: betaApproved ? '#34d399' : '#f59e0b' }}>
                                    {betaApproved ? '✓ APPROVED & READY' : '⏳ PENDING'}
                                </span>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* SQUAD BATTLE SPLIT TEAMS GRID */}
                {isSquadBattle ? (
                    <div className="squad-teams-grid">
                        {/* TEAM ALPHA CARD */}
                        <div className="squad-team-card alpha">
                            <div className="team-card-header">
                                <div className="team-title-group">
                                    <span className="team-tag-pill alpha">ALPHA SQUAD</span>
                                    <h3 className="team-name-text">Team Alpha</h3>
                                </div>
                                <button
                                    type="button"
                                    className="btn-team-code-copy"
                                    onClick={() => copyTeamCode(alphaTeam?.teamCode, "Team Alpha")}
                                    title="Copy Team Alpha Invite Code"
                                >
                                    <FontAwesomeIcon icon={faCopy} />
                                    <span>{alphaTeam?.teamCode || "SQ-ALP"}</span>
                                </button>
                            </div>

                            <div className="squad-slots-container">
                                {Array.from({ length: squadSize }).map((_, slotIdx) => {
                                    const member = alphaParticipants[slotIdx];
                                    const slotCode = `A-0${slotIdx + 1}`;
                                    const isMemberCaptain = member && member.userId === alphaTeam?.captainUserId;
                                    const isMe = member && member.userId === currentUserId;

                                    if (member) {
                                        const memberName =
                                            member.user?.username ||
                                            member.username ||
                                            (isMe ? currentUsername : `Combatant ${slotIdx + 1}`);
                                        const memberRating = member.user?.rating ?? member.rating ?? 0;

                                        return (
                                            <div key={member.userId || slotIdx} className={`squad-slot-item filled ${isMe ? 'me' : ''}`}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <span className="slot-code-tag">{slotCode}</span>
                                                    <div className="participant-avatar" style={{ width: '32px', height: '32px', fontSize: '0.85rem' }}>
                                                        {(memberName || 'A')[0].toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <span>{memberName}</span>
                                                            {isMe && <span className="me-badge">YOU</span>}
                                                            {isMemberCaptain && (
                                                                <span style={{ fontSize: '0.65rem', background: '#ffd500', color: '#0f172a', fontWeight: 900, padding: '1px 5px', borderRadius: '4px' }}>
                                                                    <FontAwesomeIcon icon={faCrown} /> CAPTAIN
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <RankEmblem rating={memberRating} size={14} glow={false} />
                                                            <span>Rating: {memberRating}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {isAlphaCaptain && !isMe && (
                                                    <button
                                                        className="btn-card-kick"
                                                        onClick={() => handleKickSquadMember(member.userId, memberName)}
                                                        title={`Kick ${memberName} from squad`}
                                                    >
                                                        <FontAwesomeIcon icon={faUserSlash} />
                                                        <span>Kick</span>
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    }

                                    return (
                                        <div
                                            key={slotIdx}
                                            className="squad-slot-item empty"
                                            onClick={() => copyTeamCode(alphaTeam?.teamCode, "Team Alpha")}
                                            style={{ cursor: 'pointer' }}
                                            title="Click to copy Alpha invite code"
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <span className="slot-code-tag">{slotCode}</span>
                                                <span style={{ fontSize: '0.82rem', color: '#64748b' }}>Empty Alpha Slot</span>
                                            </div>
                                            <span style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 600 }}>
                                                <FontAwesomeIcon icon={faCopy} /> Copy Invite
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* TEAM BETA CARD */}
                        <div className="squad-team-card beta">
                            <div className="team-card-header">
                                <div className="team-title-group">
                                    <span className="team-tag-pill beta">BETA SQUAD</span>
                                    <h3 className="team-name-text">Team Beta</h3>
                                </div>
                                <button
                                    type="button"
                                    className="btn-team-code-copy"
                                    onClick={() => copyTeamCode(betaTeam?.teamCode, "Team Beta")}
                                    title="Copy Team Beta Invite Code"
                                >
                                    <FontAwesomeIcon icon={faCopy} />
                                    <span>{betaTeam?.teamCode || "SQ-BET"}</span>
                                </button>
                            </div>

                            <div className="squad-slots-container">
                                {Array.from({ length: squadSize }).map((_, slotIdx) => {
                                    const member = betaParticipants[slotIdx];
                                    const slotCode = `B-0${slotIdx + 1}`;
                                    const isMemberCaptain = member && member.userId === betaTeam?.captainUserId;
                                    const isMe = member && member.userId === currentUserId;

                                    if (member) {
                                        const memberName =
                                            member.user?.username ||
                                            member.username ||
                                            (isMe ? currentUsername : `Combatant ${slotIdx + 1}`);
                                        const memberRating = member.user?.rating ?? member.rating ?? 0;

                                        return (
                                            <div key={member.userId || slotIdx} className={`squad-slot-item filled ${isMe ? 'me' : ''}`}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <span className="slot-code-tag">{slotCode}</span>
                                                    <div className="participant-avatar" style={{ width: '32px', height: '32px', fontSize: '0.85rem' }}>
                                                        {(memberName || 'B')[0].toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <span>{memberName}</span>
                                                            {isMe && <span className="me-badge">YOU</span>}
                                                            {isMemberCaptain && (
                                                                <span style={{ fontSize: '0.65rem', background: '#ffd500', color: '#0f172a', fontWeight: 900, padding: '1px 5px', borderRadius: '4px' }}>
                                                                    <FontAwesomeIcon icon={faCrown} /> CAPTAIN
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <RankEmblem rating={memberRating} size={14} glow={false} />
                                                            <span>Rating: {memberRating}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {isBetaCaptain && !isMe && (
                                                    <button
                                                        className="btn-card-kick"
                                                        onClick={() => handleKickSquadMember(member.userId, memberName)}
                                                        title={`Kick ${memberName} from squad`}
                                                    >
                                                        <FontAwesomeIcon icon={faUserSlash} />
                                                        <span>Kick</span>
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    }

                                    return (
                                        <div
                                            key={slotIdx}
                                            className="squad-slot-item empty"
                                            onClick={() => copyTeamCode(betaTeam?.teamCode, "Team Beta")}
                                            style={{ cursor: 'pointer' }}
                                            title="Click to copy Beta invite code"
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <span className="slot-code-tag">{slotCode}</span>
                                                <span style={{ fontSize: '0.82rem', color: '#64748b' }}>Empty Beta Slot</span>
                                            </div>
                                            <span style={{ fontSize: '0.75rem', color: '#c084fc', fontWeight: 600 }}>
                                                <FontAwesomeIcon icon={faCopy} /> Copy Invite
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Standard Participants Section with Search & Filter Bar */
                    <div className="participants-section">
                        <div className="participants-toolbar">
                            <h3 className="section-title-hud" style={{ margin: 0 }}>
                                <FontAwesomeIcon icon={faUsers} /> COMBATANTS ({participants.length}/{maxCapacity})
                            </h3>

                            {/* Search & Filter Controls */}
                            <div className="participants-controls">
                                <div className="search-bar-hud">
                                    <FontAwesomeIcon icon={faSearch} className="search-icon" />
                                    <input
                                        type="text"
                                        placeholder="Search student / combatant..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                    {searchQuery && (
                                        <button className="clear-search" onClick={() => setSearchQuery("")}>
                                            <FontAwesomeIcon icon={faTimes} />
                                        </button>
                                    )}
                                </div>

                                <div className="filter-pill-group">
                                    <button
                                        className={`filter-pill ${filterTab === "ALL" ? "active" : ""}`}
                                        onClick={() => setFilterTab("ALL")}
                                    >
                                        All ({participants.length})
                                    </button>
                                    <button
                                        className={`filter-pill ${filterTab === "READY" ? "active" : ""}`}
                                        onClick={() => setFilterTab("READY")}
                                    >
                                        Ready ({readyCount})
                                    </button>
                                    <button
                                        className={`filter-pill ${filterTab === "WAITING" ? "active" : ""}`}
                                        onClick={() => setFilterTab("WAITING")}
                                    >
                                        Waiting ({participants.length - readyCount})
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* If Host is Proctor/Viewer, render Host Supervisor banner above participants */}
                        {(room?.hostRole === "VIEWER" || isHostViewer) && (
                            <div
                                className="host-proctor-lobby-banner"
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    padding: "12px 18px",
                                    background: "linear-gradient(135deg, rgba(168, 85, 247, 0.16) 0%, rgba(56, 189, 248, 0.1) 100%)",
                                    border: "1px solid rgba(168, 85, 247, 0.35)",
                                    borderRadius: "10px",
                                    marginBottom: "14px",
                                    flexWrap: "wrap",
                                    gap: "10px",
                                }}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                    <div style={{ width: "38px", height: "38px", borderRadius: "50%", background: "rgba(168, 85, 247, 0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", color: "#c084fc", border: "1px solid rgba(168, 85, 247, 0.4)" }}>
                                        <FontAwesomeIcon icon={faEye} />
                                    </div>
                                    <div>
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                            <span style={{ fontWeight: 800, color: "#f3e8ff", fontSize: "0.92rem" }}>
                                                {room?.host?.username || (isHost ? currentUsername : "Room Host")}
                                            </span>
                                            <span style={{ background: "#a855f7", color: "#fff", fontSize: "0.68rem", fontWeight: 900, padding: "2px 8px", borderRadius: "6px" }}>
                                                <FontAwesomeIcon icon={faCrown} /> HOST PROCTOR
                                            </span>
                                            {(user?.role === "FACULTY" || user?.role === "ADMIN" || user?.userType === "FACULTY") && (
                                                <span style={{ background: "rgba(56, 189, 248, 0.2)", color: "#38bdf8", fontSize: "0.68rem", fontWeight: 800, padding: "2px 8px", borderRadius: "6px", border: "1px solid rgba(56, 189, 248, 0.4)" }}>
                                                    🎓 FACULTY / ADMIN
                                                </span>
                                            )}
                                            {isHost && <span className="me-badge">YOU</span>}
                                        </div>
                                        <div style={{ fontSize: "0.76rem", color: "#c084fc", marginTop: "2px" }}>
                                            Observing &amp; proctoring without occupying a competitor slot. {participants.length}/{maxCapacity} seats available for players.
                                        </div>
                                    </div>
                                </div>
                                {isHost && (
                                    <button
                                        type="button"
                                        onClick={handleToggleHostRole}
                                        disabled={starting}
                                        style={{
                                            background: "rgba(56, 189, 248, 0.15)",
                                            border: "1px solid #38bdf8",
                                            color: "#38bdf8",
                                            padding: "6px 14px",
                                            borderRadius: "8px",
                                            fontSize: "0.8rem",
                                            fontWeight: 700,
                                            cursor: "pointer",
                                        }}
                                        title="Switch to active competitor role"
                                    >
                                        Switch to Competitor ⚔️
                                    </button>
                                )}
                            </div>
                        )}

                        <div className="participants-grid">
                            {filteredParticipants.map((player, idx) => {
                                const isPlayerHost = player.userId === room?.hostId || player.userId === room?.host?.id;
                                const isMe = player.userId === currentUserId;
                                const playerName =
                                    player.user?.username ||
                                    player.username ||
                                    (isMe ? currentUsername : null) ||
                                    (player.user?.email ? player.user.email.split('@')[0] : null) ||
                                    (player.email ? player.email.split('@')[0] : null) ||
                                    `Combatant ${idx + 1}`;
                                const playerRating = player.user?.rating ?? player.rating ?? 0;

                                return (
                                    <motion.div
                                        key={player.userId || idx}
                                        className={`participant-card ${isMe ? "me" : ""}`}
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        layout
                                    >
                                        <div className="participant-avatar">
                                            {(playerName || "C")[0].toUpperCase()}
                                        </div>

                                        <div className="participant-info">
                                            <div className="participant-name">
                                                <span className="participant-name-text" title={playerName}>{playerName}</span>
                                                {isMe && <span className="me-badge">YOU</span>}
                                                {isPlayerHost && <span className="host-badge"><FontAwesomeIcon icon={faCrown} /> HOST</span>}
                                            </div>
                                            <div className="participant-rating" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <RankEmblem rating={playerRating} size={18} glow={false} />
                                                <span>Rating: {playerRating}</span>
                                            </div>
                                        </div>

                                        <div className="participant-status-group">
                                            <div className="participant-status">
                                                {player.isReady || isPlayerHost ? (
                                                    <span className="status-pill ready">
                                                        <FontAwesomeIcon icon={faCheckCircle} /> READY
                                                    </span>
                                                ) : (
                                                    <span className="status-pill waiting">
                                                        <FontAwesomeIcon icon={faHourglassHalf} /> WAITING
                                                    </span>
                                                )}
                                            </div>

                                            {/* Host Kick Power */}
                                            {isHost && !isPlayerHost && !isMe && (
                                                <button
                                                    className="btn-card-kick"
                                                    onClick={() => handleKickPlayer(player.userId, playerName)}
                                                    disabled={kickingUserId === player.userId}
                                                    title={`Kick ${playerName} from lobby`}
                                                >
                                                    <FontAwesomeIcon icon={faUserSlash} />
                                                    <span>{kickingUserId === player.userId ? "..." : "Kick"}</span>
                                                </button>
                                            )}
                                        </div>
                                    </motion.div>
                                );
                            })}

                            {/* If filtered list is empty due to search */}
                            {filteredParticipants.length === 0 && (
                                <div className="no-students-found">
                                    <FontAwesomeIcon icon={faSearch} />
                                    <span>No combatants matching "{searchQuery}" in {filterTab.toLowerCase()} category.</span>
                                </div>
                            )}

                            {/* Open Capacity Card */}
                            {participants.length < maxCapacity && (
                                <div className="capacity-summary-card" onClick={copyCode} title="Click to copy invite code">
                                    <div className="capacity-icon">
                                        <FontAwesomeIcon icon={faUserGraduate} />
                                    </div>
                                    <div className="capacity-info">
                                        <span className="capacity-title">{maxCapacity - participants.length} Open Seats Available</span>
                                        <span className="capacity-desc">Share code <b style={{ color: '#00e5ff' }}>{roomCode}</b> with classmates or contestants to join this lobby.</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Action Bottom Bar */}
                <div className="lobby-actions-footer">
                    {isSquadBattle ? (
                        <>
                            {isAlphaCaptain && (
                                <button
                                    className={`btn-squad-approve-glow ${alphaApproved ? 'retract' : 'approve'}`}
                                    onClick={handleToggleSquadApproval}
                                    disabled={starting}
                                >
                                    <FontAwesomeIcon icon={alphaApproved ? faTimes : faCheck} />
                                    <span>{alphaApproved ? 'RETRACT ALPHA APPROVAL' : 'APPROVE SQUAD BATTLE (ALPHA)'}</span>
                                </button>
                            )}

                            {isBetaCaptain && (
                                <button
                                    className={`btn-squad-approve-glow ${betaApproved ? 'retract' : 'approve'}`}
                                    onClick={handleToggleSquadApproval}
                                    disabled={starting}
                                >
                                    <FontAwesomeIcon icon={betaApproved ? faTimes : faCheck} />
                                    <span>{betaApproved ? 'RETRACT BETA APPROVAL' : 'APPROVE SQUAD BATTLE (BETA)'}</span>
                                </button>
                            )}

                            {!isAlphaCaptain && !isBetaCaptain && (
                                <div style={{ padding: '12px 20px', background: 'rgba(0,0,0,0.4)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <FontAwesomeIcon icon={faHourglassHalf} />
                                    <span>Waiting for Alpha and Beta Captains to approve battle...</span>
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            {isHost && isHostViewer ? (
                                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                    <span
                                        style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "6px",
                                            padding: "10px 16px",
                                            borderRadius: "8px",
                                            background: "rgba(168, 85, 247, 0.18)",
                                            border: "1px solid #a855f7",
                                            color: "#d8b4fe",
                                            fontWeight: 800,
                                            fontSize: "0.85rem",
                                            letterSpacing: "0.03em"
                                        }}
                                    >
                                        <FontAwesomeIcon icon={faEye} /> HOST: PROCTOR / SPECTATOR
                                    </span>
                                    <button
                                        type="button"
                                        className="btn-hud-switch-role"
                                        onClick={handleToggleHostRole}
                                        disabled={starting}
                                        style={{
                                            padding: "10px 14px",
                                            borderRadius: "8px",
                                            background: "rgba(56, 189, 248, 0.12)",
                                            border: "1px solid #38bdf8",
                                            color: "#38bdf8",
                                            fontWeight: 700,
                                            fontSize: "0.82rem",
                                            cursor: "pointer"
                                        }}
                                        title="Switch to active competitor role"
                                    >
                                        Switch to Competitor ⚔️
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <button
                                        className={`btn-hud-ready ${isReady ? "is-ready" : ""}`}
                                        onClick={handleToggleReady}
                                        disabled={starting}
                                    >
                                        <FontAwesomeIcon icon={faCheckCircle} /> {isReady ? "SET AS NOT READY" : "READY UP"}
                                    </button>
                                    {isHost && (
                                        <button
                                            type="button"
                                            className="btn-hud-switch-role"
                                            onClick={handleToggleHostRole}
                                            disabled={starting}
                                            style={{
                                                padding: "10px 14px",
                                                borderRadius: "8px",
                                                background: "rgba(168, 85, 247, 0.12)",
                                                border: "1px solid #a855f7",
                                                color: "#c084fc",
                                                fontWeight: 700,
                                                fontSize: "0.82rem",
                                                cursor: "pointer"
                                            }}
                                            title="Switch to Spectator/Supervisor (free up your slot for other players)"
                                        >
                                            <FontAwesomeIcon icon={faEye} style={{ marginRight: "6px" }} />
                                            Switch to Spectator
                                        </button>
                                    )}
                                </>
                            )}

                            {isHost && (
                                <button
                                    className="btn-hud-launch"
                                    onClick={handleStartBattle}
                                    disabled={starting || participants.length < 2}
                                    title={participants.length < 2 ? "Waiting for at least 2 participants" : `Launch match with ${readyCount}/${participants.length} ready`}
                                >
                                    <FontAwesomeIcon icon={faPlay} />
                                    {starting ? "LAUNCHING..." : `START BATTLE (${readyCount}/${participants.length} Ready)`}
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
