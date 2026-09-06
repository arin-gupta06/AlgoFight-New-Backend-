// apps/api/src/controllers/user.controller.ts
import { PrismaUserRepository } from "@algofight/database";
import { defaultStudentIdentityService } from "@algofight/institutional-identity";

export interface SyncUserPayload {
    id?: string;
    uid?: string;
    email: string;
    username?: string;
    displayName?: string;
    githubUrl?: string;
    linkedinUrl?: string;
    userType?: "STUDENT" | "FACULTY" | "INDIVIDUAL";
    institutionName?: string;
    institutionId?: string;
    institutionDomain?: string;
    department?: string;
    branch?: string;
    admissionYear?: number;
    enrollmentNumber?: string;
    studentIdentityMetadata?: any;
}

export class UserController {
    constructor(private readonly userRepository: PrismaUserRepository = new PrismaUserRepository()) { }

    async syncUser(payload: SyncUserPayload) {
        const userId = payload.id || payload.uid;
        const email = payload.email || `${userId}@algofight.local`;
        const username = payload.displayName || payload.username || email.split("@")[0];

        let userType = payload.userType || "INDIVIDUAL";
        let institutionName = payload.institutionName;
        let institutionId = payload.institutionId;
        let institutionDomain = payload.institutionDomain;
        let department = payload.department;
        let branch = payload.branch;
        let admissionYear = payload.admissionYear;
        let enrollmentNumber = payload.enrollmentNumber;
        let studentIdentityMetadata = payload.studentIdentityMetadata;

        // Unified automatic institutional identity pipeline
        // If not already resolved, check if verified email matches an institutional domain (e.g. mitsgwl.ac.in)
        if (!institutionId && email.includes("@")) {
            try {
                const resolution = defaultStudentIdentityService.resolveFromEmail(email);
                if (resolution.isInstitutional) {
                    userType = "STUDENT";
                    institutionName = resolution.institute.name;
                    institutionId = resolution.institute.id;
                    institutionDomain = resolution.institute.domain;
                    department = resolution.identity.branchName;
                    branch = resolution.identity.branch;
                    admissionYear = resolution.identity.admissionYear;
                    enrollmentNumber = resolution.identity.enrollmentNumber;
                    studentIdentityMetadata = resolution.identity.instituteSpecificIdentifiers;
                }
            } catch {
                // If institutional email parsing fails, fallback to normal account flow without crashing
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

        return {
            ...user,
            academicProfile,
            matchesWon: user.wins,
            matchesPlayed: user.wins + user.losses,
            lossCount: user.losses,
            practiceSolvedProblemIds: [],
            practiceSolvedCount: 0,
            practiceSubmissionCount: 0,
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
                    user.department = user.department || resolution.identity.branchName;
                    user.branch = user.branch || resolution.identity.branch;
                    user.admissionYear = user.admissionYear || resolution.identity.admissionYear;
                    user.enrollmentNumber = user.enrollmentNumber || resolution.identity.enrollmentNumber;
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

        return {
            ...user,
            academicProfile,
            matchesWon: user.wins,
            matchesPlayed: user.wins + user.losses,
            lossCount: user.losses,
            practiceSolvedProblemIds: [],
            practiceSolvedCount: 0,
            practiceSubmissionCount: 0,
        };
    }

    async getAvailablePlayers(excludeUserId?: string, limit?: number, search?: string) {
        const users = await this.userRepository.getAvailablePlayers(excludeUserId, limit, search);
        return users.map((u) => {
            const matchesPlayed = u.wins + u.losses;
            const winRate = matchesPlayed > 0 ? Math.round((u.wins / matchesPlayed) * 100) : 0;
            return {
                id: u.id,
                username: u.username,
                email: u.email,
                platformCode: u.platformCode,
                userType: u.userType,
                institutionName: u.institutionName,
                department: u.department,
                rating: u.rating,
                wins: u.wins,
                losses: u.losses,
                matchesWon: u.wins,
                matchesPlayed,
                winRate,
                status: "OFFLINE",
                createdAt: u.createdAt,
            };
        });
    }

    async getLeaderboard() {
        const users = await this.userRepository.getTopUsers(50);
        return users.map((u, index) => ({
            rank: index + 1,
            user: u.username,
            score: u.rating,
            wins: u.wins,
            losses: u.losses,
            trend: "same",
        }));
    }
}
