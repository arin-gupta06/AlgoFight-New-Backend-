// packages/institutional-identity/src/institutes/mits/mits.rules.ts
import { AcademicProfileService } from "../../core/academic-service";
import { AcademicProfile, IAcademicRulesEngine } from "../../core/types";
import { MITS_INSTITUTE_ID } from "./mits.constants";

export class MitsAcademicRules implements IAcademicRulesEngine {
    public readonly instituteId = MITS_INSTITUTE_ID;

    public calculateAcademicProfile(admissionYear: number, referenceDate: Date = new Date()): AcademicProfile {
        return AcademicProfileService.calculateStandardProfile(admissionYear, referenceDate, {
            oddStartMonth: 7,   // July
            oddEndMonth: 12,    // December
            evenStartMonth: 1,  // January
            evenEndMonth: 5,    // May
            maxCourseYears: 4,
        });
    }
}
