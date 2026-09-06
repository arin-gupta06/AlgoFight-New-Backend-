import test from "node:test";
import assert from "node:assert/strict";
import { AcademicProfileService } from "../src/core/academic-service";
import { MitsAcademicRules } from "../src/institutes/mits/mits.rules";

test("AcademicProfileService: Showcase Test Case - Batch 2024 in September 2026", () => {
    const rules = new MitsAcademicRules();
    const sept2026 = new Date(2026, 8, 15); // month is 0-indexed: 8 = September
    const profile = rules.calculateAcademicProfile(2024, sept2026);

    assert.equal(profile.yearNumber, 3);
    assert.equal(profile.yearLabel, "3rd Year");
    assert.equal(profile.semester, 5);
    assert.equal(profile.semesterLabel, "5th Semester");
    assert.equal(profile.academicYear, "2026-27");
    assert.equal(profile.semesterType, "ODD");
});

test("AcademicProfileService: 1st Year progression across calendar", () => {
    const rules = new MitsAcademicRules();

    // 2024 Jul - Dec -> Semester 1 (1st Year)
    const oct2024 = new Date(2024, 9, 10); // October 2024
    const sem1Profile = rules.calculateAcademicProfile(2024, oct2024);
    assert.equal(sem1Profile.yearNumber, 1);
    assert.equal(sem1Profile.yearLabel, "1st Year");
    assert.equal(sem1Profile.semester, 1);
    assert.equal(sem1Profile.semesterLabel, "1st Semester");
    assert.equal(sem1Profile.academicYear, "2024-25");
    assert.equal(sem1Profile.semesterType, "ODD");

    // 2025 Jan - May -> Semester 2 (1st Year)
    const mar2025 = new Date(2025, 2, 15); // March 2025
    const sem2Profile = rules.calculateAcademicProfile(2024, mar2025);
    assert.equal(sem2Profile.yearNumber, 1);
    assert.equal(sem2Profile.yearLabel, "1st Year");
    assert.equal(sem2Profile.semester, 2);
    assert.equal(sem2Profile.semesterLabel, "2nd Semester");
    assert.equal(sem2Profile.academicYear, "2024-25");
    assert.equal(sem2Profile.semesterType, "EVEN");
});

test("AcademicProfileService: 2nd Year progression across calendar", () => {
    const rules = new MitsAcademicRules();

    // 2025 Jul - Dec -> Semester 3 (2nd Year)
    const nov2025 = new Date(2025, 10, 20); // November 2025
    const sem3Profile = rules.calculateAcademicProfile(2024, nov2025);
    assert.equal(sem3Profile.yearNumber, 2);
    assert.equal(sem3Profile.yearLabel, "2nd Year");
    assert.equal(sem3Profile.semester, 3);
    assert.equal(sem3Profile.semesterLabel, "3rd Semester");
    assert.equal(sem3Profile.academicYear, "2025-26");
    assert.equal(sem3Profile.semesterType, "ODD");

    // 2026 Jan - May -> Semester 4 (2nd Year)
    const apr2026 = new Date(2026, 3, 5); // April 2026
    const sem4Profile = rules.calculateAcademicProfile(2024, apr2026);
    assert.equal(sem4Profile.yearNumber, 2);
    assert.equal(sem4Profile.yearLabel, "2nd Year");
    assert.equal(sem4Profile.semester, 4);
    assert.equal(sem4Profile.semesterLabel, "4th Semester");
    assert.equal(sem4Profile.academicYear, "2025-26");
    assert.equal(sem4Profile.semesterType, "EVEN");
});

test("AcademicProfileService: 4th Year final semester", () => {
    const rules = new MitsAcademicRules();

    // 2028 Jan - May -> Semester 8 (4th Year)
    const feb2028 = new Date(2028, 1, 14); // February 2028
    const sem8Profile = rules.calculateAcademicProfile(2024, feb2028);
    assert.equal(sem8Profile.yearNumber, 4);
    assert.equal(sem8Profile.yearLabel, "4th Year");
    assert.equal(sem8Profile.semester, 8);
    assert.equal(sem8Profile.semesterLabel, "8th Semester");
    assert.equal(sem8Profile.academicYear, "2027-28");
    assert.equal(sem8Profile.semesterType, "EVEN");
});

test("AcademicProfileService: June transition period handling", () => {
    const rules = new MitsAcademicRules();

    // June 2026 -> Transition period at end of 2nd year (evaluating/concluding even sem)
    const june2026 = new Date(2026, 5, 20); // June 2026
    const juneProfile = rules.calculateAcademicProfile(2024, june2026);

    assert.equal(juneProfile.yearNumber, 2);
    assert.equal(juneProfile.yearLabel, "2nd Year");
    assert.equal(juneProfile.semester, 4);
    assert.equal(juneProfile.semesterType, "TRANSITION");
    assert.ok(juneProfile.statusNote?.includes("Transition"));
});
