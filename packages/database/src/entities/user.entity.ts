export interface UserEntity {
    id: string;
    username: string;
    email: string;
    userType?: "STUDENT" | "FACULTY" | "INDIVIDUAL";
    primaryEmail?: string | null;
    secondaryEmail?: string | null;
    institutionName?: string | null;
    department?: string | null;
    batchYear?: string | null;
    platformCode?: string | null;
    githubUrl?: string | null;
    linkedinUrl?: string | null;
    institutionId?: string | null;
    institutionDomain?: string | null;
    admissionYear?: number | null;
    branch?: string | null;
    enrollmentNumber?: string | null;
    studentIdentityMetadata?: any | null;
    rating: number;
    ewma: number;
    highestRating: number;
    highestRank: string;
    wins: number;
    losses: number;
    createdAt: Date;
    updatedAt: Date;
}
