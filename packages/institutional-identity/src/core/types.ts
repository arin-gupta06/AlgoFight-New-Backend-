// packages/institutional-identity/src/core/types.ts

export type SemesterType = "ODD" | "EVEN" | "TRANSITION";

export interface StudentIdentity {
    instituteId: string;
    instituteName: string;
    instituteDomain: string;
    admissionYear: number;
    branch: string;
    branchName: string;
    enrollmentNumber: string;
    instituteSpecificIdentifiers: {
        rawLocalPart: string;
        batchCode?: string;
        branchCode?: string;
        sequenceGroup?: string;
        nameIdentifier?: string;
        rollNumber?: string;
        [key: string]: any;
    };
}

export interface AcademicProfile {
    academicYear: string;   // e.g. "2026-27"
    yearNumber: number;     // e.g. 3
    yearLabel: string;      // e.g. "3rd Year"
    semester: number;       // e.g. 5
    semesterLabel: string;  // e.g. "5th Semester"
    semesterType: SemesterType;
    statusNote?: string;
}

export interface IIdentityParser {
    readonly instituteId: string;
    validateFormat(localPart: string): boolean;
    parse(localPart: string, domain: string): StudentIdentity;
}

export interface IAcademicRulesEngine {
    readonly instituteId: string;
    calculateAcademicProfile(admissionYear: number, referenceDate?: Date): AcademicProfile;
}

export interface InstituteConfig {
    id: string;
    name: string;
    domain: string;
    aliases?: string[];
    status: "ACTIVE" | "INACTIVE";
    identityParser: IIdentityParser;
    academicRules: IAcademicRulesEngine;
}

export interface ResolvedInstitutionalIdentity {
    isInstitutional: true;
    institute: {
        id: string;
        name: string;
        domain: string;
    };
    identity: StudentIdentity;
    academicProfile: AcademicProfile;
}

export interface NonInstitutionalIdentity {
    isInstitutional: false;
    reason?: string;
}

export type IdentityResolutionResult = ResolvedInstitutionalIdentity | NonInstitutionalIdentity;
