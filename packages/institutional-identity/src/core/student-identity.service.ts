// packages/institutional-identity/src/core/student-identity.service.ts
import { defaultInstituteRegistry, InstituteRegistry } from "./registry";
import { AcademicProfile, IdentityResolutionResult, StudentIdentity } from "./types";

export class StudentIdentityService {
    constructor(private readonly registry: InstituteRegistry = defaultInstituteRegistry) {}

    /**
     * Resolves verified email into an institutional student identity and dynamic academic profile.
     * Returns NonInstitutionalIdentity if email domain is not from a supported institution.
     * Throws specific descriptive errors if domain is an institute but email format is invalid.
     */
    public resolveFromEmail(email: string, referenceDate: Date = new Date()): IdentityResolutionResult {
        const parts = this.registry.extractEmailParts(email);
        if (!parts) {
            return {
                isInstitutional: false,
                reason: "Invalid email syntax",
            };
        }

        const { localPart, domain } = parts;
        const institute = this.registry.resolveByDomain(domain);

        if (!institute) {
            return {
                isInstitutional: false,
                reason: `Domain '${domain}' is not a supported institution domain.`,
            };
        }

        if (institute.status !== "ACTIVE") {
            throw new Error(`Institute '${institute.name}' is currently inactive.`);
        }

        // Validate institute format
        if (!institute.identityParser.validateFormat(localPart)) {
            // Check parser specifically to give precise error
            try {
                institute.identityParser.parse(localPart, domain);
            } catch (err: any) {
                throw err;
            }
            throw new Error(`Invalid institutional email format for ${institute.name}.`);
        }

        // Parse student identity
        const identity: StudentIdentity = institute.identityParser.parse(localPart, domain);

        // Dynamically compute current academic profile based on admission year and date
        const academicProfile: AcademicProfile = institute.academicRules.calculateAcademicProfile(
            identity.admissionYear,
            referenceDate
        );

        return {
            isInstitutional: true,
            institute: {
                id: institute.id,
                name: institute.name,
                domain: institute.domain,
            },
            identity,
            academicProfile,
        };
    }

    /**
     * Fast validation helper for pre-auth input inspection
     */
    public validateEmail(email: string): {
        isSupportedInstitute: boolean;
        instituteName?: string;
        isValidFormat: boolean;
        error?: string;
    } {
        const parts = this.registry.extractEmailParts(email);
        if (!parts) {
            return { isSupportedInstitute: false, isValidFormat: false, error: "Invalid email syntax" };
        }

        const institute = this.registry.resolveByDomain(parts.domain);
        if (!institute) {
            return {
                isSupportedInstitute: false,
                isValidFormat: false,
                error: "Institution not currently supported by AlgoFight",
            };
        }

        const isValidFormat = institute.identityParser.validateFormat(parts.localPart);
        return {
            isSupportedInstitute: true,
            instituteName: institute.name,
            isValidFormat,
            error: isValidFormat ? undefined : `Invalid institutional email format for ${institute.name}`,
        };
    }

    /**
     * Dynamically re-calculates the academic profile for an already persisted student.
     */
    public calculateDynamicProfile(
        instituteId: string,
        admissionYear: number,
        referenceDate: Date = new Date()
    ): AcademicProfile {
        const institute = this.registry.getById(instituteId);
        if (institute) {
            return institute.academicRules.calculateAcademicProfile(admissionYear, referenceDate);
        }
        // Fallback to standard 4-year calendar if institute not found
        const { AcademicProfileService } = require("./academic-service");
        return AcademicProfileService.calculateStandardProfile(admissionYear, referenceDate);
    }
}

// Global default singleton
export const defaultStudentIdentityService = new StudentIdentityService();
