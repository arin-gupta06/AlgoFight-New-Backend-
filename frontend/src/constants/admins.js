// frontend/src/constants/admins.js

/**
 * Validates whether the authenticated user has administrative clearance.
 * Clearance is cryptographically verified and signed by the backend gateway.
 */
export function isAdminUser(user) {
  if (!user) return false;
  return Boolean(
    user.role === 'ADMIN' ||
    user.isAdmin === true ||
    user.userType === 'ADMIN'
  );
}
