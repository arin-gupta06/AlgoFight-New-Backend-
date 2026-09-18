// packages/institutional-identity/src/institutes/mits/mits.parser.ts
import { IIdentityParser, StudentIdentity } from "../../core/types";
import {
    MITS_ACADEMIC_MAP,
    MITS_BRANCH_MAP,
    MITS_DOMAIN,
    MITS_INSTITUTE_ID,
    MITS_INSTITUTE_NAME,
    MITS_STUDENT_EMAIL_REGEX,
} from "./mits.constants";

export class MitsIdentityParser implements IIdentityParser {
    public readonly instituteId = MITS_INSTITUTE_ID;

    public validateFormat(localPart: string): boolean {
        const cleaned = localPart.trim().toLowerCase();
        const match = MITS_STUDENT_EMAIL_REGEX.exec(cleaned);
        if (!match) return false;

        const branchCode = match[2].toLowerCase();
        return branchCode in MITS_ACADEMIC_MAP || branchCode in MITS_BRANCH_MAP;
    }

    public parse(localPart: string, domain: string): StudentIdentity {
        const cleaned = localPart.trim().toLowerCase();
        const match = MITS_STUDENT_EMAIL_REGEX.exec(cleaned);

        if (!match) {
            throw new Error("Invalid MITS institutional email format.");
        }

        const [, batchStr, branchCodeRaw, sequenceGroup, nameIdentifier, rollNumber] = match;
        const branchCode = branchCodeRaw.toLowerCase();
        const academicInfo = MITS_ACADEMIC_MAP[branchCode];

        if (!academicInfo) {
            throw new Error(`Unable to determine academic branch for code '${branchCodeRaw}'.`);
        }

        const branchName = academicInfo.branch;
        const department = academicInfo.department;
        const programme = academicInfo.programme;

        // Convert 2-digit batch to 4-digit admission year (e.g. '24' -> 2024)
        const batchNum = parseInt(batchStr, 10);
        const admissionYear = 2000 + batchNum;

        return {
            instituteId: MITS_INSTITUTE_ID,
            instituteName: MITS_INSTITUTE_NAME,
            instituteDomain: domain || MITS_DOMAIN,
            admissionYear,
            branch: branchCode.toUpperCase(),
            branchName,
            department,
            programme,
            enrollmentNumber: rollNumber,
            instituteSpecificIdentifiers: {
                rawLocalPart: cleaned,
                batchCode: batchStr,
                branchCode,
                sequenceGroup,
                nameIdentifier,
                rollNumber,
                department,
                programme,
            },
        };
    }
}
