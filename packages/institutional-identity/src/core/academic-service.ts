// packages/institutional-identity/src/core/academic-service.ts
import { AcademicProfile, SemesterType } from "./types";

export interface AcademicCalendarRuleOptions {
    /**
     * Start month of odd semester (1-based, default: 7 for July)
     */
    oddStartMonth?: number;
    /**
     * End month of odd semester (1-based, default: 12 for December)
     */
    oddEndMonth?: number;
    /**
     * Start month of even semester (1-based, default: 1 for January)
     */
    evenStartMonth?: number;
    /**
     * End month of even semester (1-based, default: 5 for May)
     */
    evenEndMonth?: number;
    /**
     * Maximum standard course duration in years (default: 4 for B.Tech)
     */
    maxCourseYears?: number;
}

export class AcademicProfileService {
    public static getOrdinalSuffix(n: number): string {
        const j = n % 10;
        const k = n % 100;
        if (j === 1 && k !== 11) return `${n}st`;
        if (j === 2 && k !== 12) return `${n}nd`;
        if (j === 3 && k !== 13) return `${n}rd`;
        return `${n}th`;
    }

    /**
     * Formats academic year string (e.g. 2024 -> "2024-25")
     */
    public static formatAcademicYearString(sessionStartYear: number): string {
        const nextYearShort = String((sessionStartYear + 1) % 100).padStart(2, "0");
        return `${sessionStartYear}-${nextYearShort}`;
    }

    /**
     * Dynamically calculates the student's academic profile based on admission year and a reference date.
     * Injects referenceDate for deterministic testing.
     */
    public static calculateStandardProfile(
        admissionYear: number,
        referenceDate: Date = new Date(),
        options: AcademicCalendarRuleOptions = {}
    ): AcademicProfile {
        const oddStart = options.oddStartMonth ?? 7;   // July
        const oddEnd = options.oddEndMonth ?? 12;      // December
        const evenStart = options.evenStartMonth ?? 1;  // January
        const evenEnd = options.evenEndMonth ?? 5;      // May
        const maxYears = options.maxCourseYears ?? 4;

        const currentYear = referenceDate.getFullYear();
        const currentMonth = referenceDate.getMonth() + 1; // 1-12

        // Determine session start year and semester parity
        let sessionStartYear: number;
        let semesterOffsetInSession: number; // 1 for Odd (sem 1,3,5,7), 2 for Even (sem 2,4,6,8)
        let semesterType: SemesterType;
        let statusNote: string | undefined;

        if (currentMonth >= oddStart && currentMonth <= oddEnd) {
            // July - December: Session starts this calendar year, Odd semester
            sessionStartYear = currentYear;
            semesterOffsetInSession = 1;
            semesterType = "ODD";
        } else if (currentMonth >= evenStart && currentMonth <= evenEnd) {
            // January - May: Session started previous calendar year, Even semester
            sessionStartYear = currentYear - 1;
            semesterOffsetInSession = 2;
            semesterType = "EVEN";
        } else {
            // June (or any gap month between evenEnd and oddStart)
            // Concluding Even semester / Transition period before the new academic session in July
            sessionStartYear = currentYear - 1;
            semesterOffsetInSession = 2;
            semesterType = "TRANSITION";
            statusNote = "Summer Term / Academic Year Transition Period";
        }

        // Academic year of study (1-based: 1st Year, 2nd Year, etc.)
        const elapsedYears = sessionStartYear - admissionYear;
        const yearNumber = Math.max(1, elapsedYears + 1);

        // Semester: (yearNumber - 1) * 2 + semesterOffsetInSession
        // e.g. Year 1 Odd = 1, Year 1 Even = 2, Year 3 Odd = 5
        let semester = (yearNumber - 1) * 2 + semesterOffsetInSession;

        if (yearNumber > maxYears) {
            statusNote = statusNote
                ? `${statusNote} (Course Completed / Alumni)`
                : "Course Completed / Alumni";
        }

        const academicYearStr = this.formatAcademicYearString(sessionStartYear);
        const yearLabel = `${this.getOrdinalSuffix(yearNumber)} Year`;
        const semesterLabel = `${this.getOrdinalSuffix(semester)} Semester`;

        return {
            academicYear: academicYearStr,
            yearNumber,
            yearLabel,
            semester,
            semesterLabel,
            semesterType,
            statusNote,
        };
    }
}
