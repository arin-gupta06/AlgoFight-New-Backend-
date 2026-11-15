// apps/api/src/controllers/user.controller.ts
import { PrismaUserRepository, prisma } from "@algofight/database";
import { defaultStudentIdentityService, parseInstitutionalName } from "@algofight/institutional-identity";
import { isAdminEmail } from "../constants/admins";

export interface SyncUserPayload {
    id?: string;
    uid?: string;
    email: string;
    username?: string;
    displayName?: string;
    photoURL?: string;
    originalPhotoURL?: string;
    avatarFrame?: string;
    githubUrl?: string;
    linkedinUrl?: string;
    userType?: "STUDENT" | "FACULTY" | "INDIVIDUAL";
    institutionName?: string;
    institutionId?: string;
    institutionDomain?: string;
    department?: string;
    branch?: string;
    batchYear?: string;
    admissionYear?: number;
    enrollmentNumber?: string;
    studentIdentityMetadata?: any;
    school?: string;
    designation?: string;
    themePreference?: string;
}

export class UserController {
    constructor(private readonly userRepository: PrismaUserRepository = new PrismaUserRepository()) { }

    private async enrichUserMetrics(user: any) {
        if (!user || !user.id) return {};
        try {
            const [practiceData, ratingHistories, acceptedSubmissions] = await Promise.all([
                this.userRepository.getPracticeProgress(user.id).catch(() => ({
                    practiceSubmissionCount: 0,
                    practiceSolvedProblemIds: [] as string[],
                })),
                prisma.ratingHistory.findMany({
                    where: { userId: user.id },
                    select: { ratingBefore: true, ratingAfter: true, ratingDelta: true, createdAt: true },
                    orderBy: { createdAt: "asc" },
                    take: 20,
                }).catch(() => []),
                prisma.submission.findMany({
                    where: { 
                        userId: user.id,
                        verdict: "ACCEPTED",
                    },
                    select: { createdAt: true, problemId: true },
                    orderBy: { createdAt: "desc" },
                    take: 500,
                }).catch(() => []),
            ]);

            const practiceSolvedCount = practiceData.practiceSolvedProblemIds.length;
            const practiceSubmissionCount = practiceData.practiceSubmissionCount;
            const totalSubmissions = Math.max(practiceSubmissionCount, user.totalSubmissions || 0);

            // Timezone helper for Asia/Kolkata (IST = UTC+5:30)
            const getISTDateString = (d: Date | string = new Date()): string => {
                const dateObj = typeof d === "string" ? new Date(d) : d;
                return new Intl.DateTimeFormat("en-CA", {
                    timeZone: "Asia/Kolkata",
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                }).format(dateObj);
            };

            const getShiftedISTDate = (baseDateStr: string, dayDelta: number): string => {
                const [y, m, d] = baseDateStr.split("-").map(Number);
                const utcDate = new Date(Date.UTC(y, m - 1, d));
                utcDate.setUTCDate(utcDate.getUTCDate() + dayDelta);
                return utcDate.toISOString().split("T")[0];
            };

            const now = new Date();
            const todayIST = getISTDateString(now);
            const yesterdayIST = getShiftedISTDate(todayIST, -1);

            // Collect unique solved dates in IST
            const solvedDatesSet = new Set<string>();
            let todaySolvedCount = 0;

            for (const sub of acceptedSubmissions) {
                const dateStr = getISTDateString(sub.createdAt);
                solvedDatesSet.add(dateStr);
                if (dateStr === todayIST) {
                    todaySolvedCount++;
                }
            }

            const solvedToday = solvedDatesSet.has(todayIST);
            let currentStreak = 0;

            if (solvedToday) {
                currentStreak = 1;
                let checkDate = yesterdayIST;
                while (solvedDatesSet.has(checkDate)) {
                    currentStreak++;
                    checkDate = getShiftedISTDate(checkDate, -1);
                }
            } else if (solvedDatesSet.has(yesterdayIST)) {
                // Streak is preserved from yesterday until 12:00 AM IST tonight
                currentStreak = 1;
                let checkDate = getShiftedISTDate(yesterdayIST, -1);
                while (solvedDatesSet.has(checkDate)) {
                    currentStreak++;
                    checkDate = getShiftedISTDate(checkDate, -1);
                }
            } else {
                currentStreak = 0;
            }

            // Calculate historical longest streak
            let longestStreak = currentStreak;
            const sortedDates = Array.from(solvedDatesSet).sort();
            if (sortedDates.length > 0) {
                let tempStreak = 1;
                for (let i = 1; i < sortedDates.length; i++) {
                    const expectedNext = getShiftedISTDate(sortedDates[i - 1], 1);
                    if (sortedDates[i] === expectedNext) {
                        tempStreak++;
                    } else {
                        tempStreak = 1;
                    }
                    if (tempStreak > longestStreak) {
                        longestStreak = tempStreak;
                    }
                }
            }

            // 7-day rolling window in IST (last 7 days ending with today)
            const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
            const streakDates = [];
            for (let offset = -6; offset <= 0; offset++) {
                const dStr = getShiftedISTDate(todayIST, offset);
                const [y, m, d] = dStr.split("-").map(Number);
                const dt = new Date(Date.UTC(y, m - 1, d));
                const dayLabel = DAY_NAMES[dt.getUTCDay()];
                streakDates.push({
                    date: dStr,
                    dayLabel,
                    isToday: dStr === todayIST,
                    solved: solvedDatesSet.has(dStr),
                });
            }

            const latestDelta = ratingHistories.length > 0 ? (ratingHistories[ratingHistories.length - 1] as any).ratingDelta : 0;
            const formattedRatingHistories = ratingHistories.map((r: any) => ({
                ...r,
                ratingBefore: r.ratingBefore,
                ratingAfter: r.ratingAfter,
                ratingDelta: r.ratingDelta,
                oldRating: r.ratingBefore,
                newRating: r.ratingAfter,
                delta: r.ratingDelta,
                createdAt: r.createdAt,
            }));

            return {
                practiceSolvedProblemIds: practiceData.practiceSolvedProblemIds,
                practiceSolvedCount,
                practiceSubmissionCount,
                totalSubmissions,
                ratingHistory: formattedRatingHistories,
                ratingDelta: latestDelta,
                currentStreak,
                longestStreak,
                solvedToday,
                todaySolvedCount,
                streakDates,
            };
        } catch {
            return {
                practiceSolvedProblemIds: [],
                practiceSolvedCount: 0,
                practiceSubmissionCount: 0,
                totalSubmissions: user.totalSubmissions || 0,
                ratingHistory: [],
                ratingDelta: 0,
                currentStreak: 0,
                longestStreak: 0,
                solvedToday: false,
                todaySolvedCount: 0,
                streakDates: [],
            };
        }
    }

