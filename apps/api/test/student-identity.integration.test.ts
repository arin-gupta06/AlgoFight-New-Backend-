import "./setup";
import test from "node:test";
import assert from "node:assert/strict";
import fastify from "fastify";
import { studentRoutes } from "../src/routes/student.route";
import { defaultStudentIdentityService } from "@algofight/institutional-identity";

test("API Integration: POST /student/resolve for MITS email", async () => {
    const app = fastify();
    await app.register(studentRoutes);

    const response = await app.inject({
        method: "POST",
        url: "/student/resolve",
        payload: { email: "24ai10ar16@mitsgwl.ac.in" },
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.isSupportedInstitute, true);
    assert.equal(body.instituteName, "MITS Gwalior");
    assert.equal(body.isValidFormat, true);
    assert.ok(body.preview);
    assert.equal(body.preview.identity.admissionYear, 2024);
    assert.equal(body.preview.identity.branch, "AI");
    assert.equal(body.preview.identity.branchName, "Artificial Intelligence");
    assert.equal(body.preview.identity.enrollmentNumber, "16");

    await app.close();
});

test("API Integration: POST /student/resolve for invalid MITS email format", async () => {
    const app = fastify();
    await app.register(studentRoutes);

    const response = await app.inject({
        method: "POST",
        url: "/student/resolve",
        payload: { email: "invalid@mitsgwl.ac.in" },
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.isSupportedInstitute, true);
    assert.equal(body.isValidFormat, false);

    await app.close();
});

test("API Integration: POST /student/resolve for non-institutional email", async () => {
    const app = fastify();
    await app.register(studentRoutes);

    const response = await app.inject({
        method: "POST",
        url: "/student/resolve",
        payload: { email: "student@gmail.com" },
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.isSupportedInstitute, false);

    await app.close();
});

test("Showcase Test: Google & Native flows produce identical academic profile", async () => {
    const sept2026 = new Date(2026, 8, 15);
    const verifiedEmail = "24ai10ar16@mitsgwl.ac.in";

    // Flow 1: Native Student Auth
    const nativeResolution = defaultStudentIdentityService.resolveFromEmail(verifiedEmail, sept2026);

    // Flow 2: Google OAuth Auth
    const googleResolution = defaultStudentIdentityService.resolveFromEmail(verifiedEmail, sept2026);

    assert.equal(nativeResolution.isInstitutional, true);
    assert.equal(googleResolution.isInstitutional, true);

    if (nativeResolution.isInstitutional && googleResolution.isInstitutional) {
        assert.deepEqual(nativeResolution.identity, googleResolution.identity);
        assert.deepEqual(nativeResolution.academicProfile, googleResolution.academicProfile);

        assert.equal(nativeResolution.identity.instituteName, "MITS Gwalior");
        assert.equal(nativeResolution.identity.admissionYear, 2024);
        assert.equal(nativeResolution.identity.branch, "AI");
        assert.equal(nativeResolution.identity.enrollmentNumber, "16");

        assert.equal(nativeResolution.academicProfile.yearNumber, 3);
        assert.equal(nativeResolution.academicProfile.yearLabel, "3rd Year");
        assert.equal(nativeResolution.academicProfile.semester, 5);
        assert.equal(nativeResolution.academicProfile.semesterLabel, "5th Semester");
        assert.equal(nativeResolution.academicProfile.academicYear, "2026-27");
        assert.equal(nativeResolution.academicProfile.semesterType, "ODD");
    }
});
