// packages/institutional-identity/src/institutes/mits/mits.constants.ts

export const MITS_DOMAIN = "mitsgwl.ac.in";
export const MITS_INSTITUTE_ID = "mits-gwalior";
export const MITS_INSTITUTE_NAME = "MITS Gwalior";

export interface MitsAcademicInfo {
    branch: string;
    department: string;
    programme: string;
}

export const MITS_ACADEMIC_MAP: Record<string, MitsAcademicInfo> = {
    mup: {
        branch: "Urban Planning",
        department: "School of Architecture",
        programme: "MUP",
    },
    ar: {
        branch: "Bachelor of Architecture",
        department: "School of Architecture",
        programme: "B.Arch",
    },
    ad: {
        branch: "Artificial Intelligence (AI) and Data Science",
        department: "Centre for Artificial Intelligence",
        programme: "B.Tech",
    },
    am: {
        branch: "Artificial Intelligence and Machine Learning",
        department: "Centre for Artificial Intelligence",
        programme: "B.Tech",
    },
    ai: {
        branch: "Artificial Intelligence(AI)",
        department: "Centre for Artificial Intelligence",
        programme: "B.Tech",
    },
    ml: {
        branch: "Artificial Intelligence and Machine Learning",
        department: "Centre for Artificial Intelligence",
        programme: "B.Tech",
    },
    mb: {
        branch: "MBA",
        department: "School of Humanities and Management",
        programme: "MBA",
    },
    mba: {
        branch: "MBA",
        department: "School of Humanities and Management",
        programme: "MBA",
    },
    cb: {
        branch: "Computer Science and Business Systems",
        department: "Centre for Computer Science and Technology",
        programme: "B.Tech",
    },
    ct: {
        branch: "Computer science and Technology",
        department: "Centre for Computer Science and Technology",
        programme: "B.Tech",
    },
    cd: {
        branch: "Computer Science and Design",
        department: "Computer Science & Design",
        programme: "B.Tech",
    },
    cs: {
        branch: "Computer Science and Engineering",
        department: "School of Computer Science & Engineering",
        programme: "B.Tech",
    },
    mtcs: {
        branch: "Computer Science and Engineering",
        department: "School of Computer Science & Engineering",
        programme: "M.Tech",
    },
    ca: {
        branch: "MCA",
        department: "School of Engineering Mathematics & Computing",
        programme: "MCA",
    },
    pdce: {
        branch: "PhD Computer Science & Engineering",
        department: "School of Computer Science & Engineering",
        programme: "Ph.D",
    },
    eo: {
        branch: "EE (Internet of Things)",
        department: "Centre for Internet of Things",
        programme: "B.Tech",
    },
    ec: {
        branch: "Electrical and Computer Engineering",
        department: "Centre for Internet of Things",
        programme: "B.Tech",
    },
    io: {
        branch: "IT (Internet of Things (IoT))",
        department: "Centre for Internet of Things",
        programme: "B.Tech",
    },
    cm: {
        branch: "Chemical Engineering",
        department: "School of Chemical Engineering",
        programme: "B.Tech",
    },
    ce: {
        branch: "Civil Engineering",
        department: "School of Civil Engineering",
        programme: "B.Tech",
    },
    ctm: {
        branch: "Construction Technology & Management",
        department: "School of Civil Engineering",
        programme: "M.Tech",
    },
    mtctm: {
        branch: "Construction Technology & Management",
        department: "School of Civil Engineering",
        programme: "M.Tech",
    },
    en: {
        branch: "Environment Engineering",
        department: "School of Civil Engineering",
        programme: "M.Tech",
    },
    ee: {
        branch: "Electrical Engineering",
        department: "School of Electrical Engineering",
        programme: "B.Tech",
    },
    mtisd: {
        branch: "Industrial Systems & Drives",
        department: "School of Electrical Engineering",
        programme: "M.Tech",
    },
    et: {
        branch: "Electronics and Telecommunications",
        department: "School of Electronics and Communication Engineering",
        programme: "B.Tech",
    },
    el: {
        branch: "Electronics Engineering",
        department: "School of Electronics and Communication Engineering",
        programme: "B.Tech",
    },
    cn: {
        branch: "Communication Control and Networking",
        department: "School of Electronics and Communication Engineering",
        programme: "M.Tech",
    },
    it: {
        branch: "Information Technology",
        department: "School of Information Technology",
        programme: "B.Tech",
    },
    mtit: {
        branch: "Information Technology",
        department: "School of Information Technology",
        programme: "M.Tech",
    },
    ir: {
        branch: "IT (Artificial Intelligence and Robotics)",
        department: "Centre for Artificial Intelligence",
        programme: "B.Tech",
    },
    mc: {
        branch: "Mathematics and Computing",
        department: "School of Engineering Mathematics & Computing",
        programme: "B.Tech",
    },
    pdca: {
        branch: "PhD Computer Application",
        department: "School of Engineering Mathematics & Computing",
        programme: "Ph.D",
    },
    me: {
        branch: "Mechanical Engineering",
        department: "School of Mechanical Engineering",
        programme: "B.Tech",
    },
    pe: {
        branch: "Production Engineering",
        department: "School of Mechanical Engineering",
        programme: "M.Tech",
    },
    // Aliases for historical / alternative codes
    iot: {
        branch: "IT (Internet of Things (IoT))",
        department: "Centre for Internet of Things",
        programme: "B.Tech",
    },
    ch: {
        branch: "Chemical Engineering",
        department: "School of Chemical Engineering",
        programme: "B.Tech",
    },
    bt: {
        branch: "Biotechnology",
        department: "School of Chemical Engineering",
        programme: "B.Tech",
    },
    auto: {
        branch: "Automobile Engineering",
        department: "School of Mechanical Engineering",
        programme: "B.Tech",
    },
    mac: {
        branch: "Mathematics and Computing",
        department: "School of Engineering Mathematics & Computing",
        programme: "B.Tech",
    },
    ds: {
        branch: "Artificial Intelligence (AI) and Data Science",
        department: "Centre for Artificial Intelligence",
        programme: "B.Tech",
    },
};

export const MITS_BRANCH_MAP: Record<string, string> = Object.fromEntries(
    Object.entries(MITS_ACADEMIC_MAP).map(([code, info]) => [code, info.branch])
);

/**
 * Regex for standard MITS student email local-part:
 * Example: 24ai10ar16
 * - Group 1: 2 digits for batch year (e.g. 24 -> 2024)
 * - Group 2: letters for branch code (e.g. ai, cs, it, auto, mtcs, mtctm)
 * - Group 3: digits for sequence/group code (e.g. 10)
 * - Group 4: letters for name identifier component (e.g. ar)
 * - Group 5: digits for roll/enrollment component (e.g. 16)
 */
export const MITS_STUDENT_EMAIL_REGEX = /^(\d{2})([a-z]{2,6})(\d{1,3})([a-z]{1,4})(\d{1,4})$/i;