    async syncUser(payload: SyncUserPayload) {
        const userId = payload.id || payload.uid;
        const email = payload.email || `${userId}@algofight.local`;
        const cleanEmail = email.trim().toLowerCase();
        const parsedName = parseInstitutionalName(payload.displayName || payload.username, cleanEmail);

        // Fetch existing user to preserve reward unlocks and original photo
        const existingUser = userId ? await this.userRepository.getUserById(userId) : null;
        const existingMeta = (existingUser?.studentIdentityMetadata as any) || {};

        let username = payload.username;
        if (!username || parseInstitutionalName(username).hasEnrollmentPrefix) {
            username = parsedName.cleanUsernameBase || payload.displayName || cleanEmail.split("@")[0];
        }

        let userType = payload.userType || "INDIVIDUAL";
        let institutionName = payload.institutionName;
        let institutionId = payload.institutionId;
        let institutionDomain = payload.institutionDomain;
        let department = payload.department;
        let branch = payload.branch;
        let admissionYear = payload.admissionYear;
        let enrollmentNumber = payload.enrollmentNumber ? payload.enrollmentNumber.toUpperCase() : (parsedName.enrollmentNumber ? parsedName.enrollmentNumber.toUpperCase() : undefined);
        let studentIdentityMetadata = payload.studentIdentityMetadata;

        const isFacultyEmail = cleanEmail.endsWith("@mitsgwalior.in") ||
                               cleanEmail.endsWith(".mitsgwalior.in") ||
                               cleanEmail.includes("mitsgwalior.in");

        if (isFacultyEmail) {
            userType = "FACULTY";
            institutionName = institutionName || "Madhav Institute of Technology & Science";
            institutionId = institutionId || "mits-gwalior";
            institutionDomain = institutionDomain || "mitsgwalior.in";
            department = department || payload.department || "School of Computer Science & Engineering";
        }

        // Unified automatic institutional identity pipeline
        // If not already resolved and not a faculty email, check if verified email matches an institutional domain (e.g. mitsgwl.ac.in)
        if (!isFacultyEmail && !institutionId && email.includes("@")) {
            try {
                const resolution = defaultStudentIdentityService.resolveFromEmail(email);
                if (resolution.isInstitutional) {
                    userType = "STUDENT";
                    institutionName = resolution.institute.name;
                    institutionId = resolution.institute.id;
                    institutionDomain = resolution.institute.domain;
                    department = resolution.identity.department || resolution.identity.branchName;
                    branch = resolution.identity.branch;
                    admissionYear = resolution.identity.admissionYear;
                    enrollmentNumber = enrollmentNumber || (resolution.identity.enrollmentNumber ? resolution.identity.enrollmentNumber.toUpperCase() : undefined);
                    studentIdentityMetadata = resolution.identity.instituteSpecificIdentifiers;
                }
            } catch {
                // If institutional email parsing fails, fallback to normal account flow without crashing
            }
        }

        const incomingMeta = (payload.studentIdentityMetadata && typeof payload.studentIdentityMetadata === 'object')
            ? payload.studentIdentityMetadata
            : {};

        studentIdentityMetadata = {
            ...existingMeta,
            ...incomingMeta,
            ...(typeof studentIdentityMetadata === 'object' && studentIdentityMetadata !== null ? studentIdentityMetadata : {}),
            ...(payload.school ? { school: payload.school.trim() } : {}),
            ...(payload.designation ? { designation: payload.designation.trim() } : {}),
            ...(department ? { department: department.trim() } : {}),
            ...(payload.photoURL !== undefined ? { photoURL: payload.photoURL } : {}),
            ...(payload.avatarFrame !== undefined ? { avatarFrame: payload.avatarFrame } : {}),
            ...(payload.themePreference !== undefined ? { themePreference: payload.themePreference } : {}),
        };

        if (payload.originalPhotoURL && payload.originalPhotoURL.startsWith('http')) {
            studentIdentityMetadata.originalPhotoURL = payload.originalPhotoURL;
        } else if (!studentIdentityMetadata.originalPhotoURL) {
            if (existingMeta.originalPhotoURL) {
                studentIdentityMetadata.originalPhotoURL = existingMeta.originalPhotoURL;
            } else if (payload.photoURL && payload.photoURL.startsWith('http') && !payload.photoURL.includes('/avatars/')) {
                studentIdentityMetadata.originalPhotoURL = payload.photoURL;
            }
        }

        const user = await this.userRepository.upsertUser({
            id: userId,
            email: email,
            username,
            githubUrl: payload.githubUrl,
            linkedinUrl: payload.linkedinUrl,
            userType,
            institutionName: institutionName || null,
            institutionId: institutionId || null,
            institutionDomain: institutionDomain || null,
            department: department || null,
            school: payload.school || null,
            designation: payload.designation || null,
            branch: branch || null,
            admissionYear: admissionYear || null,
            enrollmentNumber: enrollmentNumber || null,
            studentIdentityMetadata: studentIdentityMetadata || null,
        });

        // Compute dynamic academic profile on the fly (never permanently stored)
        let academicProfile = null;
        if (user.admissionYear) {
            academicProfile = defaultStudentIdentityService.calculateDynamicProfile(
                user.institutionId || "mits-gwalior",
                user.admissionYear
            );
        }

        const metrics = await this.enrichUserMetrics(user);
        const syncMeta = (user.studentIdentityMetadata as any) || {};
        return {
            ...user,
            enrollmentNumber: user.enrollmentNumber ? user.enrollmentNumber.toUpperCase() : null,
            school: user.school || syncMeta.school || null,
            designation: user.designation || syncMeta.designation || (user.userType === "FACULTY" ? "Faculty Educator" : null),
            photoURL: (user as any).photoURL || syncMeta.photoURL || payload.photoURL || null,
            avatarFrame: (user as any).avatarFrame || syncMeta.avatarFrame || payload.avatarFrame || null,
            originalPhotoURL: syncMeta.originalPhotoURL || payload.originalPhotoURL || null,
            unlockedAvatars: Array.isArray(syncMeta.unlockedAvatars) ? syncMeta.unlockedAvatars : [],
            unlockedFrames: Array.isArray(syncMeta.unlockedFrames) ? syncMeta.unlockedFrames : [],
            unlockedThemes: Array.isArray(syncMeta.unlockedThemes) ? syncMeta.unlockedThemes : [],
            themePreference: syncMeta.themePreference || payload.themePreference || null,
            academicProfile,
            matchesWon: user.wins,
            matchesPlayed: user.wins + user.losses,
            lossCount: user.losses,
            ...metrics,
        };
    }

