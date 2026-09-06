// packages/institutional-identity/src/institutes/mits/mits.constants.ts

export const MITS_DOMAIN = "mitsgwl.ac.in";
export const MITS_INSTITUTE_ID = "mits-gwalior";
export const MITS_INSTITUTE_NAME = "MITS Gwalior";

export const MITS_BRANCH_MAP: Record<string, string> = {
    ai: "Artificial Intelligence",
    cs: "Computer Science & Engineering",
    it: "Information Technology",
    ec: "Electronics & Communication Engineering",
    ee: "Electrical Engineering",
    me: "Mechanical Engineering",
    ce: "Civil Engineering",
    cd: "Computer Science & Design",
    iot: "Internet of Things",
    ch: "Chemical Engineering",
    bt: "Biotechnology",
    auto: "Automobile Engineering",
    mac: "Mathematics & Computing",
    et: "Electronics & Telecommunication",
    ds: "Data Science",
};

/**
 * Regex for standard MITS student email local-part:
 * Example: 24ai10ar16
 * - Group 1: 2 digits for batch year (e.g. 24 -> 2024)
 * - Group 2: letters for branch code (e.g. ai, cs, it, auto, mac)
 * - Group 3: digits for sequence/group code (e.g. 10)
 * - Group 4: letters for name identifier component (e.g. ar)
 * - Group 5: digits for roll/enrollment component (e.g. 16)
 */
export const MITS_STUDENT_EMAIL_REGEX = /^(\d{2})([a-z]{2,5})(\d{1,3})([a-z]{1,4})(\d{1,4})$/i;
