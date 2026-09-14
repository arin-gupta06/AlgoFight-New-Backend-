import React, { createContext, useContext, useState, useEffect } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebaseConfig";
import { syncUserToBackend } from "../services/api";
import { useUserStore } from "../store/useUserStore";
import { unifiedAnalytics } from "../services/analytics";

const AuthContext = createContext(null);

function isAuthTokenError(error) {
  const message = String(error?.message || "");
  return /Invalid or expired auth token|Authentication required/i.test(message);
}

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const setGlobalUser = useUserStore((state) => state.setUser);
  const clearGlobalUser = useUserStore((state) => state.clearUser);
  const setGlobalProfileData = useUserStore((state) => state.setProfileData);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        unifiedAnalytics.setUserId(firebaseUser.uid);
        // Sync to backend on every auth state change
        const syncPayload = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName || "New Player",
          photoURL: firebaseUser.photoURL,
        };

        try {
          const authToken = await firebaseUser.getIdToken();
          const synced = await syncUserToBackend({ ...syncPayload, authToken });
          if (synced) {
            setProfileData(synced);
            setGlobalProfileData(synced);
          }
        } catch (err) {
          if (isAuthTokenError(err)) {
            try {
              // Force refresh and retry once to handle stale token snapshots.
              const refreshedToken = await firebaseUser.getIdToken(true);
              const synced = await syncUserToBackend({ ...syncPayload, authToken: refreshedToken });
              if (synced) {
                setProfileData(synced);
                setGlobalProfileData(synced);
              }
            } catch (retryError) {
              console.error("Failed to sync user to backend after retry:", retryError);
            }
          } else {
            console.error("Failed to sync user to backend:", err);
          }
        }
        setUser(firebaseUser);
        setGlobalUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          accessToken: firebaseUser.accessToken
        });
      } else {
        unifiedAnalytics.setUserId(null);
        setUser(null);
        setProfileData(null);
        setGlobalProfileData(null);
        clearGlobalUser();
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setProfileData(null);
    setGlobalProfileData(null);
    clearGlobalUser();
  };

  const value = { user, profileData, setProfileData, loading, logout };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
