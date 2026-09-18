import React, { createContext, useContext, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { useUserStore } from "../store/useUserStore";
import { useGameStore } from "../store/useGameStore";
import { useGlobalStore } from "../store/useGlobalStore";
import { getSocket, connectSocket, disconnectSocket } from "../services/socket";

export const SocketContext = createContext(null);

const INACTIVE_SOCKET_ROUTES = new Set([
  "/",
  "/login",
  "/signup",
  "/about",
  "/blog",
  "/careers",
  "/help",
  "/contact",
  "/developer",
  "/terms",
  "/privacy",
  "/cookies",
]);

function shouldConnectSocket(pathname) {
  if (INACTIVE_SOCKET_ROUTES.has(pathname)) return false;
  if (
    pathname.startsWith("/about") ||
    pathname.startsWith("/blog") ||
    pathname.startsWith("/terms") ||
    pathname.startsWith("/privacy") ||
    pathname.startsWith("/cookies")
  ) {
    return false;
  }
  return true;
}

export function SocketProvider({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  // Zustand Store integrations
  const setMatchState = useGameStore((state) => state.setMatchState);
  const setLeaderboard = useGlobalStore((state) => state.setLeaderboard);
  const setProfileData = useUserStore((state) => state.setProfileData);

  const userId = user?.uid;
  const username = user?.displayName || user?.email?.split("@")[0] || "Player";
  const shouldConnect = Boolean(userId) && shouldConnectSocket(location.pathname);

  useEffect(() => {
    if (loading) return;

    if (!shouldConnect) {
      disconnectSocket();
      return;
    }

    const socketClient = getSocket();

    // Handlers
    const handleProfileUpdate = (data) => setProfileData(data?.payload || data);
    const handleLeaderboardUpdate = (data) => setLeaderboard(data?.payload || data);
    const handleMatchFound = (data) => {
      const roomCode = data?.roomCode || data?.roomId;
      setMatchState({
        matchId: roomCode,
        opponent: data?.players?.find((p) => p !== username) || "Opponent",
        matchStatus: "found",
        problems: data?.problems,
        timeLimitSeconds: data?.timeLimitSeconds,
      });

      // Issue 3: Authoritative navigation ensures BOTH challenged & challenger transition into Battle Workspace
      if (roomCode && !location.pathname.startsWith(`/battle/live/${roomCode}`)) {
        navigate(`/battle/live/${roomCode}`, { state: { matchData: data } });
      }
    };
    const handleMatchStarted = () => setMatchState({ matchStatus: "in-progress" });
    const handleBattleStateSync = (data) => setMatchState({ battleStats: data });

    socketClient.on("profile_update", handleProfileUpdate);
    socketClient.on("leaderboard_update", handleLeaderboardUpdate);
    socketClient.on("match_found", handleMatchFound);
    socketClient.on("battle_started", handleMatchStarted);
    socketClient.on("match_started", handleMatchStarted);
    socketClient.on("battle_state_sync", handleBattleStateSync);
    socketClient.on("battle_stats_update", handleBattleStateSync);

    // Connect with user credentials and token if available
    let active = true;
    (async () => {
      try {
        const token = user?.getIdToken ? await user.getIdToken() : null;
        if (active) {
          connectSocket(token, userId, username);
        }
      } catch {
        if (active) {
          connectSocket(null, userId, username);
        }
      }
    })();

    return () => {
      active = false;
      socketClient.off("profile_update", handleProfileUpdate);
      socketClient.off("leaderboard_update", handleLeaderboardUpdate);
      socketClient.off("match_found", handleMatchFound);
      socketClient.off("battle_started", handleMatchStarted);
      socketClient.off("match_started", handleMatchStarted);
      socketClient.off("battle_state_sync", handleBattleStateSync);
      socketClient.off("battle_stats_update", handleBattleStateSync);
    };
  }, [userId, username, loading, shouldConnect, setMatchState, setLeaderboard, setProfileData, navigate, location.pathname]);

  const socketWrapper = useMemo(() => {
    const socketClient = getSocket();
    return {
      emit: (action, data) => socketClient.emit(action, data),
      send: (action, data) => socketClient.emit(action, data),
      disconnect: () => disconnectSocket(),
      on: (event, cb) => socketClient.on(event, cb),
      off: (event, cb) => socketClient.off(event, cb),
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket: socketWrapper }}>
      {children}
    </SocketContext.Provider>
  );
}
