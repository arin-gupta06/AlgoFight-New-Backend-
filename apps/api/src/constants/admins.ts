// apps/api/src/constants/admins.ts

export const ADMIN_EMAILS: string[] = [
    "vivekchaurasiya943@gmail.com",
    "aringupta2244@gmail.com",
    "dargarkrish@gmail.com",
];

export function isAdminEmail(email?: string | null): boolean {
    if (!email) return false;
    return ADMIN_EMAILS.includes(String(email).toLowerCase().trim());
}