    async updateFacultyProfile(userId: string, data: { school: string; department?: string; designation: string; institutionName?: string }) {
        const user = await this.userRepository.getUserById(userId);
        if (!user) {
            throw { statusCode: 404, message: "Faculty user not found." };
        }

        const existingMeta = (user.studentIdentityMetadata as any) || {};
        const cleanSchool = data.school ? data.school.trim() : existingMeta.school || "";
        const cleanDept = data.department !== undefined ? (data.department ? data.department.trim() : null) : (existingMeta.department || user.department || null);
        const cleanDesignation = data.designation ? data.designation.trim() : existingMeta.designation || "Faculty Educator";

        const updatedMeta = {
            ...existingMeta,
            school: cleanSchool,
            department: cleanDept,
            designation: cleanDesignation,
        };

        const updated = await this.userRepository.upsertUser({
            id: user.id,
            email: user.email,
            username: user.username,
            userType: "FACULTY",
            institutionName: data.institutionName || user.institutionName || "Madhav Institute of Technology & Science",
            department: cleanDept || cleanSchool,
            school: cleanSchool,
            designation: cleanDesignation,
            studentIdentityMetadata: updatedMeta,
        });

        return {
            ...updated,
            school: cleanSchool,
            department: cleanDept,
            designation: cleanDesignation,
        };
    }

