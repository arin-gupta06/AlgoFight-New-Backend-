import test from "node:test";
import assert from "node:assert/strict";
import { MitsIdentityParser } from "../src/institutes/mits/mits.parser";

test("MitsIdentityParser: parses 24ai10ar16@mitsgwl.ac.in correctly", () => {
    const parser = new MitsIdentityParser();
    const identity = parser.parse("24ai10ar16", "mitsgwl.ac.in");

    assert.equal(identity.instituteId, "mits-gwalior");
    assert.equal(identity.instituteName, "MITS Gwalior");
    assert.equal(identity.admissionYear, 2024);
    assert.equal(identity.branch, "AI");
    assert.equal(identity.branchName, "Artificial Intelligence");
    assert.equal(identity.enrollmentNumber, "16");
    assert.equal(identity.instituteSpecificIdentifiers.batchCode, "24");
    assert.equal(identity.instituteSpecificIdentifiers.sequenceGroup, "10");
    assert.equal(identity.instituteSpecificIdentifiers.nameIdentifier, "ar");
    assert.equal(identity.instituteSpecificIdentifiers.rollNumber, "16");
});

test("MitsIdentityParser: supports other standard branch codes", () => {
    const parser = new MitsIdentityParser();

    const csIdentity = parser.parse("23cs01rk05", "mitsgwl.ac.in");
    assert.equal(csIdentity.admissionYear, 2023);
    assert.equal(csIdentity.branch, "CS");
    assert.equal(csIdentity.branchName, "Computer Science & Engineering");
    assert.equal(csIdentity.enrollmentNumber, "05");

    const itIdentity = parser.parse("22it02ab42", "mitsgwl.ac.in");
    assert.equal(itIdentity.admissionYear, 2022);
    assert.equal(itIdentity.branch, "IT");
    assert.equal(itIdentity.branchName, "Information Technology");
    assert.equal(itIdentity.enrollmentNumber, "42");
});

test("MitsIdentityParser: throws on invalid email format", () => {
    const parser = new MitsIdentityParser();

    assert.throws(
        () => parser.parse("invalid_mits_email", "mitsgwl.ac.in"),
        /Invalid MITS institutional email format/
    );
});

test("MitsIdentityParser: throws on invalid branch code", () => {
    const parser = new MitsIdentityParser();

    assert.throws(
        () => parser.parse("24xx10ar16", "mitsgwl.ac.in"),
        /Unable to determine academic branch for code 'xx'/
    );
});

test("MitsIdentityParser: validateFormat returns boolean", () => {
    const parser = new MitsIdentityParser();

    assert.equal(parser.validateFormat("24ai10ar16"), true);
    assert.equal(parser.validateFormat("24xx10ar16"), false);
    assert.equal(parser.validateFormat("not-an-email"), false);
});
