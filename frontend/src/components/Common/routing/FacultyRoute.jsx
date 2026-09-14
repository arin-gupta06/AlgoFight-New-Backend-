import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../../contexts/AuthContext";
import { isAdminUser } from "../../../constants/admins";

export default function FacultyRoute({ children }) {
  const { user, profileData, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          color: "#00e5ff",
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: "1.1rem",
        }}
      >
        Verifying Faculty Clearance...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  const isFacultyOrAdmin = Boolean(
    isAdminUser(user) || profileData?.userType === "FACULTY"
  );

  if (!isFacultyOrAdmin) {
    return <Navigate to="/home" replace />;
  }

  return children;
}