    async getUserById(id: string, authUser?: any) {
        let user = await this.userRepository.getUserById(id);
        if (!user && authUser?.email) {
            user = await this.userRepository.getUserById(authUser.email);
        }
        if (!user && authUser?.id) {
            user = await this.userRepository.getUserById(authUser.id);
        }
        if (!user) return null;

        const isSelf = Boolean(
            authUser &&
            (authUser.id === user.id ||
             (authUser.email && user.email && authUser.email.toLowerCase() === user.email.toLowerCase()))
        );
        const isAdmin = Boolean(
            authUser &&
            (authUser.role === "ADMIN" ||
             isAdminEmail(authUser.email) ||
             authUser.isAdmin)
        );

        // Dynamically compute current academic status if institutional identity exists
        let academicProfile = null;
        if (user.admissionYear) {
            academicProfile = defaultStudentIdentityService.calculateDynamicProfile(
                user.institutionId || "mits-gwalior",
                user.admissionYear
            );
        }

        // Enrich institutional identity fields from email if available
        if (user.email && user.email.includes("@")) {
            try {
                const resolution = defaultStudentIdentityService.resolveFromEmail(user.email);
                if (resolution.isInstitutional) {
                    user.institutionName = user.institutionName || resolution.institute.name;
                    user.institutionId = user.institutionId || resolution.institute.id;
                    user.institutionDomain = user.institutionDomain || resolution.institute.domain;
                    user.department = user.department || resolution.identity.department || resolution.identity.branchName;
                    user.branch = user.branch || resolution.identity.branch;
                    user.admissionYear = user.admissionYear || resolution.identity.admissionYear;
                    user.enrollmentNumber = user.enrollmentNumber ? user.enrollmentNumber.toUpperCase() : (resolution.identity.enrollmentNumber ? resolution.identity.enrollmentNumber.toUpperCase() : null);
                    if (!academicProfile) {
                        academicProfile = resolution.academicProfile || defaultStudentIdentityService.calculateDynamicProfile(
                            resolution.institute.id || "mits-gwalior",
                            resolution.identity.admissionYear
                        );
                    }
                }
            } catch {
                // Non-institutional
            }
        }

        const metrics = await this.enrichUserMetrics(user);
        const userMeta = (user.studentIdentityMetadata as any) || {};

        // 🔐 Public combatant profile (Safe for all authenticated users to view)
        const baseProfile = {
            id: user.id,
            username: user.username,
            displayName: (user as any).displayName || user.username,
            photoURL: (user as any).photoURL || userMeta.photoURL || null,
            avatarFrame: (user as any).avatarFrame || userMeta.avatarFrame || null,
            originalPhotoURL: userMeta.originalPhotoURL || (userMeta.photoURL && userMeta.photoURL.startsWith('http') && !userMeta.photoURL.includes('/avatars/') ? userMeta.photoURL : null) || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.username || user.id)}`,
            userType: user.userType,
            institutionName: user.institutionName,
            institutionDomain: user.institutionDomain,
            department: user.department,
            school: user.school || userMeta.school || null,
            designation: user.designation || userMeta.designation || (user.userType === "FACULTY" ? "Faculty Educator" : null),
            branch: user.branch,
            batchYear: user.batchYear,
            rating: user.rating,
            highestRating: user.highestRating,
            highestRank: user.highestRank,
            wins: user.wins,
            losses: user.losses,
            matchesWon: user.wins,
            matchesPlayed: user.wins + user.losses,
            lossCount: user.losses,
            academicProfile,
            githubUrl: user.githubUrl || null,
            linkedinUrl: user.linkedinUrl || null,
            unlockedAvatars: Array.isArray(userMeta.unlockedAvatars) ? userMeta.unlockedAvatars : [],
            unlockedFrames: Array.isArray(userMeta.unlockedFrames) ? userMeta.unlockedFrames : [],
            unlockedThemes: Array.isArray(userMeta.unlockedThemes) ? userMeta.unlockedThemes : [],
            themePreference: userMeta.themePreference || null,
            createdAt: user.createdAt,
            ...metrics,
        };

        // 🔐 STRICT SECURITY PROJECTION:
        // NEVER expose passwordHash, googleSub under ANY circumstances.
        // Private fields (email, arenaPoints, enrollmentNumber, platformCode, claimedRewards) ONLY returned to the owner or SuperAdmin.
        if (isSelf || isAdmin) {
            return {
                ...baseProfile,
                email: user.email,
                arenaPoints: (user as any).arenaPoints ?? 0,
                platformCode: user.platformCode || null,
                enrollmentNumber: user.enrollmentNumber ? user.enrollmentNumber.toUpperCase() : null,
                claimedRewards: Array.isArray(userMeta.claimedRewards) ? userMeta.claimedRewards : [],
            };
        }

        // Return only safe public gamertag profile
        return baseProfile;
    }

    async updateThemePreference(userId: string, themeId: string) {
        const user = await this.userRepository.getUserById(userId);
        if (!user) {
            throw { statusCode: 404, message: "User not found." };
        }
        const existingMeta = (user.studentIdentityMetadata as any) || {};
        const updatedMeta = { ...existingMeta, themePreference: themeId };
        await this.userRepository.upsertUser({
            id: userId,
            email: user.email,
            username: user.username,
            studentIdentityMetadata: updatedMeta,
        });
        return { success: true, themePreference: themeId };
    }

    async getAvailablePlayers(excludeUserId?: string, limit?: number, search?: string) {
        const users = await this.userRepository.getAvailablePlayers(excludeUserId, limit, search);
        return users.map((u) => {
            const matchesPlayed = u.wins + u.losses;
            const winRate = matchesPlayed > 0 ? Math.round((u.wins / matchesPlayed) * 100) : 0;
            const userMeta = (u.studentIdentityMetadata as any) || {};
            // 🔐 Zero PII returned: Emails, PlatformCodes, and Enrollment Numbers are stripped
            return {
                id: u.id,
                username: u.username,
                userType: u.userType,
                institutionName: u.institutionName,
                department: u.department,
                rating: u.rating,
                wins: u.wins,
                losses: u.losses,
                matchesWon: u.wins,
                matchesPlayed,
                winRate,
                photoURL: (u as any).photoURL || userMeta.photoURL || null,
                avatarFrame: (u as any).avatarFrame || userMeta.avatarFrame || null,
                status: "OFFLINE",
                createdAt: u.createdAt,
            };
        });
    }

    async getLeaderboard() {
        const users = await this.userRepository.getTopUsers(50);
        return users.map((u, index) => {
            const userMeta = (u.studentIdentityMetadata as any) || {};
            return {
                rank: index + 1,
                user: u.username,
                score: u.rating,
                wins: u.wins,
                losses: u.losses,
                photoURL: (u as any).photoURL || userMeta.photoURL || null,
                avatarFrame: (u as any).avatarFrame || userMeta.avatarFrame || null,
                trend: "same",
            };
        });
    }

    async getPlatformStats() {
        try {
            const count = await this.userRepository.countUsers();
            return {
                totalCoders: count,
                displayCount: count >= 100 ? `${count}+` : String(count),
            };
        } catch {
            return {
                totalCoders: 100,
                displayCount: "100+",
            };
        }
    }
}
