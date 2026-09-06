import test from "node:test";
import assert from "node:assert/strict";
import { defaultStudentIdentityService } from "../src/core/student-identity.service";

test("StudentIdentityService: full resolution for 24ai10ar16@mitsgwl.ac.in", () => {
    const sept2026 = new Date(2026, 8, 1);
    const result = defaultStudentIdentityService.resolveFromEmail("24ai10ar16@mitsgwl.ac.in", sept2026);

    assert.equal(result.isInstitutional, true);
    if (result.isInstitutional) {
        assert.equal(result.institute.id, "mits-gwalior");
        assert.equal(result.institute.name, "MITS Gwalior");
        assert.equal(result.institute.domain, "mitsgwl.ac.in");

        assert.equal(result.identity.admissionYear, 2024);
        assert.equal(result.identity.branch, "AI");
        assert.equal(result.identity.branchName, "Artificial Intelligence");
        assert.equal(result.identity.enrollmentNumber, "16");

        assert.equal(result.academicProfile.yearNumber, 3);
        assert.equal(result.academicProfile.yearLabel, "3rd Year");
        assert.equal(result.academicProfile.semester, 5);
        assert.equal(result.academicProfile.semesterLabel, "5th Semester");
        assert.equal(result.academicProfile.academicYear, "2026-27");
        assert.equal(result.academicProfile.semesterType, "ODD");
    }
});

test("StudentIdentityService: non-institutional email (e.g. gmail.com)", () => {
    const result = defaultStudentIdentityService.resolveFromEmail("student@gmail.com");
    assert.equal(result.isInstitutional, false);
});

test("StudentIdentityService: unsupported college domain", () => {
    const result = defaultStudentIdentityService.resolveFromEmail("student@unknowncollege.ac.in");
    assert.equal(result.isInstitutional, false);
});

test("StudentIdentityService: validateEmail helper provides informative status", () => {
    const validCheck = defaultStudentIdentityService.validateEmail("24ai10ar16@mitsgwl.ac.in");
    assert.equal(validCheck.isSupportedInstitute, true);
    assert.equal(validCheck.isValidFormat, true);
    assert.equal(validCheck.instituteName, "MITS Gwalior");

    const invalidFormatCheck = defaultStudentIdentityService.validateEmail("invalid@mitsgwl.ac.in");
    assert.equal(invalidFormatCheck.isSupportedInstitute, true);
    assert.equal(invalidFormatCheck.isValidFormat, false);

    const externalCheck = defaultStudentIdentityService.validateEmail("user@gmail.com");
    assert.equal(externalCheck.isSupportedInstitute, false);
});
