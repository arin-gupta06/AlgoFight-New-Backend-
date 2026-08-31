// frontend/src/constants/admins.js

export const ADMIN_EMAILS = [
  'vivekchaurasiya943@gmail.com',
  'aringupta2244@gmail.com'
];

export function isAdminUser(user) {
  if (!user || !user.email) return false;
  return ADMIN_EMAILS.includes(String(user.email).toLowerCase().trim());
}
